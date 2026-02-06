// MemoryNode.ts
// Simple memory recall: LLM generates search queries → Chroma semantic search → attach summaries to state

import type { ThreadState, NodeResult } from '../types';
import { BaseNode, JSON_ONLY_RESPONSE_INSTRUCTIONS } from './BaseNode';
import { agentLog, agentWarn } from '../services/AgentLogService';
import { Summary } from '../database/models/Summary';
import { parseJson } from '../services/JsonParseService';

const WS_CONNECTION_ID = 'chat-controller-backend';

const MEMORY_QUERY_PROMPT = `
You are a memory retrieval assistant.

Given the user's latest message and conversation context, decide what past summaries are relevant.

Output ONLY a short list of precise search phrases (1–4 max) to find matching conversation summaries.

If nothing relevant, output empty array.

${JSON_ONLY_RESPONSE_INSTRUCTIONS}
{
  "queries": ["short phrase 1", "phrase 2", ...],
  "reasoning": "one sentence why"
}
`.trim();

export class MemoryNode extends BaseNode {
  constructor() {
    super('memory_recall', 'Memory Recall');
  }

  async execute(state: ThreadState): Promise<{ state: ThreadState; next: NodeResult }> {
    const lastUserMsg = state.messages.filter(m => m.role === 'user').pop()?.content ?? '';

    if (!lastUserMsg.trim()) {
      agentLog(this.name, 'No user message — skipping');
      return { state, next: 'continue' };
    }

    try {
      const enrichedPrompt = await this.enrichPrompt(MEMORY_QUERY_PROMPT, state, {
        includeMemory: false,
        includeAwareness: true,
        includeSoul: false,
      });

      const response = await this.prompt(enrichedPrompt, state, true);

      if (!response?.content) {
        return { state, next: 'continue' };
      }

      const parsed = parseJson<{ queries: string[]; reasoning?: string }>(response.content);

      const queries = (parsed?.queries ?? []).filter(q => typeof q === 'string' && q.trim());

      if (queries.length === 0) {
        agentLog(this.name, `No search needed: ${parsed?.reasoning || 'empty queries'}`);
        return { state, next: 'continue' };
      }

      agentLog(this.name, `Searching summaries with queries: ${queries.join(', ')}`);

      // Search conversation_summaries collection only
      const results = await Summary.search(queries.join(' OR '), 12);

      if (results.length === 0) {
        agentLog(this.name, 'No relevant summaries found');
        return { state, next: 'continue' };
      }

      // Format for context injection
      const memoryContext = results
        .map((s, i) => `[Summary ${i+1} - Thread ${s.threadId}]: ${s.summary}\nTopics: ${s.topics.join(', ')}\nEntities: ${s.entities.join(', ')}`)
        .join('\n\n');

      state.metadata.memoryContext = memoryContext;
      state.metadata.retrievedSummaries = results.map(s => ({
        threadId: s.threadId || '',
        summary: s.summary || '',
        topics: s.topics,
        entities: s.entities,
      }));

      agentLog(this.name, `Attached ${results.length} summaries to state`);

      // Optional UI feedback
      this.dispatchToWebSocket(WS_CONNECTION_ID, {
        type: 'progress',
        data: { phase: 'memory_recall', count: results.length },
      });

    } catch (err) {
      agentWarn(this.name, `Memory recall failed: ${err}`);
    }

    return { state, next: 'continue' };
  }
}