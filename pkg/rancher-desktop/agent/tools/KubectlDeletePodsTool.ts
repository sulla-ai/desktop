import type { ThreadState, ToolResult } from '../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import { runCommand } from './CommandRunner';

export class KubectlDeletePodsTool extends BaseTool {
  override readonly name = 'kubectl_delete_pods';
  override readonly category = 'kubernetes_write';

  override getPlanningInstructions(): string {
    return [
      '37) kubectl_delete_pods (Kubernetes via kubectl)',
      '   - Purpose: Delete pods by label selector in a namespace (mutates cluster state).',
      '   - Args:',
      '     - namespace (string, required) Namespace to delete pods in (e.g. "default")',
      '     - selector (string, required) Label selector (e.g. "app=my-app")',
      '   - Output: kubectl delete output.',
      '   - Planning guidance:',
      '     - Set requiresTools=true',
      '     - Use a narrow selector; avoid broad deletes.',
      '     - Include a step with action "kubectl_delete_pods" and args.',
    ].join('\n');
  }

  override async execute(_state: ThreadState, context: ToolContext): Promise<ToolResult> {
    const ns = context.args?.namespace ? String(context.args.namespace) : '';
    const selector = context.args?.selector ? String(context.args.selector) : '';

    if (!ns.trim()) {
      return { toolName: this.name, success: false, error: 'Missing args: namespace' };
    }
    if (!selector.trim()) {
      return { toolName: this.name, success: false, error: 'Missing args: selector' };
    }

    const res = await runCommand(
      'kubectl',
      ['delete', 'pods', '-n', ns, '-l', selector, '--ignore-not-found=true'],
      { timeoutMs: 60_000, maxOutputChars: 160_000 },
    );

    if (res.exitCode !== 0) {
      return { toolName: this.name, success: false, error: res.stderr || res.stdout || 'kubectl delete pods failed' };
    }

    return { toolName: this.name, success: true, result: { namespace: ns, selector, output: res.stdout } };
  }
}
