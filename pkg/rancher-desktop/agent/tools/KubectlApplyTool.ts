import type { ThreadState, ToolResult } from '../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import { runCommand } from './CommandRunner';

export class KubectlApplyTool extends BaseTool {
  override readonly name = 'kubectl_apply';
  override readonly category = 'kubernetes_write';

  override getPlanningInstructions(): string {
    return [
      '16) kubectl_apply (Kubernetes via kubectl)',
      '   - Purpose: Apply manifests to the cluster using YAML provided by the planner (mutates cluster state).',
      '   - Args:',
      '     - yaml (string, required) YAML manifest(s) to apply',
      '     - namespace (string, optional)',
      '   - Output: kubectl apply output (truncated if large).',
      '   - Planning guidance:',
      '     - Set requiresTools=true',
      '     - Prefer running kubectl_apply_dry_run first.',
      '     - Include a step with action "kubectl_apply" and args.',
    ].join('\n');
  }

  override async execute(_state: ThreadState, context: ToolContext): Promise<ToolResult> {
    const rawYaml = String(context.args?.yaml || '');
    const ns = context.args?.namespace ? String(context.args.namespace) : '';

    if (!rawYaml.trim()) {
      return { toolName: this.name, success: false, error: 'Missing args: yaml' };
    }

    const yaml = rawYaml
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'");

    const args = ['apply', '-f', '-'];
    if (ns) {
      args.push('-n', ns);
    }

    const res = await runCommand('kubectl', args, { stdin: yaml, timeoutMs: 30_000, maxOutputChars: 160_000 });
    if (res.exitCode !== 0) {
      return { toolName: this.name, success: false, error: res.stderr || res.stdout || 'kubectl apply failed' };
    }

    return { toolName: this.name, success: true, result: { namespace: ns || undefined, output: res.stdout } };
  }
}
