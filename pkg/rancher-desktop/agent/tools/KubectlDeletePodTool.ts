import type { ThreadState, ToolResult } from '../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import { runCommand } from './CommandRunner';

export class KubectlDeletePodTool extends BaseTool {
  override readonly name = 'kubectl_delete_pod';
  override readonly category = 'kubernetes_write';

  override getPlanningInstructions(): string {
    return [
      '40) kubectl_delete_pod (Kubernetes via kubectl)',
      '   - Purpose: Delete a single pod by name OR delete pods by selector (mutates cluster state).',
      '   - Args:',
      '     - namespace (string, required)',
      '     - pod (string, optional) Pod name to delete',
      '     - selector (string, optional) Label selector (e.g. "app=my-app")',
      '   - Notes:',
      '     - Provide exactly one of pod or selector.',
      '   - Output: kubectl delete output.',
    ].join('\n');
  }

  override async execute(_state: ThreadState, context: ToolContext): Promise<ToolResult> {
    const ns = context.args?.namespace ? String(context.args.namespace) : '';
    const pod = context.args?.pod ? String(context.args.pod) : '';
    const selector = context.args?.selector ? String(context.args.selector) : '';

    if (!ns.trim()) {
      return { toolName: this.name, success: false, error: 'Missing args: namespace' };
    }

    const hasPod = !!pod.trim();
    const hasSelector = !!selector.trim();
    if ((hasPod && hasSelector) || (!hasPod && !hasSelector)) {
      return { toolName: this.name, success: false, error: 'Provide exactly one of args: pod or selector' };
    }

    const args = ['delete', 'pod'];
    if (hasPod) {
      args.push(pod);
    }
    args.push('-n', ns);
    if (hasSelector) {
      args.push('-l', selector);
    }
    args.push('--ignore-not-found=true');

    const res = await runCommand('kubectl', args, { timeoutMs: 60_000, maxOutputChars: 160_000 });
    if (res.exitCode !== 0) {
      return { toolName: this.name, success: false, error: res.stderr || res.stdout || 'kubectl delete pod failed' };
    }

    return { toolName: this.name, success: true, result: { namespace: ns, pod: hasPod ? pod : undefined, selector: hasSelector ? selector : undefined, output: res.stdout } };
  }
}
