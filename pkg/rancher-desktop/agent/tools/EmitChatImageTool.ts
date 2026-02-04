import type { ThreadState, ToolResult } from '../types';
import type { ToolContext } from './BaseTool';
import { BaseTool } from './BaseTool';
import { getWebSocketClientService } from '../services/WebSocketClientService';
import fs from 'fs';
import os from 'os';
import path from 'path';

function expandHome(inputPath: string): string {
  const p = String(inputPath || '').trim();
  if (!p) {
    return p;
  }

  const home = process.env.HOME || os.homedir();

  if (p === '~') {
    return home;
  }

  if (p.startsWith('~/')) {
    return path.join(home, p.slice(2));
  }

  if (p.startsWith('$HOME/')) {
    return path.join(home, p.slice('$HOME/'.length));
  }

  if (p === '$HOME') {
    return home;
  }

  return p;
}

function guessContentType(filePath: string): string | null {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
  case '.png':
    return 'image/png';
  case '.jpg':
  case '.jpeg':
    return 'image/jpeg';
  case '.gif':
    return 'image/gif';
  case '.webp':
    return 'image/webp';
  case '.svg':
    return 'image/svg+xml';
  default:
    return null;
  }
}

export class EmitChatImageTool extends BaseTool {
  readonly name = 'emit_chat_image';
  readonly category = 'agent';

  getPlanningInstructions(): string {
    return [
      '36) emit_chat_image',
      '- Purpose: Show an image inside the chat transcript during execution.',
      '- args:',
      '  - path (string): Path to an image on disk (.png, .jpg, .gif, .webp, .svg).',
      '  - alt (string, optional): Accessible alt text / caption.',
      '  - role (string, optional): "assistant" | "system". Defaults to "assistant".',
    ].join('\n');
  }

  async execute(state: ThreadState, context: ToolContext): Promise<ToolResult> {
    const args = (context.args && typeof context.args === 'object') ? context.args : {};
    // Support both 'path' and 'image_path' for compatibility
    const rawPath = typeof (args as any).path === 'string' 
      ? String((args as any).path) 
      : (typeof (args as any).image_path === 'string' ? String((args as any).image_path) : '');
    const alt = typeof (args as any).alt === 'string' ? String((args as any).alt) : '';
    const role = typeof (args as any).role === 'string' ? String((args as any).role) : 'assistant';

    // Get connection ID from state metadata or use default
    const connectionId = (state.metadata?.wsConnectionId as string) || 'chat-controller';

    const filePath = expandHome(rawPath);
    if (!filePath) {
      return { toolName: this.name, success: false, error: 'Missing args.path (or args.image_path)' };
    }

    const contentType = guessContentType(filePath);
    if (!contentType) {
      return { toolName: this.name, success: false, error: `Unsupported image type: ${path.extname(filePath) || '(no extension)'}` };
    }

    let buf: Buffer;
    try {
      buf = fs.readFileSync(filePath);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { toolName: this.name, success: false, error: `Failed to read image: ${message}` };
    }

    const base64 = buf.toString('base64');
    const dataUrl = `data:${contentType};base64,${base64}`;

    // Send via WebSocket instead of __emitAgentEvent
    const wsService = getWebSocketClientService();
    wsService.send(connectionId, {
      type: 'chat_image',
      payload: {
        role,
        alt,
        contentType,
        dataUrl,
        path: filePath,
      },
      timestamp: Date.now(),
    });

    return { toolName: this.name, success: true, result: { emitted: true, contentType } };
  }
}
