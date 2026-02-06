// DatabaseManager.ts
// Singleton – runs migrations + seeders once per process after backend is ready
// Tracks execution in postgres tables

import { postgresClient } from '@pkg/agent/database/PostgresClient';
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

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.runMigrations();
      await this.runSeeders();

      this.initialized = true;
      console.log('[DB] Database ready');
    } catch (err) {
      console.error('[DB] Initialization failed:', err);
      throw err;
    }
  }

  private async getExecuted(table: string): Promise<Set<string>> {
    const res = await postgresClient.query(`SELECT name FROM ${table}`);
    return new Set(res.rows.map((r: TrackedItem) => r.name));
  }

  private async runMigrations(): Promise<void> {
    console.log('[DB] Running migrations...');

    const executed = await this.getExecuted(MIGRATIONS_TABLE);

    for (const mig of migrationsRegistry) {
      if (executed.has(mig.name)) {
        console.log(`[DB] Skip migration (already run): ${mig.name}`);
        continue;
      }

      try {
        console.log(`[DB] Applying: ${mig.name}`);
        await postgresClient.query(mig.up);

        await postgresClient.query(
          `INSERT INTO ${MIGRATIONS_TABLE} (name) VALUES ($1) ON CONFLICT DO NOTHING`,
          [mig.name]
        );
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