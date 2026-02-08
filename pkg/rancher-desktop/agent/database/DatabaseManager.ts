// DatabaseManager.ts
// Singleton – runs migrations + seeders once per process after backend is ready
// Tracks execution in postgres tables

import { postgresClient, PostgresClient } from '@pkg/agent/database/PostgresClient';
import { migrationsRegistry } from './migrations';
import { seedersRegistry } from './seeders';

const MIGRATIONS_TABLE = 'migrations';
const SEEDERS_TABLE   = 'seeders';

interface TrackedItem {
  id: number;
  name: string;
  executed_at: Date;
}

let instance: DatabaseManager | null = null;

export function getDatabaseManager(): DatabaseManager {
  if (!instance) instance = new DatabaseManager();
  return instance;
}

export class DatabaseManager {
  private initialized = false;
  private pollingInterval: NodeJS.Timeout | null = null;
  private isPolling = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const MAX_ATTEMPTS = 60;          // ~2 minutes total
    const INITIAL_DELAY = 2000;
    let attempt = 0;

    while (attempt < MAX_ATTEMPTS) {
      attempt++;
      const delay = INITIAL_DELAY * Math.pow(1.5, attempt - 1); // ~3s → ~30s backoff

      try {
        console.log(`[DB] Attempt ${attempt}/${MAX_ATTEMPTS} — connecting...`);

        // Fresh client each attempt — prevents poisoning
        const client = new PostgresClient(); // create fresh instance
        await client.initialize();

        // Real health check
        await client.query('SELECT 1');
        console.log('[DB] Connection healthy');

        // One-time setup
        await this.runMigrations();
        await this.runSeeders();

        this.initialized = true;
        console.log('[DB] Database fully initialized');
        return;

      } catch (err: any) {
        console.debug(`[DB] Attempt ${attempt} failed: ${err.message || err}`);

        if (attempt === MAX_ATTEMPTS) {
          console.error('[DB] Gave up after max attempts — database unavailable');
          throw err;
        }

        // Exponential backoff + jitter
        const jitter = Math.random() * 500;
        await new Promise(r => setTimeout(r, delay + jitter));
      } finally {
        // Clean up any temporary client
        // (if your client doesn't auto-close, add client.end() here)
      }
    }
  }

  async stop(): Promise<void> {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.isPolling = false;
  }

  private async getExecuted(table: string): Promise<Set<string>> {
    const res = await postgresClient.query(`SELECT name FROM ${table}`);
    return new Set(res.rows.map((r: TrackedItem) => r.name));
  }

  private async runMigrations(): Promise<void> {
    console.log('[DB] Running migrations...');

    // Ensure migrations table exists
    try {
      await postgresClient.query(`
        CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) UNIQUE NOT NULL,
          executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('[DB] Migrations table created successfully');
    } catch (err: any) {
      if (err.code === '42P07') {
        console.log('[DB] Migrations table already exists');
      } else {
        console.error('[DB] Failed to create migrations table:', err);
        throw err;
      }
    }

    const executed = await this.getExecuted(MIGRATIONS_TABLE);
    
    // Log migration counts
    const totalMigrations = migrationsRegistry.length;
    const alreadyRunCount = Array.from(executed).filter(name => 
      migrationsRegistry.some(mig => mig.name === name)
    ).length;
    const needToRunCount = totalMigrations - alreadyRunCount;
    
    console.log(`[DB] ${alreadyRunCount} migrations already run, ${needToRunCount} migrations need to be run`);

    for (const mig of migrationsRegistry) {
      if (executed.has(mig.name)) {
        console.log(`[DB] Skip migration (already run): ${mig.name}`);
        continue;
      }

      try {
        console.log(`[DB] Running migration: ${mig.name}`);
        await postgresClient.query(mig.up);

        await postgresClient.query(
          `INSERT INTO ${MIGRATIONS_TABLE} (name) VALUES ($1) ON CONFLICT DO NOTHING`,
          [mig.name]
        );
        console.log(`[DB] Migration completed: ${mig.name}`);
      } catch (err) {
        console.error(`Migration failed: ${mig.name}`, err);
        throw err; // fail fast on migrations
      }
    }

    console.log('[DB] Migrations complete');
  }

  private async runSeeders(): Promise<void> {
    console.log('[DB] Running seeders...');

    const executed = await this.getExecuted(SEEDERS_TABLE);

    for (const seeder of seedersRegistry) {
      if (executed.has(seeder.name)) {
        console.log(`[DB] Skip seeder (already run): ${seeder.name}`);
        continue;
      }

      try {
        console.log(`[DB] Running seeder: ${seeder.name}`);
        await seeder.run();

        await postgresClient.query(
          `INSERT INTO ${SEEDERS_TABLE} (name) VALUES ($1) ON CONFLICT DO NOTHING`,
          [seeder.name]
        );
      } catch (err) {
        console.error(`Seeder failed: ${seeder.name}`, err);
        // seeders usually non-fatal → continue
      }
    }

    console.log('[DB] Seeders complete');
  }
}