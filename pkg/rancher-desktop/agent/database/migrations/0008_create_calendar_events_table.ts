export const up = `
  CREATE TABLE IF NOT EXISTS calendar_events (
    id            SERIAL PRIMARY KEY,
    title         VARCHAR(500) NOT NULL,
    start_time    TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time      TIMESTAMP WITH TIME ZONE NOT NULL,
    description   TEXT,
    location      VARCHAR(500),
    people        JSONB DEFAULT '[]'::jsonb,
    calendar_id   VARCHAR(100),
    all_day       BOOLEAN DEFAULT FALSE,
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_calendar_events_start ON calendar_events(start_time);
  CREATE INDEX IF NOT EXISTS idx_calendar_events_end   ON calendar_events(end_time);
  CREATE INDEX IF NOT EXISTS idx_calendar_events_cal_id ON calendar_events(calendar_id);
`;

export const down = `DROP TABLE IF EXISTS calendar_events CASCADE;`;