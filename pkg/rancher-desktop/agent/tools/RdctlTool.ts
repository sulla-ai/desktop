import type { ThreadState, ToolResult } from '../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import { runCommand } from './util/CommandRunner';

export class RdctlTool extends BaseTool {
  override readonly name = 'rdctl';

  override getPlanningInstructions(): string {
    return `["rdctl", "shell"] - Manage Sulla Desktop (Fork of Rancher Desktop) via CLI

Examples:
["rdctl", "shell"]
["rdctl", "api", "/v1/settings"]
["rdctl", "set", "--kubernetes-enabled=true"]
["rdctl", "list-settings"]
["rdctl", "start"]
["rdctl", "shutdown"]
["rdctl", "extension", "list"]
["rdctl", "snapshot", "create", "backup-2026-02"]
["rdctl", "reset", "--factory-reset"]

Subcommands (common):
- api <endpoint>                     → call RD API
- set <flags>                        → change settings
- list-settings                      → show current config
- start                              → start VM
- shutdown                           → stop VM
- shell                              → open interactive shell in VM
- extension list / install / uninstall → manage extensions
- snapshot create / list / restore / delete → snapshots
- reset [--factory-reset]            → reset settings/VM
- info                               → show status
  `.trim();
  }

  override async execute(_state: ThreadState, context: ToolContext): Promise<ToolResult> {
    const helpResult = await this.handleHelpRequest(context);
    if (helpResult) {
      return helpResult;
    }
    
    // Handle exec form: args is string array directly
    const argsArray = this.getArgsArray(context);

    if (!Array.isArray(argsArray) || argsArray.length === 0) {
      return { toolName: this.name, success: false, error: 'Missing args: args (array of rdctl command arguments)' };
    }

    // Execute rdctl with the provided args
    const res = await runCommand('rdctl', argsArray, { timeoutMs: 60_000, maxOutputChars: 160_000 });

    if (res.exitCode !== 0) {
      return {
        toolName: this.name,
        success: false,
        error: res.stderr || res.stdout || `rdctl ${argsArray.join(' ')} failed with exit code ${res.exitCode}`,
      };
    }

    return {
      toolName: this.name,
      success: true,
      result: {
        command: `rdctl ${argsArray.join(' ')}`,
        output: res.stdout,
        stderr: res.stderr || undefined,
      },
    };
  }
}
