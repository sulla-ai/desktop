// migrations/0004_create_conversation_summaries_collection.ts

export const up = `
  -- Note: Chroma collections are created on first upsert, no SQL needed
  -- This migration is a placeholder to track when summaries collection was initialized
  -- Actual collection: 'conversation_summaries' will be created automatically on first upsert
`;

export const down = ` -- No-op: Chroma collections can't be dropped via SQL`;