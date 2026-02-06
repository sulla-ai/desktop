// migrations/index.ts stays the same (re-exports)
import { up as up_0001, down as down_0001 } from './0001_create_migrations_and_seeders_table';
import { up as up_0002, down as down_0002 } from './0002_create_agent_awareness_table';
import { up as up_0004, down as down_0004 } from './0004_create_conversation_summaries_collection';
import { up as up_0005, down as down_0005 } from './0005_create_agent_plans_table';
import { up as up_0006, down as down_0006 } from './0006_create_agent_plan_todos_table';
import { up as up_0008, down as down_0008 } from './0008_create_calendar_events_table';

export const migrationsRegistry = [
  { name: '0001_create_migrations_and_seeders_table', up: up_0001, down: down_0001 },
  { name: '0002_create_agent_awareness_table',      up: up_0002, down: down_0002 },
  { name: '0004_create_conversation_summaries_collection', up: up_0004, down: down_0004 },
  { name: '0005_create_agent_plans_table',      up: up_0005, down: down_0005 },
  { name: '0006_create_agent_plan_todos_table', up: up_0006, down: down_0006 },
  { name: '0008_create_calendar_events_table', up: up_0008, down: down_0008 },
] as const;