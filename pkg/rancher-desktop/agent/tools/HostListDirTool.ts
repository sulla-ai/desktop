import type { ThreadState, ToolResult } from '../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import fs from 'fs';
import os from 'os';
import path from 'path';

export class HostListDirTool extends BaseTool {
  override readonly name = 'host_list_dir';
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
    if (raw.startsWith('$HOME/')) {
      return path.join(home, raw.slice('$HOME/'.length));
    }
    if (raw === '$HOME') {
      return home;
    }
    return raw;
  }

  override getPlanningInstructions(): string {
    return [
      '27) host_list_dir (Host filesystem)',
      '   - Purpose: List files/directories on the host.',
      '   - Args:',
      '     - path (string, required)',
      '     - limit (number, optional, default 200)',
      '   - Output: Entry names and basic stats.',
    ].join('\n');
  }

  override async execute(_state: ThreadState, context: ToolContext): Promise<ToolResult> {
    const p = this.expandPath(String(context.args?.path || ''));
    const limit = Number(context.args?.limit ?? 200);

    if (!p) {
      return { toolName: this.name, success: false, error: 'Missing args: path' };
    }

    try {
      const entries = fs.readdirSync(p, { withFileTypes: true });
      const out = entries.slice(0, Number.isFinite(limit) ? limit : 200).map(e => {
        const full = path.join(p, e.name);
        let size: number | undefined;
        let mtimeMs: number | undefined;
        try {
          const st = fs.statSync(full);
          size = st.isFile() ? st.size : undefined;
          mtimeMs = st.mtimeMs;
        } catch {
          // ignore
        }
        return {
          name: e.name,
          type: e.isDirectory() ? 'directory' : (e.isFile() ? 'file' : 'other'),
          size,
          mtimeMs,
        };
      });

      return { toolName: this.name, success: true, result: { path: p, count: entries.length, entries: out } };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { toolName: this.name, success: false, error: msg };
    }
  }
}
