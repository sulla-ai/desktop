import type { ThreadState, ToolResult } from '../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import { runCommand } from './CommandRunner';

export class RdctlTool extends BaseTool {
  override readonly name = 'rdctl';

  override getPlanningInstructions(): string {
    return [
      '`rdctl` - Execute any Rancher Desktop CLI command using exec form',
      '    rdctl is the Rancher Desktop command-line tool for managing the application',
      '',
      '    EXEC FORM - JSON FORMAT TO USE (return Exec Form):',
      '    ["rdctl", "subcommand", "arg1", "arg2", ...]',
      '',
      '    Required: JSON array where:',
      '    - First element is always "rdctl"',
      '    - Second element is the subcommand (api, set, start, shutdown, etc.)',
      '    - Remaining elements are flags and arguments',
      '',
      '    Examples:',
      '    ["rdctl", "api", "/v1/settings"]',
      '    ["rdctl", "set", "--kubernetes-enabled=true"]',
      '    ["rdctl", "list-settings"]',
      '    ["rdctl", "start"]',
      '    ["rdctl", "shutdown"]',
      '    ["rdctl", "shell"]',
      '    ["rdctl", "extension", "list"]',
      '    ["rdctl", "snapshot", "create", "my-snapshot"]',
      '',
      '    Common commands: api, set, list-settings, start, shutdown, shell, extension, snapshot, reset, info',
    ].join('\n');
  }

  override async execute(_state: ThreadState, context: ToolContext): Promise<ToolResult> {
    // Handle exec form: args is string array directly
    const argsArray = Array.isArray(context.args) ? context.args : context.args?.args;

    if (!Array.isArray(argsArray) || argsArray.length === 0) {
      return { toolName: this.name, success: false, error: 'Missing args: args (array of rdctl command arguments)' };
    }

    // Convert all args to strings
    const args = argsArray.map(arg => String(arg));

    // Execute rdctl with the provided args
    const res = await runCommand('rdctl', args, { timeoutMs: 60_000, maxOutputChars: 160_000 });

    if (res.exitCode !== 0) {
      return {
        toolName: this.name,
        success: false,
        error: res.stderr || res.stdout || `rdctl ${args.join(' ')} failed with exit code ${res.exitCode}`,
      };
    }

    return {
      toolName: this.name,
      success: true,
      result: {
        command: `rdctl ${args.join(' ')}`,
        output: res.stdout,
        stderr: res.stderr || undefined,
      },
    };
  }
}
