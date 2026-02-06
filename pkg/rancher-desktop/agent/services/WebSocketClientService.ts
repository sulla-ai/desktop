// WebSocketClientService.ts - Fixed version (all TS errors resolved)

export interface WebSocketMessage {
  type: string;
  data: unknown;
  id: string;
  originalId?: string;
  timestamp: number;
  channel?: string;
}

export type WebSocketMessageHandler = (message: WebSocketMessage) => void;

interface ConnectionConfig {
  url: string;
  channel?: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  ackTimeout?: number;
  maxMessageAgeMs?: number;
}

const DEFAULT_WS_URL = 'ws://localhost:30118/';

function generateUUID(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    // Fallback random fill
    for (let i = 0; i < 16; i++) {
      bytes[i] = (Math.random() * 256) | 0;
    }
  }

  // Set version 4 bits
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  // Set variant bits
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
}

class WebSocketConnection {
  public ws: WebSocket | null = null;
  public pending = new Map<string, {
    message: WebSocketMessage;
    queuedAt: number;
    firstSentAt: number;
    lastSentAt?: number;
    attempts: number;
    timeoutTimer?: NodeJS.Timeout;
  }>();
  public heartbeatTimer: NodeJS.Timeout | null = null;
  public reconnectTimer: NodeJS.Timeout | null = null;
  public reconnectAttempts = 0;
  public messageHandlers = new Set<WebSocketMessageHandler>();
  public subscribed = new Set<string>();

  private config: Required<ConnectionConfig>;

  constructor(config: ConnectionConfig) {
    this.config = {
      ...config,  // user overrides come first
      url: config.url,
      channel: config.channel || '',
      reconnectInterval: 4000,
      maxReconnectAttempts: 12,
      ackTimeout: 9000,
      maxMessageAgeMs: 240_000,
    };
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) return;

    this.cleanup();

    try {
      this.ws = new WebSocket(this.config.url);

      this.ws.onopen = () => {
        console.log(`[WS ${this.config.channel}] Connected`);
        this.reconnectAttempts = 0;
        if (this.config.channel && !this.subscribed.has(this.config.channel)) {
          this.sendNow({
            type: 'subscribe',
            data: null,                    // required field
            channel: this.config.channel,
            id: generateUUID(),
            timestamp: Date.now()
          });
          this.subscribed.add(this.config.channel);
        }
        this.startHeartbeat();
        this.retryPending();
      };

      this.ws.onmessage = async (event) => {
        let text = event.data instanceof Blob ? await event.data.text() : event.data as string;
        let msg: WebSocketMessage;

        try {
          msg = JSON.parse(text);
        } catch {
          const fallbackIdMatch = text.match(/"id":"([a-f0-9-]+)"/i);
          if (fallbackIdMatch) this.ack(fallbackIdMatch[1]);
          return;
        }

        if (msg.type === 'ack' && msg.originalId) {
          this.clearPending(msg.originalId);
          return;
        }

        if (msg.id) this.ack(msg.id);

        this.messageHandlers.forEach(h => {
          try { h(msg); } catch (e) { console.error('[WS handler error]', e); }
        });
      };

      this.ws.onerror = () => this.scheduleReconnect();
      this.ws.onclose = () => this.scheduleReconnect();
    } catch {
      this.scheduleReconnect();
    }
  }

  private ack(originalId: string) {
    this.sendNow({
      type: 'ack',
      originalId,
      data: null,
      id: generateUUID(),
      timestamp: Date.now(),
      channel: this.config.channel
    });
  }

  private sendNow(msg: WebSocketMessage) {
    if (this.isConnected()) {
      try { this.ws!.send(JSON.stringify(msg)); } catch {}
    }
  }

  private clearPending(id: string) {
    const entry = this.pending.get(id);
    if (entry?.timeoutTimer) clearTimeout(entry.timeoutTimer);
    this.pending.delete(id);
  }

  private cleanup() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.heartbeatTimer = this.reconnectTimer = null;
    this.ws?.close();
    this.ws = null;
  }

  private scheduleReconnect() {
    this.cleanup();

    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.warn(`[WS ${this.config.channel}] Max reconnect attempts reached`);
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(this.config.reconnectInterval * (1.618 ** this.reconnectAttempts) + Math.random() * 600, 45000);
    console.log(`[WS ${this.config.channel}] Reconnect attempt ${this.reconnectAttempts} in ${Math.round(delay/1000)}s`);
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  private startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected()) {
        this.sendNow({ type: 'ping', data: null, id: generateUUID(), timestamp: Date.now() });
      }
    }, 30000);
  }

  private retryPending() {
    if (!this.isConnected()) return;

    const now = Date.now();
    for (const [id, entry] of [...this.pending.entries()]) {
      if (now - entry.queuedAt > this.config.maxMessageAgeMs) {
        console.warn(`[WS ${this.config.channel}] Dropping aged message ${id} (age ${(now - entry.queuedAt)/1000|0}s)`);
        this.pending.delete(id);
        continue;
      }

      if (entry.timeoutTimer) continue;

      try {
        this.ws!.send(JSON.stringify(entry.message));
        entry.lastSentAt = now;
        entry.attempts++;

        entry.timeoutTimer = setTimeout(() => {
          entry.timeoutTimer = undefined;
          if (this.isConnected()) this.retryPending();
        }, this.config.ackTimeout * (1.5 ** Math.min(entry.attempts, 7)));

        if (entry.attempts >= 8 && this.pending.size > 12) {
          console.warn(`[WS ${this.config.channel}] Emergency reconnect - ${this.pending.size} pending, high retry`);
          this.scheduleReconnect();
          return;
        }
      } catch {}
    }
  }

  send(message: Omit<WebSocketMessage, 'timestamp'> & { id?: string }): void {
    const fullMsg: WebSocketMessage = {
      ...message,
      id: message.id ?? generateUUID(),
      timestamp: Date.now(),
      channel: message.channel ?? this.config.channel
    };

    if (this.pending.has(fullMsg.id)) return;

    this.pending.set(fullMsg.id, {
      message: fullMsg,
      queuedAt: Date.now(),
      firstSentAt: 0,
      attempts: 0
    });

    if (this.isConnected()) this.retryPending();
  }

  onMessage(handler: WebSocketMessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  disconnect(): void {
    this.cleanup();
    this.pending.clear();
    this.subscribed.clear();
    this.reconnectAttempts = 0;
  }
}

export class WebSocketClientService {
  private connections: Map<string, WebSocketConnection> = new Map();
  private static instance: WebSocketClientService | null = null;

  static getInstance() {
    return this.instance ??= new WebSocketClientService();
  }

  connect(connectionId: string, url: string = DEFAULT_WS_URL): boolean {
    let conn = this.connections.get(connectionId);
    if (conn) {
      if (conn.isConnected()) return true;
      conn.disconnect();
    }

    conn = new WebSocketConnection({ url, channel: connectionId });
    this.connections.set(connectionId, conn);
    conn.connect();
    return true;
  }

  send(connectionId: string, message: unknown): boolean {
    const conn = this.connections.get(connectionId);
    if (!conn) return false;

    if (typeof message === 'object' && message && 'type' in message) {
      conn.send(message as any);
    } else {
      conn.send({
        type: 'message',
        data: message,
        id: generateUUID()
      });
    }
    return true;
  }

  onMessage(connectionId: string, handler: WebSocketMessageHandler): (() => void) | null {
    return this.connections.get(connectionId)?.onMessage(handler) ?? null;
  }

  isConnected(connectionId: string): boolean {
    return this.connections.get(connectionId)?.isConnected() ?? false;
  }

  disconnect(connectionId: string): void {
    this.connections.get(connectionId)?.disconnect();
    this.connections.delete(connectionId);
  }

  disconnectAll(): void {
    this.connections.forEach(c => c.disconnect());
    this.connections.clear();
  }

  getPendingCount(connectionId: string): number {
    return this.connections.get(connectionId)?.pending.size ?? 0;
  }
}

export const getWebSocketClientService = WebSocketClientService.getInstance;