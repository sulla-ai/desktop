import type { ThreadState, ToolResult } from '../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import fs from 'fs';
import os from 'os';
import path from 'path';

type ImageFormat = 'png' | 'jpeg' | 'gif' | 'webp' | 'unknown';

function readUInt16LE(buf: Buffer, offset: number): number {
  return buf.readUInt16LE(offset);
}

function readUInt16BE(buf: Buffer, offset: number): number {
  return buf.readUInt16BE(offset);
}

function readUInt32BE(buf: Buffer, offset: number): number {
  return buf.readUInt32BE(offset);
}

function parsePng(buf: Buffer): { format: ImageFormat; width: number; height: number } | null {
  if (buf.length < 24) {
    return null;
  }
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!buf.subarray(0, 8).equals(sig)) {
    return null;
  }
  const chunkType = buf.subarray(12, 16).toString('ascii');
  if (chunkType !== 'IHDR') {
    return null;
  }
  const width = readUInt32BE(buf, 16);
  const height = readUInt32BE(buf, 20);
  return { format: 'png', width, height };
}

function parseGif(buf: Buffer): { format: ImageFormat; width: number; height: number } | null {
  if (buf.length < 10) {
    return null;
  }
  const header = buf.subarray(0, 6).toString('ascii');
  if (header !== 'GIF87a' && header !== 'GIF89a') {
    return null;
  }
  const width = readUInt16LE(buf, 6);
  const height = readUInt16LE(buf, 8);
  return { format: 'gif', width, height };
}

function parseWebp(buf: Buffer): { format: ImageFormat; width: number; height: number } | null {
  if (buf.length < 30) {
    return null;
  }
  if (buf.subarray(0, 4).toString('ascii') !== 'RIFF') {
    return null;
  }
  if (buf.subarray(8, 12).toString('ascii') !== 'WEBP') {
    return null;
  }
  const chunk = buf.subarray(12, 16).toString('ascii');

  if (chunk === 'VP8X') {
    if (buf.length < 30) {
      return null;
    }
    const w = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16));
    const h = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16));
    return { format: 'webp', width: w, height: h };
  }

  if (chunk === 'VP8 ') {
    const start = 20;
    if (buf.length < start + 10) {
      return null;
    }
    if (buf[start + 3] !== 0x9d || buf[start + 4] !== 0x01 || buf[start + 5] !== 0x2a) {
      return null;
    }
    const width = readUInt16LE(buf, start + 6) & 0x3fff;
    const height = readUInt16LE(buf, start + 8) & 0x3fff;
    return { format: 'webp', width, height };
  }

  return { format: 'webp', width: 0, height: 0 };
}

function parseJpeg(buf: Buffer): { format: ImageFormat; width: number; height: number } | null {
  if (buf.length < 4) {
    return null;
  }
  if (buf[0] !== 0xff || buf[1] !== 0xd8) {
    return null;
  }

  let offset = 2;
  while (offset + 4 <= buf.length) {
    if (buf[offset] !== 0xff) {
      offset++;
      continue;
    }

    while (offset < buf.length && buf[offset] === 0xff) {
      offset++;
    }
    if (offset >= buf.length) {
      break;
    }

    const marker = buf[offset];
    offset++;

    if (marker === 0xd9 || marker === 0xda) {
      break;
    }

    if (offset + 2 > buf.length) {
      break;
    }
    const len = readUInt16BE(buf, offset);
    if (len < 2) {
      break;
    }

    const segmentStart = offset + 2;
    const segmentEnd = offset + len;
    if (segmentEnd > buf.length) {
      break;
    }

    const isSOF =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);

    if (isSOF) {
      if (segmentStart + 7 > buf.length) {
        break;
      }
      const height = readUInt16BE(buf, segmentStart + 1);
      const width = readUInt16BE(buf, segmentStart + 3);
      return { format: 'jpeg', width, height };
    }

    offset = segmentEnd;
  }

  return { format: 'jpeg', width: 0, height: 0 };
}

function detectImage(buf: Buffer): { format: ImageFormat; width: number; height: number } {
  return (
    parsePng(buf) ||
    parseGif(buf) ||
    parseWebp(buf) ||
    parseJpeg(buf) ||
    { format: 'unknown', width: 0, height: 0 }
  );
}

export class HostImageMetadataTool extends BaseTool {
  override readonly name = 'host_image_metadata';
  override readonly category = 'host_fs';
  override readonly aliases = ['image_metadata', 'get_image_metadata'];

  override getPlanningInstructions(): string {
    return [
      '34) host_image_metadata (Host filesystem)',
      '   - Purpose: Read basic image metadata for a local file (format + dimensions).',
      '   - Args:',
      '     - path (string, required) absolute path or ~/path',
      '   - Output: format, width, height, file size, mtime.',
    ].join('\n');
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
    return raw;
  }

  override async execute(_state: ThreadState, context: ToolContext): Promise<ToolResult> {
    const p = this.expandPath(String(context.args?.path || ''));
    if (!p) {
      return { toolName: this.name, success: false, error: 'Missing args: path' };
    }

    let st: fs.Stats;
    try {
      st = fs.statSync(p);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { toolName: this.name, success: false, error: msg };
    }

    if (!st.isFile()) {
      return { toolName: this.name, success: false, error: 'Path is not a file' };
    }

    let buf: Buffer;
    try {
      buf = fs.readFileSync(p);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { toolName: this.name, success: false, error: msg };
    }

    const meta = detectImage(buf);
    return {
      toolName: this.name,
      success: true,
      result: {
        path: p,
        format: meta.format,
        width: meta.width,
        height: meta.height,
        sizeBytes: st.size,
        mtimeMs: st.mtimeMs,
      },
    };
  }
}
