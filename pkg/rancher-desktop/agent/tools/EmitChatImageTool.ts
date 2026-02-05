import type { ThreadState, ToolResult } from '../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import { getWebSocketClientService } from '../services/WebSocketClientService';
import fs from 'fs';
import os from 'os';
import path from 'path';

function expandHome(inputPath: string): string {
  const p = String(inputPath || '').trim();
  if (!p) return p;

  const home = process.env.HOME || os.homedir();

  if (p === '~' || p === '$HOME') return home;
  if (p.startsWith('~/')) return path.join(home, p.slice(2));
  if (p.startsWith('$HOME/')) return path.join(home, p.slice(6));

  return p;
}

export class EmitChatImageTool extends BaseTool {
  override readonly name = 'emit_chat_image';

  override getPlanningInstructions(): string {
    return `["emit_chat_image", "/path/to/image.png"] - Display image via file path or URL

Examples:
["emit_chat_image", "~/screenshots/lead-form.png", "--alt", "Lead capture form"]
["emit_chat_image", "https://example.com/chart.png", "--alt", "Conversion trend"]
["emit_chat_image", "/tmp/report.jpg", "--alt", "Results", "--role", "assistant"]
`.trim();
  }

  override async execute(state: ThreadState, context: ToolContext): Promise<ToolResult> {
    const helpResult = await this.handleHelpRequest(context);
    if (helpResult) return helpResult;

    const args = this.getArgsArray(context);
    if (!args.length) {
      return { toolName: this.name, success: false, error: 'Missing path or URL' };
    }

    const rawSrc = args[0].trim();
    const params = this.argsToObject(args.slice(1));

    const alt   = (params.alt   as string) || '';
    const role  = (params.role  as string) || 'assistant';

    let src = rawSrc;
    let isLocal = false;

    // Normalize local paths
    if (!rawSrc.startsWith('http://') && !rawSrc.startsWith('https://')) {
      src = expandHome(rawSrc);
      isLocal = true;

      // Add file:// prefix for local paths
      if (!src.startsWith('file://')) {
        src = `file://${src}`;
      }

      // Optional: existence check
      if (!fs.existsSync(src.replace('file://', ''))) {
        return { toolName: this.name, success: false, error: `File not found: ${src}` };
      }
    }

    const connectionId = (state.metadata?.wsConnectionId as string) || 'chat-controller';

    const wsService = getWebSocketClientService();
    wsService.send(connectionId, {
      type: 'chat_image',
      data: {
        role,
        alt,
        src,                // ← frontend uses this directly in <img src={src}>
        isLocal,            // optional hint if frontend needs special handling
        path: isLocal ? src : undefined,
      },
      timestamp: Date.now(),
    });

    return {
      toolName: this.name,
      success: true,
      result: { emitted: true, src, alt, isLocal },
    };
  }
}