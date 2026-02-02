import type { ThreadState, ToolResult } from '../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import { runCommand } from './CommandRunner';

export class KubectlWaitDeleteTool extends BaseTool {
  override readonly name = 'kubectl_wait_delete';
  override readonly category = 'kubernetes_debug';

  override getPlanningInstructions(): string {
    return [
      '38) kubectl_wait_delete (Kubernetes via kubectl)',
      '   - Purpose: Wait until pods selected by label selector are deleted (no longer exist).',
      '   - Args:',
      '     - namespace (string, required)',
      '     - selector (string, required) Label selector (e.g. "app=my-app")',
      '     - timeout (string, optional, default "60s") kubectl wait timeout (e.g. "30s", "2m")',
      '   - Output: kubectl wait output.',
      '   - Planning guidance:',
      '     - Set requiresTools=true',
      '     - Use after kubectl_delete_pods to ensure pods are gone before verifying state.',
    ].join('\n');
  }

  override async execute(_state: ThreadState, context: ToolContext): Promise<ToolResult> {
    const ns = context.args?.namespace ? String(context.args.namespace) : '';
    const selector = context.args?.selector
      ? String(context.args.selector)
      : (context.args?.label_selector ? String((context.args as any).label_selector) : '');
    const timeout = context.args?.timeout ? String(context.args.timeout) : '60s';

    if (!ns.trim()) {
      return { toolName: this.name, success: false, error: 'Missing args: namespace' };
    }
    if (!selector.trim()) {
      return { toolName: this.name, success: false, error: 'Missing args: selector' };
    }

    const res = await runCommand(
      'kubectl',
      ['wait', '--for=delete', 'pod', '-n', ns, '-l', selector, `--timeout=${timeout}`],
      { timeoutMs: 120_000, maxOutputChars: 120_000 },
    );

    if (res.exitCode !== 0) {
      return { toolName: this.name, success: false, error: res.stderr || res.stdout || 'kubectl wait --for=delete failed' };
    }

    return { toolName: this.name, success: true, result: { namespace: ns, selector, timeout, output: res.stdout } };
  }
}
