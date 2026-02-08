// PostgresClient.ts — upgraded to pg.Pool + proper shutdown

import { Pool, PoolClient } from 'pg';

const POSTGRES_URL = 'postgresql://sulla:sulla_dev_password@127.0.0.1:30116/sulla';

export class PostgresClient {
  private pool: Pool | null = null;
  private connected = false;

  constructor() {
    this.pool = new Pool({
      connectionString: POSTGRES_URL,
      max: 20,                    // max connections in pool
      idleTimeoutMillis: 30000,   // close idle after 30s
      connectionTimeoutMillis: 2000,
    });

    // Graceful pool error handling
    this.pool.on('error', (err, client) => {
      console.error('[PostgresPool] Unexpected error on idle client', err);
      this.connected = false;
    });
  }

  async initialize(): Promise<boolean> {
    if (this.connected) return true;

    try {
      const client = await this.pool!.connect();
      await client.query('SELECT 1');
      client.release();
      this.connected = true;
      console.log('[PostgresClient] Pool connected and healthy');
      return true;
    } catch (error: any) {
      console.error('[PostgresClient] Pool init failed:', error.message);
      this.connected = false;
      return false;
    }
  }

  async getClient(): Promise<PoolClient> {
    if (!this.connected) {
      const ok = await this.initialize();
      if (!ok) throw new Error('Postgres pool not ready');
    }
    return this.pool!.connect();
  }

  async query<T = any>(text: string, params: any[] = []): Promise<T[]> {
    const client = await this.getClient();
    try {
      const res = await client.query(text, params);
      return res.rows;
    } finally {
      client.release();
    }
  }

  async queryOne<T = any>(text: string, params: any[] = []): Promise<T | null> {
    const rows = await this.query<T>(text, params);
    return rows[0] ?? null;
  }

  async queryAll<T = any>(text: string, params: any[] = []): Promise<T[]> {
    return this.query<T>(text, params);
  }

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async end(): Promise<void> {
    if (!this.pool || !this.connected) return;

    try {
      await this.pool.end();
      console.log('[PostgresClient] Pool ended gracefully');
    } catch (err: any) {
      console.warn('[PostgresClient] Pool end warning:', err.message);
    } finally {
      this.pool = null;
      this.connected = false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}

export const postgresClient = new PostgresClient();