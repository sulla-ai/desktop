import type { ThreadState, ToolResult } from '../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import { runCommand } from './CommandRunner';

const ALLOWED_COMMANDS = new Set([
  'kubectl',
  'limactl',
  'ls',
  'cat',
  'pwd',
  'whoami',
  'uname',
  'id',
  'hostname',
  'date',
  'printenv',
  'ps',
  'top',
  'pgrep',
  'lsof',
  'sysctl',
  'echo',
  'stat',
  'du',
  'df',
  'head',
  'tail',
  'sed',
  'awk',
  'wc',
  'nslookup',
  'dig',
  'ping',
  'ifconfig',
  'git',
  'rg',
  'grep',
  'find',
]);

export class HostRunCommandTool extends BaseTool {
  override readonly name = 'host_run_command';
  override readonly category = 'host_exec';

  override getPlanningInstructions(): string {
    return [
      '33) host_run_command (Host)',
      '   - Purpose: Run a safe allowlisted command on the host.',
      '   - Args:',
      '     - command (string, required) must be allowlisted',
      '     - args (array, optional) string args',
      '     - timeoutSeconds (number, optional, default 20)',
      '   - Output: stdout/stderr/exitCode.',
    ].join('\n');
  }

  override async execute(_state: ThreadState, context: ToolContext): Promise<ToolResult> {
    const command = String(context.args?.command || '');
    const args = Array.isArray(context.args?.args) ? (context.args!.args as unknown[]).map(String) : [];
    const timeoutSeconds = Number(context.args?.timeoutSeconds ?? 20);

    if (!command) {
      return { toolName: this.name, success: false, error: 'Missing args: command' };
    }

    if (!ALLOWED_COMMANDS.has(command)) {
      return { toolName: this.name, success: false, error: `Command not allowlisted: ${command}` };
    }

    const res = await runCommand(command, args, {
      timeoutMs: (Number.isFinite(timeoutSeconds) ? timeoutSeconds : 20) * 1000,
      maxOutputChars: 200_000,
    });

    if (res.exitCode !== 0) {
      return { toolName: this.name, success: false, error: res.stderr || res.stdout || 'command failed' };
    }

    return { toolName: this.name, success: true, result: { command, args, stdout: res.stdout, stderr: res.stderr || undefined, exitCode: res.exitCode } };
  }
}
