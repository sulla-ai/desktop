import type { ThreadState, ToolResult } from '../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import { runCommand } from './CommandRunner';

const ALLOWED_COMMANDS = new Set([
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

function splitCommandLine(commandLine: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inSingle = false;
  let inDouble = false;

  const push = () => {
    if (cur.length > 0) {
      out.push(cur);
      cur = '';
    }
  };

  for (let i = 0; i < commandLine.length; i++) {
    const ch = commandLine[i];

    if (ch === '\\' && !inSingle) {
      const next = commandLine[i + 1];
      if (next !== undefined) {
        cur += next;
        i++;
        continue;
      }
    }

    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      continue;
    }
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      continue;
    }

    if (!inSingle && !inDouble && /\s/.test(ch)) {
      push();
      continue;
    }

    cur += ch;
  }

  push();
  return out;
}

export class ExecTool extends BaseTool {
  override readonly name = 'exec';

  override getPlanningInstructions(): string {
    return [
      '["exec", "command", "arg1", "arg2"] - Is the exec shell runner to run a safe allowlisted commands on the host',
`
### Allowed Commands:
- ls
- cat
- pwd
- whoami
- uname
- id
- hostname
- date
- printenv
- ps
- top
- pgrep
- lsof
- sysctl
- echo
- stat
- du
- df
- head
- tail
- sed
- awk
- wc
- nslookup
- dig
- ping
- ifconfig
- git
- rg
- grep
- find

### Example Usage in exec form
["exec", "pwd"]
["exec", "ls", "-la", "/"]
["exec", "grep", "-r", "pattern", "/path"]
["exec", "tree", "-L", "2"]
["exec", "find", ".", "-type", "f", "-name", "*.ts"]
`,
      '   - Output: stdout/stderr/exitCode.',
    ].join('\n');
  }

  override async execute(_state: ThreadState, context: ToolContext): Promise<ToolResult> {

    // Handle exec form: args is string array like ["knowledge_base_delete_page", "slug"]
    const argsArray = this.getArgsArray(context, 1);
    const command = this.getFirstArg(context);
    
    if (!command) {
      return { toolName: this.name, success: false, error: 'Missing args: command' };
    }

    if (!ALLOWED_COMMANDS.has(command)) {
      return { toolName: this.name, success: false, error: `Command not allowlisted: ${command}` };
    }

    const res = await runCommand(command, argsArray, {
      timeoutMs: 20 * 1000,
      maxOutputChars: 200_000,
    });

    if (res.exitCode !== 0) {
      return { toolName: this.name, success: false, error: res.stderr || res.stdout || 'command failed' };
    }

    return { toolName: this.name, success: true, result: { command, args: argsArray, stdout: res.stdout, stderr: res.stderr || undefined, exitCode: res.exitCode } };
  }
}
