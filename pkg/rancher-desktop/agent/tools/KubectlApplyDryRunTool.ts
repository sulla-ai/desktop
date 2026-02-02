import type { ThreadState, ToolResult } from '../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import { runCommand } from './CommandRunner';

export class KubectlApplyDryRunTool extends BaseTool {
  override readonly name = 'kubectl_apply_dry_run';
  override readonly category = 'kubernetes_write';

  override getPlanningInstructions(): string {
    return [
      '15) kubectl_apply_dry_run (Kubernetes via kubectl)',
      '   - Purpose: Validate manifests against the cluster API without applying (server-side dry-run).',
      '   - Purpose: Validate/apply manifests in dry-run mode (server-side) using YAML provided by the planner.',
      '   - Args:',
      '     - yaml (string, required) YAML manifest(s) to apply',
      '     - namespace (string, optional)',
      '   - Output: kubectl dry-run output (truncated if large).',
      '   - Planning guidance:',
      '     - Set requiresTools=true',
      '     - Include a step with action "kubectl_apply_dry_run" and args.',
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

    const args = ['apply', '--dry-run=server', '-f', '-'];
    if (ns) {
      args.push('-n', ns);
    }

    const res = await runCommand('kubectl', args, { stdin: yaml, timeoutMs: 30_000, maxOutputChars: 160_000 });
    if (res.exitCode !== 0) {
      return { toolName: this.name, success: false, error: res.stderr || res.stdout || 'kubectl dry-run apply failed' };
    }

    return { toolName: this.name, success: true, result: { namespace: ns || undefined, output: res.stdout } };
  }
}
