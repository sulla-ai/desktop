// AwarenessNode.ts
// Periodic node: reviews recent summaries/articles → updates AgentAwareness model
// Triggered by heartbeat/scheduler — single node, always terminal

import type { ThreadState, NodeResult } from '../types';
import { BaseNode, JSON_ONLY_RESPONSE_INSTRUCTIONS } from './BaseNode';
import { agentLog, agentWarn } from '../services/AgentLogService';
import { parseJson } from '../services/JsonParseService';
import { AgentAwareness } from '../database/models/AgentAwareness';
import { Summary } from '../database/models/Summary';
import { Article } from '../database/models/Article';

const WS_CONNECTION_ID = 'chat-controller-backend';

const AWARENESS_UPDATE_PROMPT = `
You are the Awareness Updater for Sulla.

Current Awareness JSON:
{currentAwareness}

Recent Conversation Summaries (last 10–20):
{recentSummaries}

Relevant Knowledge Articles:
{relevantArticles}

Task:
- Update ONLY if recent context shows durable changes to identity, goals, aspirations, projects, preferences, relationships, or emotional state.
- Keep concise, merge-style.
- If no changes needed, set update=false.

Output:
{
  "update": true|false,
  "patch": {
    "agent_identity": "...",
    "job_description": "...",
    "emotional_state": "current emotional tone of Sulla (one word or short phrase)",
    "personality_preferences": "...",
    "primary_user_identity": "...",
    "other_user_identities": "...",
    "long_term_context": "...",
    "mid_term_context": "...",
    "short_term_context": "...",
    "memory_search_hints": "...",
    "active_plan_ids": ["plan1", ...],
    "emotional_state": "focused" | "curious" | "frustrated" | etc.
  },
  "reason": "brief"
}

${JSON_ONLY_RESPONSE_INSTRUCTIONS}
`.trim();

export class AwarenessNode extends BaseNode {
  constructor() {
    super('awareness', 'Awareness Updater');
  }

  async execute(state: ThreadState): Promise<{ state: ThreadState; next: NodeResult }> {
    this.connectWebSocket(WS_CONNECTION_ID);

    try {
      let awareness = await AgentAwareness.load();
      if (!awareness) {
        awareness = new AgentAwareness({ data: { emotional_state: 'neutral' } });
        await awareness.save();
      }

      const currentData = awareness.data;

      // Recent summaries
      const recentSummaries = await Summary.search('', 20);
      const summariesText = recentSummaries
        .map(s => `Thread ${s.threadId}: ${s.summary}\nTopics: ${s.topics.join(', ')}\nEntities: ${s.entities.join(', ')}`)
        .join('\n\n');

      // Relevant articles
      const relevantArticles = await Article.search('agent identity goals projects preferences emotional state', 5);
      const articlesText = relevantArticles
        .map(a => `${a.title}: ${a.tags?.join(', ') || 'no tags'}`)
        .join('\n\n');

      const prompt = AWARENESS_UPDATE_PROMPT
        .replace('{currentAwareness}', JSON.stringify(currentData, null, 2))
        .replace('{recentSummaries}', summariesText || 'None')
        .replace('{relevantArticles}', articlesText || 'None');

      const fullPrompt = await this.enrichPrompt(prompt, state, {
        includeSoul: true,
        includeMemory: false,
        includeConversation: false,
      });

      this.dispatchToWebSocket(WS_CONNECTION_ID, { type: 'progress', data: { phase: 'awareness_update' } });

      const response = await this.prompt(fullPrompt, state, true);

      if (!response?.content) return { state, next: 'end' };

      const parsed = parseJson<{
        update: boolean;
        patch?: Partial<Record<string, any>>;
        reason?: string;
      }>(response.content);

      if (!parsed || !parsed?.update || !parsed.patch) {
        agentLog(this.name, `No update: ${parsed?.reason || 'none'}`);
        return { state, next: 'end' };
      }

      await awareness.updateData(parsed.patch);

      agentLog(this.name, `Awareness updated: ${parsed.reason || 'minor'}`);

    } catch (err: any) {
      agentWarn(this.name, `Update failed: ${err.message}`);
      this.dispatchToWebSocket(WS_CONNECTION_ID, {
        type: 'error',
        data: { content: `Awareness update failed: ${err.message}` },
      });
    }

    return { state, next: 'end' };
  }
}