import type { ThreadState, ToolResult } from '../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import { runCommand } from './util/CommandRunner';

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
    const helpResult = await this.handleHelpRequest(context);
    if (helpResult) {
      return helpResult;
    }
    
    // Handle exec form: args is string array directly
    const argsArray = this.getArgsArray(context);

    if (!Array.isArray(argsArray) || argsArray.length === 0) {
      return { toolName: this.name, success: false, error: 'Missing args: args (array of limactl command arguments)' };
    }

    // Execute limactl with the provided args
    const res = await runCommand('limactl', argsArray, { timeoutMs: 30_000, maxOutputChars: 160_000 });

    if (res.exitCode !== 0) {
      return {
        toolName: this.name,
        success: false,
        error: res.stderr || res.stdout || `limactl ${argsArray.join(' ')} failed with exit code ${res.exitCode}`,
      };
    }

    return {
      toolName: this.name,
      success: true,
      result: {
        command: `limactl ${argsArray.join(' ')}`,
        output: res.stdout,
        stderr: res.stderr || undefined,
      },
    };
  }
}
