// SummaryNode.ts
// Final node in any graph: summarizes the full conversation thread
// Stores concise facts-only summary in Chroma via Summary model
// No graph routing decisions — always terminal

import type { ThreadState, NodeResult } from '../types';
import { BaseNode, JSON_ONLY_RESPONSE_INSTRUCTIONS } from './BaseNode';
import { agentLog, agentWarn } from '../services/AgentLogService';
import { Summary } from '../database/models/Summary';
import { parseJson } from '../services/JsonParseService';

const WS_CONNECTION_ID = 'chat-controller-backend';

const SUMMARIZE_PROMPT = `
You are an expert at ruthless, high-signal summarization.

Task:
- Read the entire conversation thread.
- Extract ONLY the most important facts, decisions, outcomes, commitments, key entities, and actionable items.
- Strip ALL reasoning traces, chit-chat, meta-commentary, jokes, filler words, and low-value content.
- Output format (strict):
  1. One tight paragraph summary (150–300 tokens max)
  2. Bullet list: Main topics
  3. Bullet list: Key entities (people, tools, companies, concepts, URLs, etc.)

Do NOT explain your process. Do NOT add commentary. Respond ONLY with the structured summary.

Conversation thread:
{thread}

${JSON_ONLY_RESPONSE_INSTRUCTIONS}
{
  "summary": "concise paragraph...",
  "topics": ["topic1", "topic2", ...],
  "entities": ["entity1", "entity2", ...]
}
`.trim();

export class SummaryNode extends BaseNode {
  constructor() {
    super('summary', 'Conversation Summary');
  }

  async execute(state: ThreadState): Promise<{ state: ThreadState; next: NodeResult }> {
    console.log(`[Agent:SummaryNode] Summarizing thread ${state.threadId}`);

    this.connectWebSocket(WS_CONNECTION_ID);

    try {
      // Gather full conversation content
      const threadContent = state.messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => `${m.role.toUpperCase()}: ${m.content}`)
        .join('\n\n');

      if (!threadContent.trim()) {
        agentLog(this.name, 'Empty thread — skipping summary');
        return { state, next: 'end' };
      }

      const prompt = SUMMARIZE_PROMPT.replace('{thread}', threadContent);

      // Optional: enrich with memory/knowledge if needed
      const fullPrompt = await this.enrichPrompt(prompt, state, {
        includeMemory: false,
        includeSoul: false,
      });

      this.dispatchToWebSocket(WS_CONNECTION_ID, {
        type: 'progress',
        data: { phase: 'summarizing' },
      });

      const response = await this.prompt(fullPrompt, state, true);

      if (!response?.content) {
        agentWarn(this.name, 'No summary generated');
        return { state, next: 'end' };
      }

      const parsed = parseJson<{
        summary: string;
        topics: string[];
        entities: string[];
      }>(response.content);

      if (!parsed?.summary) {
        agentWarn(this.name, 'Invalid summary format');
        return { state, next: 'end' };
      }

      // Store via model
      await Summary.create(
        state.threadId,
        parsed.summary,
        parsed.topics ?? [],
        parsed.entities ?? []
      );

      agentLog(this.name, `Summary stored for thread ${state.threadId} (${parsed.summary.slice(0, 80)}...)`);

      // Emit final summary to UI
      this.dispatchToWebSocket(WS_CONNECTION_ID, {
        type: 'assistant_message',
        data: {
          role: 'system',
          content: `**Conversation Summary**\n\n${parsed.summary}\n\n**Topics:** ${parsed.topics.join(', ')}\n**Entities:** ${parsed.entities.join(', ')}`,
        },
      });

      return { state, next: 'end' };
    } catch (err: any) {
      agentWarn(this.name, `Summary failed: ${err.message}`);
      state.metadata.error = `Summary node failed: ${err.message}`;

      this.dispatchToWebSocket(WS_CONNECTION_ID, {
        type: 'error',
        data: { content: `Summary generation failed: ${err.message}` },
      });

      return { state, next: 'end' };
    }
  }
}