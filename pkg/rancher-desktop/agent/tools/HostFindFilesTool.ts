import type { ThreadState, ToolResult } from '../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import { runCommand } from './CommandRunner';
import os from 'os';
import path from 'path';

export class HostFindFilesTool extends BaseTool {
  override readonly name = 'host_find_files';
  override readonly category = 'host_fs';

  private expandPath(input: string): string {
    const raw = String(input || '');
    if (!raw) {
      return raw;
    }
    const home = os.homedir();
    if (raw === '~') {
      return home;
    }
    if (raw.startsWith('~/')) {
      return path.join(home, raw.slice(2));
    }
    return raw;
  }

  override getPlanningInstructions(): string {
    return [
      '31) host_find_files (Host filesystem)',
      '   - Purpose: Find files by name under a directory on the host.',
      '   - Args:',
      '     - path (string, required) root directory',
      '     - pattern (string, required) glob-like name pattern (e.g. "*.log")',
      '     - maxDepth (number, optional)',
      '     - limit (number, optional, default 200)',
      '   - Output: matching paths (limited).',
    ].join('\n');
  }

  override async execute(_state: ThreadState, context: ToolContext): Promise<ToolResult> {
    const rootRaw = String(
      context.args?.path
      ?? (context.args as any)?.SearchDirectory
      ?? (context.args as any)?.searchDirectory
      ?? (context.args as any)?.search_path
      ?? '',
    );
    const patternRaw = String(
      context.args?.pattern
      ?? (context.args as any)?.Pattern
      ?? (context.args as any)?.pattern
      ?? '',
    );
    const maxDepth = context.args?.maxDepth !== undefined ? Number(context.args.maxDepth) : undefined;
    const limit = Number(context.args?.limit ?? 200);

    // Be forgiving: planners sometimes omit args; default to searching the user's home directory.
    // This avoids hard failures that stall the agent.
    const root = this.expandPath(rootRaw || '~');
    const pattern = patternRaw || '*';

    const args: string[] = [root];
    if (maxDepth !== undefined && Number.isFinite(maxDepth)) {
      args.push('-maxdepth', String(maxDepth));
    }
    // Avoid common macOS protected directories that can cause "Operation not permitted".
    // We prune these so the rest of the search can still succeed.
    args.push(
      '(',
      '-path', '*/.Trash', '-o',
      '-path', '*/.Trash/*', '-o',
      '-path', '*/Library/Mobile Documents', '-o',
      '-path', '*/Library/Mobile Documents/*',
      ')',
      '-prune',
      '-o',
    );
    args.push('-name', pattern, '-print');

    const res = await runCommand('find', args, { timeoutMs: 20_000, maxOutputChars: 200_000 });
    const lines = res.stdout.split('\n').filter(Boolean);
    const n = Number.isFinite(limit) ? limit : 200;
    const matches = lines.slice(0, n);

    // find returns exit code 1 for some permission errors (stderr), even if it produced valid results.
    // If we have matches, treat it as success and surface stderr as a warning.
    if (res.exitCode !== 0 && matches.length === 0) {
      return { toolName: this.name, success: false, error: res.stderr || res.stdout || 'find failed' };
    }

    return {
      toolName: this.name,
      success: true,
      result: {
        root,
        pattern,
        count: lines.length,
        matches,
        warning: res.exitCode !== 0 ? (res.stderr || 'find returned a non-zero exit code (likely permission errors)') : undefined,
      },
    };
  }
}
