import type { ThreadState, ToolResult } from '../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import fs from 'fs';
import os from 'os';
import path from 'path';

export class HostListDirTool extends BaseTool {
  override readonly name = 'host_list_dir';
  override readonly category = 'host_fs';
  override readonly aliases = ['list_directory', 'list_dir'];

  private hasGlob(p: string): boolean {
    return /[*?\[]/.test(p);
  }

  private globSegmentToRegExp(seg: string): RegExp {
    const escaped = seg.replace(/[.+^${}()|\\]/g, '\\$&');
    const pattern = `^${escaped.replace(/\*/g, '.*').replace(/\?/g, '.')}$`;
    return new RegExp(pattern);
  }

  private expandSimpleGlobPaths(inputPath: string): string[] {
    // Minimal glob support for common cases like /Users/*/Pictures.
    // Supports '*', '?', and basic character classes in a single path segment.
    if (!this.hasGlob(inputPath)) {
      return [inputPath];
    }

    const isAbs = path.isAbsolute(inputPath);
    const parts = inputPath.split('/').filter(Boolean);
    let roots: string[] = [isAbs ? '/' : process.cwd()];

    for (const seg of parts) {
      const next: string[] = [];
      const isGlobSeg = /[*?\[]/.test(seg);

      for (const base of roots) {
        if (!isGlobSeg) {
          next.push(path.join(base, seg));
          continue;
        }

        let entries: fs.Dirent[] = [];
        try {
          entries = fs.readdirSync(base, { withFileTypes: true });
        } catch {
          continue;
        }

        const re = this.globSegmentToRegExp(seg);
        for (const e of entries) {
          if (!re.test(e.name)) {
            continue;
          }
          next.push(path.join(base, e.name));
        }
      }

      roots = next;
      if (roots.length === 0) {
        break;
      }
    }

    return roots;
  }

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
      const expanded = this.expandSimpleGlobPaths(p);

      // If the path was a glob and expanded to multiple directories, return the matching paths.
      // This lets the planner pick the right concrete directory for a follow-up host_list_dir.
      if (this.hasGlob(p) && expanded.length !== 1) {
        const out = expanded.slice(0, 200).map(full => {
          let type: 'directory' | 'file' | 'other' = 'other';
          try {
            const st = fs.statSync(full);
            type = st.isDirectory() ? 'directory' : (st.isFile() ? 'file' : 'other');
          } catch {
            // ignore
          }
          return { name: full, type };
        });
        return { toolName: this.name, success: true, result: { path: p, expandedCount: expanded.length, entries: out } };
      }

      const concrete = expanded[0] || p;
      const entries = fs.readdirSync(concrete, { withFileTypes: true });
      const out = entries.slice(0, Number.isFinite(limit) ? limit : 200).map(e => {
        const full = path.join(concrete, e.name);
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

      return { toolName: this.name, success: true, result: { path: concrete, count: entries.length, entries: out } };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { toolName: this.name, success: false, error: msg };
    }
  }
}
