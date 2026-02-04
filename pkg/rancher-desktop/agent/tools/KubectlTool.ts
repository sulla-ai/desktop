import type { ThreadState, ToolResult } from '../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import { runCommand } from './CommandRunner';

export class KubectlTool extends BaseTool {
  override readonly name = 'kubectl';
  override readonly category = 'kubernetes';

  override getPlanningInstructions(): string {
    return [
      '`kubectl` - Execute any kubectl command against the cluster using exec form',
      '    kubectl client Version: v1.35.0, Server Version: v1.34.3+k3s3',
      '',
      '    EXEC FORM - JSON FORMAT TO USE (return Exec Form):',
      '    ["kubectl", "get", "pods", "-n", "default"]',
      '',
      '    Required: JSON array where:',
      '    - First element is always "kubectl"',
      '    - Second element is the subcommand (get, apply, logs, describe, etc.)',
      '    - Remaining elements are flags and arguments',
      '',
      '    Examples:',
      '    ["kubectl", "get", "pods"]',
      '    ["kubectl", "get", "nodes", "-o", "wide"]',
      '    ["kubectl", "logs", "pod-name", "-n", "default"]',
      '    ["kubectl", "apply", "-f", "/path/to/manifest.yaml"]',
      '    ["kubectl", "delete", "pod", "pod-name"]',
      '    ["kubectl", "describe", "deployment", "app-name"]',
      '    ["kubectl", "exec", "pod-name", "--", "ls", "-la"]',
      '',
      '    Common commands: get, describe, logs, apply, delete, exec, port-forward',
    ].join('\n');
  }

  override async execute(_state: ThreadState, context: ToolContext): Promise<ToolResult> {
    const argsArray = context.args?.args;

    if (!Array.isArray(argsArray) || argsArray.length === 0) {
      return { toolName: this.name, success: false, error: 'Missing args: args (array of kubectl command arguments)' };
    }

    // Convert all args to strings
    const args = argsArray.map(arg => String(arg));

    // Execute kubectl with the provided args
    const res = await runCommand('kubectl', args, { timeoutMs: 60_000, maxOutputChars: 160_000 });

    if (res.exitCode !== 0) {
      return {
        toolName: this.name,
        success: false,
        error: res.stderr || res.stdout || `kubectl ${args.join(' ')} failed with exit code ${res.exitCode}`,
      };
    }

    return {
      toolName: this.name,
      success: true,
      result: {
        command: `kubectl ${args.join(' ')}`,
        output: res.stdout,
        stderr: res.stderr || undefined,
      },
    };
  }
}
