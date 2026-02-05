// PostgresClient.ts
// Singleton wrapper around pg with graceful shutdown handling

import pg from 'pg';

const POSTGRES_URL = 'postgresql://sulla:sulla_dev_password@127.0.0.1:30116/sulla';

export class PostgresClient {
  private client: pg.Client;
  private connected = false;

  constructor() {
    this.client = new pg.Client({ connectionString: POSTGRES_URL });
  }

  getClient(): pg.Client {
    return this.client;
  }

  async initialize(): Promise<boolean> {
    if (this.connected) return true;

    try {
      await this.client.connect();
      await this.client.query('SELECT 1');
      this.connected = true;
      console.log('[PostgresClient] Connected to PostgreSQL');
      return true;
    } catch (error: any) {
      if (error.code === '57P01') {
        console.warn('[PostgresClient] Connection terminated by admin during init — retrying once');
        try {
          await this.client.connect();
          this.connected = true;
          return true;
        } catch (retryErr) {
          console.error('[PostgresClient] Retry failed after admin termination:', retryErr);
          return false;
        }
      }
      console.error('[PostgresClient] Connection failed:', error);
      this.connected = false;
      return false;
    }
  }

  async query<T extends pg.QueryResultRow = any>(text: string, params: any[] = []): Promise<pg.QueryResult<T>> {
    if (!this.connected) {
      const ok = await this.initialize();
      if (!ok) throw new Error('Postgres not connected');
    }

    try {
      return await this.client.query(text, params) as pg.QueryResult<T>;
    } catch (error: any) {
      if (error.code === '57P01') {
        console.warn('[PostgresClient] Connection terminated by admin — reconnecting once');
        this.connected = false;
        await this.initialize();
        return this.client.query(text, params); // retry
      }
      console.error(`[PostgresClient] Query failed: ${text.slice(0, 100)}...`, error);
      throw error;
    }
  }

  async queryOne<T extends pg.QueryResultRow = any>(text: string, params: any[] = []): Promise<T | null> {
    const res = await this.query<T>(text, params);
    return res.rows[0] ?? null;
  }

  async queryAll<T extends pg.QueryResultRow = any>(text: string, params: any[] = []): Promise<T[]> {
    const res = await this.query<T>(text, params);
    return res.rows;
  }

  async transaction<T>(callback: (txClient: pg.Client) => Promise<T>): Promise<T> {
    if (!this.connected) await this.initialize();

    try {
      await this.client.query('BEGIN');
      const result = await callback(this.client);
      await this.client.query('COMMIT');
      return result;
    } catch (error: any) {
      await this.client.query('ROLLBACK');
      if (error.code === '57P01') {
        console.warn('[PostgresClient] Transaction rolled back due to admin termination — safe');
      } else {
        throw error;
      }
      throw error; // still propagate if needed
    }
  }

  async close(): Promise<void> {
    if (!this.connected) return;

    try {
      await this.client.end();
      this.connected = false;
      console.log('[PostgresClient] Connection closed gracefully');
    } catch (error: any) {
      if (error.code === '57P01') {
        console.warn('[PostgresClient] Connection already terminated by admin during shutdown — ignored');
      } else {
        console.error('[PostgresClient] Close failed:', error);
      }
      this.connected = false;
    }
  }
}

export const postgresClient = new PostgresClient();