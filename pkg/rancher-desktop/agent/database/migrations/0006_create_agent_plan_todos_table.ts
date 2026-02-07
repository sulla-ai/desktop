export const up = `
  CREATE TABLE IF NOT EXISTS agent_plan_todos (
    id              SERIAL PRIMARY KEY,
    plan_id         INTEGER NOT NULL REFERENCES agent_plans(id) ON DELETE CASCADE,
    status          VARCHAR(32) NOT NULL DEFAULT 'pending',
    order_index     INTEGER NOT NULL DEFAULT 0,
    title           TEXT NOT NULL,
    description     TEXT NOT NULL,
    category_hints  JSONB NOT NULL DEFAULT '[]'::jsonb,
    wschannel       VARCHAR(255) NOT NULL default 'chat-controller',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_agent_plan_todos_plan_id ON agent_plan_todos(plan_id);
`;

export const down = `DROP TABLE IF EXISTS agent_plan_todos CASCADE;`;