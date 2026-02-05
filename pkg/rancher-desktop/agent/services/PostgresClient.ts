// PostgresClient.ts
// Singleton wrapper around pg for clean, consistent DB access
// Mirrors ChromaClient structure: init test, methods throw on error, singleton export

import pg from 'pg';

const POSTGRES_URL = 'postgresql://sulla:sulla_dev_password@127.0.0.1:30116/sulla';

export class PostgresClient {
  private client: pg.Client;
  private connected = false;

  constructor() {
    this.client = new pg.Client({ connectionString: POSTGRES_URL });
  }

  /**
   * Get the underlying pg client
   */
  getClient(): pg.Client {
    return this.client;
  }

  /**
   * Initialize and test connection
   */
  async initialize(): Promise<boolean> {
    if (this.connected) return true;

    try {
      await this.client.connect();
      await this.client.query('SELECT 1');
      this.connected = true;
      console.log('[PostgresClient] Connected to PostgreSQL');
      return true;
    } catch (error) {
      console.error('[PostgresClient] Connection failed:', error);
      this.connected = false;
      return false;
    }
  }

  /**
   * Execute raw query with params (returns full result)
   */
  async query<T extends pg.QueryResultRow = any>(text: string, params: any[] = []): Promise<pg.QueryResult<T>> {
    if (!this.connected) {
      const ok = await this.initialize();
      if (!ok) throw new Error('Postgres not connected');
    }

    try {
      return await this.client.query(text, params) as pg.QueryResult<T>;
    } catch (error) {
      console.error(`[PostgresClient] Query failed: ${text.slice(0, 100)}...`, error);
      throw error;
    }
  }

  /**
   * Run query and return first row only (or null)
   */
  async queryOne<T extends pg.QueryResultRow = any>(text: string, params: any[] = []): Promise<T | null> {
    const res = await this.query<T>(text, params);
    return res.rows[0] ?? null;
  }

  /**
   * Run query and return all rows
   */
  async queryAll<T extends pg.QueryResultRow = any>(text: string, params: any[] = []): Promise<T[]> {
    const res = await this.query<T>(text, params);
    return res.rows;
  }

  /**
   * Execute a transaction (callback receives client)
   */
  async transaction<T>(callback: (txClient: pg.Client) => Promise<T>): Promise<T> {
    if (!this.connected) await this.initialize();

    try {
      await this.client.query('BEGIN');
      const result = await callback(this.client);
      await this.client.query('COMMIT');
      return result;
    } catch (error) {
      await this.client.query('ROLLBACK');
      throw error;
    }
  }

  /**
   * Close connection (call on shutdown)
   */
  async close(): Promise<void> {
    if (this.connected) {
      await this.client.end();
      this.connected = false;
      console.log('[PostgresClient] Connection closed');
    }
  }
}

// Singleton instance
export const postgresClient = new PostgresClient();