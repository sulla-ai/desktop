export const up = `
  CREATE TABLE agent_awareness (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- Insert initial row if not exists
  INSERT INTO agent_awareness (id, data) 
  VALUES (1, '{}')
  ON CONFLICT (id) DO NOTHING;
`;

export const down = `DROP TABLE IF EXISTS agent_awareness;`;