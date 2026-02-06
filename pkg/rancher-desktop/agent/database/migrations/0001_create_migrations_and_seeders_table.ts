// migrations/0001_create_migrations_and_seeders_table.ts

export const up = `
  CREATE TABLE IF NOT EXISTS migrations (
    id          SERIAL PRIMARY KEY,
    name        TEXT UNIQUE NOT NULL,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS seeders (
    id          SERIAL PRIMARY KEY,
    name        TEXT UNIQUE NOT NULL,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

export const down = `
  DROP TABLE IF EXISTS seeders;
  DROP TABLE IF EXISTS migrations;
`;