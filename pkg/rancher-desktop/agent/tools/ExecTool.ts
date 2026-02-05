import type { ThreadState, ToolResult } from '../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import { runCommand } from './util/CommandRunner';

const ALLOWED_COMMANDS = new Set([
  'sh',
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

export class ExecTool extends BaseTool {
  override readonly name = 'exec';

  override getPlanningInstructions(): string {
    return `["exec", "sh", "-c", "find ~ -maxdepth 3 -name '*.jpg' | head -1"] - Safe shell runner

Examples:
["exec", "pwd"]
["exec", "ls", "-la", "~"]
["exec", "sh", "-c", "find ~/Pictures -type f -iname '*.png' -o -iname '*.jpg' | head -3"]
["exec", "find", ".", "-name", "*.ts"]
["exec", "stat", "--format", "%s bytes", "/tmp/test.jpg"]

Rules:
- Simple commands: ["exec", "ls", "-la", "/tmp"]
- Complex/shell syntax: always use "sh -c" + full script
- ~ expands automatically in shell
- No sudo, rm -rf, dangerous ops — blocked
`.trim();
  }

  override async execute(_state: ThreadState, context: ToolContext): Promise<ToolResult> {
    const helpResult = await this.handleHelpRequest(context);
    if (helpResult) return helpResult;

    const argsArray = this.getArgsArray(context, 1);
    if (!argsArray.length) {
      return { toolName: this.name, success: false, error: 'Missing command' };
    }

    let command = argsArray[0];
    let subArgs = argsArray.slice(1);

    // Handle case where people accidentally send ["sh", "-c", "script"] → command becomes "-c"
    if (command === '-c' && subArgs.length >= 1) {
      // Assume previous arg was sh, reconstruct properly
      command = 'sh';
      subArgs = ['-c', ...subArgs];
    }

    // Allow simple commands from list
    if (ALLOWED_COMMANDS.has(command) && command !== 'sh') {
      console.log('[ExecTool] Simple command:', command, subArgs);
      const res = await runCommand(command, subArgs, { timeoutMs: 20000 });

      return res.exitCode === 0
        ? { toolName: this.name, success: true, result: res }
        : { toolName: this.name, success: false, error: res.stderr || 'command failed' };
    }

    // Full shell mode: sh -c "script"
    if (command === 'sh' && subArgs[0] === '-c' && subArgs.length >= 2) {
      const script = subArgs.slice(1).join(' '); // preserve full expression
      console.log('[ExecTool] Full shell script:', script.substring(0, 200) + '...');

      const res = await runCommand('sh', ['-c', script], { timeoutMs: 1200000 });

      return res.exitCode === 0
        ? { toolName: this.name, success: true, result: res }
        : { toolName: this.name, success: false, error: res.stderr || 'shell script failed' };
    }

    return { toolName: this.name, success: false, error: `Invalid command: ${command} (use ["exec", "sh", "-c", "your full command here"])` };
  }
}