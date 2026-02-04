// WebSocketClientService - Manages WebSocket connections for agent nodes
// Provides singleton pattern for shared connections across nodes

export interface WebSocketMessage {
  type: string;
  data: unknown;
  timestamp?: number;
}

export type WebSocketMessageHandler = (message: WebSocketMessage) => void;

interface ConnectionConfig {
  url: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

const DEFAULT_WS_URL = 'ws://localhost:30118/';

class WebSocketConnection {
  private ws: WebSocket | null = null;
  private config: ConnectionConfig;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private messageHandlers: Set<WebSocketMessageHandler> = new Set();
  private isConnecting = false;

  constructor(config: ConnectionConfig) {
    this.config = {
      reconnectInterval: 5000,
      maxReconnectAttempts: 10,
      ...config,
    };
  }

  connect(): void {
    if (this.isConnecting || this.ws?.readyState === WebSocket.CONNECTING) {
      console.log(`[WebSocket] Already connecting to ${this.config.url}`);
      return;
    }

    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log(`[WebSocket] Already connected to ${this.config.url}`);
      return;
    }

    this.isConnecting = true;
    console.log(`[WebSocket] Initializing connection to ${this.config.url}...`);

    try {
      this.ws = new WebSocket(this.config.url);

      this.ws.onopen = () => {
        console.log(`[WebSocket] Connected to ${this.config.url}`);
        this.isConnecting = false;
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        console.log(`[WebSocket] Message received:`, event.data);
        try {
          const data = JSON.parse(event.data) as WebSocketMessage;
          console.log(`[WebSocket] Parsed message type: ${data.type}`);
          this.messageHandlers.forEach((handler) => {
            try {
              handler(data);
            } catch (err) {
              console.error('[WebSocket] Message handler error:', err);
            }
          });
        } catch (parseErr) {
          console.warn('[WebSocket] Failed to parse message as JSON, wrapping as raw:', parseErr);
          const msg: WebSocketMessage = {
            type: 'raw',
            data: event.data,
            timestamp: Date.now(),
          };
          this.messageHandlers.forEach((handler) => {
            try {
              handler(msg);
            } catch (err) {
              console.error('[WebSocket] Message handler error:', err);
            }
          });
        }
      };

      this.ws.onerror = (error) => {
        console.error(`[WebSocket] Connection error:`, error);
        this.isConnecting = false;
      };

      this.ws.onclose = (event) => {
        console.log(`[WebSocket] Disconnected from ${this.config.url} (code: ${event.code}, wasClean: ${event.wasClean})`);
        this.isConnecting = false;
        this.attemptReconnect();
      };
    } catch (err) {
      console.error(`[WebSocket] Failed to create connection:`, err);
      this.isConnecting = false;
      this.attemptReconnect();
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= (this.config.maxReconnectAttempts || 10)) {
      console.error(`[WebSocket] Max reconnect attempts reached for ${this.config.url}`);
      return;
    }

    this.reconnectAttempts++;
    console.log(`[WebSocket] Auto-reconnect scheduled in ${this.config.reconnectInterval}ms (attempt ${this.reconnectAttempts}/${this.config.maxReconnectAttempts || 10})`);

    this.reconnectTimer = setTimeout(() => {
      console.log(`[WebSocket] Attempting reconnect...`);
      this.connect();
    }, this.config.reconnectInterval);
  }

  disconnect(): void {
    console.log(`[WebSocket] Disconnecting from ${this.config.url}`);
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
      console.log('[WebSocket] Cleared reconnect timer');
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
      console.log('[WebSocket] Connection closed');
    }

    this.messageHandlers.clear();
    this.reconnectAttempts = 0;
    console.log('[WebSocket] Disconnected and cleaned up');
  }

  send(message: unknown): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[WebSocket] Cannot send - not connected');
      return false;
    }

    try {
      const data = typeof message === 'string' ? message : JSON.stringify(message);
      console.log(`[WebSocket] Sending message:`, data.substring(0, 200) + (data.length > 200 ? '...' : ''));
      this.ws.send(data);
      console.log('[WebSocket] Message sent successfully');
      return true;
    } catch (err) {
      console.error('[WebSocket] Send error:', err);
      return false;
    }
  }

  onMessage(handler: WebSocketMessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export class WebSocketClientService {
  private connections: Map<string, WebSocketConnection> = new Map();
  private static instance: WebSocketClientService | null = null;

  static getInstance(): WebSocketClientService {
    if (!WebSocketClientService.instance) {
      WebSocketClientService.instance = new WebSocketClientService();
    }
    return WebSocketClientService.instance;
  }

  /**
   * Connect to a WebSocket endpoint
   * @param connectionId Unique identifier for this connection
   * @param url WebSocket URL (defaults to ws://localhost:8080/)
   * @returns true if connection initiated
   */
  connect(connectionId: string, url: string = DEFAULT_WS_URL): boolean {
    console.log(`[WebSocket] Service connect called for connectionId: ${connectionId}, url: ${url}`);
    if (this.connections.has(connectionId)) {
      const conn = this.connections.get(connectionId);
      if (conn?.isConnected()) {
        console.log(`[WebSocket] Connection ${connectionId} already exists and is connected`);
        return true;
      }
      console.log(`[WebSocket] Connection ${connectionId} exists but not connected, recreating...`);
    }

    const connection = new WebSocketConnection({ url });
    this.connections.set(connectionId, connection);
    connection.connect();

    return true;
  }

  /**
   * Disconnect from a WebSocket endpoint
   * @param connectionId Connection identifier
   */
  disconnect(connectionId: string): void {
    console.log(`[WebSocket] Service disconnect called for connectionId: ${connectionId}`);
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.disconnect();
      this.connections.delete(connectionId);
      console.log(`[WebSocket] Connection ${connectionId} removed from service`);
    } else {
      console.warn(`[WebSocket] No connection found for ${connectionId}`);
    }
  }

  /**
   * Send a message to a WebSocket connection
   * @param connectionId Connection identifier
   * @param message Message to send (object or string)
   * @returns true if sent successfully
   */
  send(connectionId: string, message: unknown): boolean {
    console.log(`[WebSocket] Service send called for connectionId: ${connectionId}`);
    const connection = this.connections.get(connectionId);
    if (!connection) {
      console.warn(`[WebSocket] No connection found for ${connectionId}, cannot send`);
      return false;
    }
    return connection.send(message);
  }

  /**
   * Register a message handler for a connection
   * @param connectionId Connection identifier
   * @param handler Callback function for incoming messages
   * @returns Unsubscribe function
   */
  onMessage(connectionId: string, handler: WebSocketMessageHandler): (() => void) | null {
    console.log(`[WebSocket] Service onMessage called for connectionId: ${connectionId}`);
    const connection = this.connections.get(connectionId);
    if (!connection) {
      console.warn(`[WebSocket] No connection found for ${connectionId}, cannot register handler`);
      return null;
    }
    console.log(`[WebSocket] Registered message handler for ${connectionId}`);
    return connection.onMessage(handler);
  }

  /**
   * Check if a connection is active
   * @param connectionId Connection identifier
   */
  isConnected(connectionId: string): boolean {
    const connection = this.connections.get(connectionId);
    return connection?.isConnected() ?? false;
  }

  /**
   * Get all active connection IDs
   */
  getActiveConnections(): string[] {
    return Array.from(this.connections.entries())
      .filter(([, conn]) => conn.isConnected())
      .map(([id]) => id);
  }

  /**
   * Disconnect all connections
   */
  disconnectAll(): void {
    this.connections.forEach((connection) => {
      connection.disconnect();
    });
    this.connections.clear();
  }
}

// Singleton export
export const getWebSocketClientService = WebSocketClientService.getInstance;
