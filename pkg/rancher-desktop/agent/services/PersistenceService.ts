// PersistenceService - PostgreSQL and Redis connections for conversation persistence
// Uses only pg and ioredis - NO LangChain imports

import pg from 'pg';
import Redis from 'ioredis';

const POSTGRES_URL = 'postgresql://sulla:sulla_dev_password@127.0.0.1:30116/sulla';
const REDIS_URL = 'redis://127.0.0.1:30117';

export class PersistenceService {
  private initialized = false;
  private pgConnected = false;
  private redisConnected = false;

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log('[Persistence] Initializing...');
    console.log(`[Persistence] PostgreSQL: ${POSTGRES_URL}`);
    console.log(`[Persistence] Redis: ${REDIS_URL}`);

    this.pgConnected = await this.testPostgres();
    this.redisConnected = await this.testRedis();

    console.log(`[Persistence] PostgreSQL connected: ${this.pgConnected}`);
    console.log(`[Persistence] Redis connected: ${this.redisConnected}`);

    this.initialized = true;
  }

  private async testPostgres(): Promise<boolean> {
    try {
      const client = new pg.Client({ connectionString: POSTGRES_URL });

      await client.connect();
      await client.query('SELECT 1');
      await client.end();

      return true;
    } catch (err) {
      console.warn('[Persistence] PostgreSQL test failed:', err);

      return false;
    }
  }

  private async testRedis(): Promise<boolean> {
    try {
      const redis = new Redis(REDIS_URL);

      await redis.ping();
      await redis.quit();

      return true;
    } catch (err) {
      console.warn('[Persistence] Redis test failed:', err);

      return false;
    }
  }

  async storeConversation(threadId: string, messages: Array<{ role: string; content: string }>): Promise<void> {
    if (!this.pgConnected) {
      return;
    }

    try {
      const client = new pg.Client({ connectionString: POSTGRES_URL });

      await client.connect();

      await client.query(`
        CREATE TABLE IF NOT EXISTS conversations (
          id SERIAL PRIMARY KEY,
          thread_id VARCHAR(255) NOT NULL UNIQUE,
          messages JSONB NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await client.query(`
        INSERT INTO conversations (thread_id, messages, updated_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (thread_id) 
        DO UPDATE SET messages = $2, updated_at = CURRENT_TIMESTAMP
      `, [threadId, JSON.stringify(messages)]);

      await client.end();
      console.log(`[Persistence:PG] Stored thread: ${threadId} (${messages.length} messages)`);
    } catch (err) {
      console.warn('[Persistence:PG] Store failed:', err);
    }
  }

  async loadConversation(threadId: string): Promise<Array<{ role: string; content: string }> | null> {
    if (!this.pgConnected) {
      return null;
    }

    try {
      const client = new pg.Client({ connectionString: POSTGRES_URL });

      await client.connect();

      const result = await client.query(
        'SELECT messages FROM conversations WHERE thread_id = $1',
        [threadId],
      );

      await client.end();

      if (result.rows.length > 0) {
        const messages = result.rows[0].messages;

        console.log(`[Persistence:PG] Loaded thread: ${threadId} (${messages.length} messages)`);

        return messages;
      }

      console.log(`[Persistence:PG] No conversation found: ${threadId}`);

      return null;
    } catch (err) {
      console.warn('[Persistence:PG] Load failed:', err);

      return null;
    }
  }

  async cacheSet(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.redisConnected) {
      return;
    }

    try {
      const redis = new Redis(REDIS_URL);

      if (ttlSeconds) {
        await redis.setex(key, ttlSeconds, value);
        console.log(`[Persistence:Redis] SET ${key} (TTL: ${ttlSeconds}s)`);
      } else {
        await redis.set(key, value);
        console.log(`[Persistence:Redis] SET ${key}`);
      }

      await redis.quit();
    } catch (err) {
      console.warn('[Persistence:Redis] SET failed:', err);
    }
  }

  async cacheGet(key: string): Promise<string | null> {
    if (!this.redisConnected) {
      return null;
    }

    try {
      const redis = new Redis(REDIS_URL);
      const value = await redis.get(key);

      await redis.quit();

      if (value) {
        console.log(`[Persistence:Redis] GET ${key} - HIT`);
      } else {
        console.log(`[Persistence:Redis] GET ${key} - MISS`);
      }

      return value;
    } catch (err) {
      console.warn('[Persistence:Redis] GET failed:', err);

      return null;
    }
  }
}

// Singleton
let service: PersistenceService | null = null;

export function getPersistenceService(): PersistenceService {
  if (!service) {
    service = new PersistenceService();
  }

  return service;
}
