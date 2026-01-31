import type { ThreadState, ToolResult } from '../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import fs from 'fs';

export class HostStatTool extends BaseTool {
  override readonly name = 'host_stat';
  override readonly category = 'host_fs';
  override readonly aliases = ['stat', 'file_stat', 'host_file_stat', 'check_file'];

  override getPlanningInstructions(): string {
    return [
      '30) host_stat (Host filesystem)',
      '   - Purpose: Stat a host path (file or directory).',
      '   - Args:',
      '     - path (string, required)',
      '   - Output: type, size, times.',
    ].join('\n');
  }

  override async execute(_state: ThreadState, context: ToolContext): Promise<ToolResult> {
    const p = String(context.args?.path || '');
    if (!p) {
      return { toolName: this.name, success: false, error: 'Missing args: path' };
    }

    try {
      const st = fs.statSync(p);
      return {
        toolName: this.name,
        success: true,
        result: {
          path: p,
          isFile: st.isFile(),
          isDirectory: st.isDirectory(),
          size: st.size,
          mtimeMs: st.mtimeMs,
          ctimeMs: st.ctimeMs,
        },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { toolName: this.name, success: false, error: msg };
    }
  }
}
