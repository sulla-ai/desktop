// RedisClient.ts
// Singleton wrapper around ioredis for clean, consistent access
// Mirrors ChromaClient/PostgresClient structure

import Redis from 'ioredis';

const REDIS_URL = 'redis://127.0.0.1:30117';

export class RedisClient {
  private client: Redis;
  private connected = false;
  private connectionAttempts = 0;
  private maxConnectionAttempts = 10;
  private connectionRetryDelay = 2000;

  constructor() {
    this.client = new Redis(REDIS_URL, {
      retryStrategy: times => Math.min(times * 50, 2000),
      maxRetriesPerRequest: 3,
      lazyConnect: true, // Don't auto-connect on construction
    });

    this.client.on('connect', () => {
      this.connected = true;
      this.connectionAttempts = 0;
      console.log('[RedisClient] Connected');
    });

    this.client.on('error', err => {
      this.connected = false;
      // Reduce error verbosity for common startup errors
      if ((err as any).code === 'ECONNREFUSED' || (err as any).code === 'EPIPE' || (err as any).code === 'ECONNRESET') {
        console.log(`[RedisClient] Connection error (${(err as any).code}): Redis server not available yet`);
      } else {
        console.error('[RedisClient] Error:', err);
      }
    });

    this.client.on('close', () => {
      this.connected = false;
      console.log('[RedisClient] Connection closed');
    });
  }

  /**
   * Get the underlying ioredis instance
   */
  getClient(): Redis {
    return this.client;
  }

  /**
   * Initialize and test connection
   */
  async initialize(): Promise<boolean> {
    if (this.connected) return true;

    // Stop trying if we've exceeded max attempts
    if (this.connectionAttempts >= this.maxConnectionAttempts) {
      console.log(`[RedisClient] Max connection attempts (${this.maxConnectionAttempts}) reached, giving up`);
      return false;
    }

    try {
      await this.client.ping();
      this.connected = true;
      this.connectionAttempts = 0; // Reset on successful connection
      return true;
    } catch (error) {
      this.connectionAttempts++;
      console.log(`[RedisClient] Connection attempt ${this.connectionAttempts}/${this.maxConnectionAttempts} failed`);
      this.connected = false;
      return false;
    }
  }

  // Core commands with auto-init + error handling
  async set(key: string, value: string | number | Buffer, ttlSeconds?: number): Promise<'OK'> {
    await this.ensureConnected();
    return ttlSeconds
      ? this.client.set(key, value, 'EX', ttlSeconds)
      : this.client.set(key, value);
  }

  async get(key: string): Promise<string | null> {
    await this.ensureConnected();
    return this.client.get(key);
  }

  async del(keys: string | string[]): Promise<number> {
    await this.ensureConnected();
    return Array.isArray(keys)
      ? this.client.del(...keys)
      : this.client.del(keys);
  }

  async incr(key: string): Promise<number> {
    await this.ensureConnected();
    return this.client.incr(key);
  }

  async decr(key: string): Promise<number> {
    await this.ensureConnected();
    return this.client.decr(key);
  }

  async expire(key: string, seconds: number): Promise<number> {
    await this.ensureConnected();
    return this.client.expire(key, seconds);
  }

  async ttl(key: string): Promise<number> {
    await this.ensureConnected();
    return this.client.ttl(key);
  }

  // Hash commands
  async hset(key: string, field: string, value: string): Promise<number> {
    await this.ensureConnected();
    return this.client.hset(key, field, value);
  }

  async hget(key: string, field: string): Promise<string | null> {
    await this.ensureConnected();
    return this.client.hget(key, field);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    await this.ensureConnected();
    return this.client.hgetall(key);
  }

  // List commands
  async rpush(key: string, ...values: string[]): Promise<number> {
    await this.ensureConnected();
    return this.client.rpush(key, ...values);
  }

  async lpop(key: string): Promise<string | null> {
    await this.ensureConnected();
    return this.client.lpop(key);
  }

  // Pub/Sub
  async publish(channel: string, message: string): Promise<number> {
    await this.ensureConnected();
    return this.client.publish(channel, message);
  }

  // Close connection (call on shutdown)
  async close(): Promise<void> {
    if (this.connected) {
      await this.client.quit();
      this.connected = false;
    }
  }

  private async ensureConnected(): Promise<void> {
    if (!this.connected) {
      const ok = await this.initialize();
      if (!ok) {
        if (this.connectionAttempts >= this.maxConnectionAttempts) {
          throw new Error(`Redis not connected after ${this.maxConnectionAttempts} attempts`);
        } else {
          throw new Error('Redis server not available yet');
        }
      }
    }
  }
}

// Singleton
export const redisClient = new RedisClient();