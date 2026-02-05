import type { ThreadState, ToolResult } from '../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import { runCommand } from './CommandRunner';

export class LimactlTool extends BaseTool {
  override readonly name = 'lima_shell';

  override getPlanningInstructions(): string {
    return [
      '["limactl, "[command]"] - Lima: Linux virtual machines. limactl version 2.0.3. EXEC FORM - JSON FORMAT TO USE:',
`Run a container:
["limactl", "nerdctl", "run", "-d", "--name", "-p" ,"8080:80", "nginx:alpine"]

List instances of Lima:
["limactl", "list"]

See also template YAMLs: /opt/homebrew/share/lima/templates

Basic Commands:
  create              Create an instance of Lima
  delete              Delete an instance of Lima
  edit                Edit an instance of Lima or a template
  list                List instances of Lima
  restart             Restart a running instance
  shell               Execute shell in Lima
  start               Start an instance of Lima
  stop                Stop an instance

Advanced Commands:
  clone               Clone an instance of Lima
  copy                Copy files between host and guest
  disk                Lima disk management
  factory-reset       Factory reset an instance of Lima. CRITICAL that you never run this.
  info                Show diagnostic information
  network             Lima network management
  protect             Protect an instance to prohibit accidental removal
  prune               Prune garbage objects
  rename              Rename an instance of Lima
  snapshot            Manage instance snapshots
  start-at-login      Register/Unregister an autostart file for the instance
  sudoers             Generate the content of the /etc/sudoers.d/lima file
  template            Lima template management (EXPERIMENTAL)
  tunnel              Create a tunnel for Lima
  unprotect           Unprotect an instance
  validate            Validate YAML templates
`
    ].join('\n');
  }

  override async execute(_state: ThreadState, context: ToolContext): Promise<ToolResult> {
    // Handle exec form: args is string array like ["limactl", "list"] or ["limactl", "shell", "name", "command"]
    const argsArray = Array.isArray(context.args) ? context.args : context.args?.args;

    if (!Array.isArray(argsArray) || argsArray.length === 0) {
      return { toolName: this.name, success: false, error: 'Missing args: args (array of limactl command arguments)' };
    }

    // Convert all args to strings (skip first element which is the tool name)
    const args = argsArray.slice(1).map(arg => String(arg));

    // Execute limactl with the provided args
    const res = await runCommand('limactl', args, { timeoutMs: 30_000, maxOutputChars: 160_000 });

    if (res.exitCode !== 0) {
      return {
        toolName: this.name,
        success: false,
        error: res.stderr || res.stdout || `limactl ${args.join(' ')} failed with exit code ${res.exitCode}`,
      };
    }

    return {
      toolName: this.name,
      success: true,
      result: {
        command: `limactl ${args.join(' ')}`,
        output: res.stdout,
        stderr: res.stderr || undefined,
      },
    };
  }
}
