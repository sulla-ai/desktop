import type { ThreadState, ToolResult } from '../types';
import type { ToolContext } from './BaseTool';
import { BaseTool } from './BaseTool';
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
      'Emit Chat Image (emit_chat_image)',
      '- Purpose: Show an image inside the chat transcript during execution.',
      '- args:',
      '  - path (string): Path to an image on disk (.png, .jpg, .gif, .webp, .svg).',
      '  - alt (string, optional): Accessible alt text / caption.',
      '  - role (string, optional): "assistant" | "system". Defaults to "assistant".',
    ].join('\n');
  }

  async execute(state: ThreadState, context: ToolContext): Promise<ToolResult> {
    const args = (context.args && typeof context.args === 'object') ? context.args : {};
    const rawPath = typeof (args as any).path === 'string' ? String((args as any).path) : '';
    const alt = typeof (args as any).alt === 'string' ? String((args as any).alt) : '';
    const role = typeof (args as any).role === 'string' ? String((args as any).role) : 'assistant';

    const emit = (state.metadata.__emitAgentEvent as ((event: { type: 'progress' | 'chunk' | 'complete' | 'error'; threadId: string; data: unknown }) => void) | undefined);

    const filePath = expandHome(rawPath);
    if (!filePath) {
      return { toolName: this.name, success: false, error: 'Missing args.path' };
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

    emit?.({
      type: 'progress',
      threadId: state.threadId,
      data: {
        phase: 'chat_image',
        role,
        alt,
        contentType,
        dataUrl,
        path: filePath,
      },
    });

    return { toolName: this.name, success: true, result: { emitted: true, contentType } };
  }
}
