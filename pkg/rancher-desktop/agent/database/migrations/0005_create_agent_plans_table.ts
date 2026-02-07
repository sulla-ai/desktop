export const up = `
  CREATE TABLE IF NOT EXISTS agent_plans (
    id          SERIAL PRIMARY KEY,
    thread_id   VARCHAR(255) NOT NULL,
    revision    INTEGER NOT NULL DEFAULT 1,
    status      VARCHAR(32) NOT NULL DEFAULT 'active',
    goal        TEXT NOT NULL,
    goaldescription TEXT NOT NULL,
    complexity  VARCHAR(32) NOT NULL,
    requirestools BOOLEAN NOT NULL,
    wschannel   VARCHAR(255) NOT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_agent_plans_thread_id ON agent_plans(thread_id);
`;

export const down = `DROP TABLE IF EXISTS agent_plans CASCADE;`;