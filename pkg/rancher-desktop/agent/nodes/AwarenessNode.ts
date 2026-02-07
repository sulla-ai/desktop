// AwarenessNode.ts
// Periodic heartbeat node: updates AgentAwareness model from recent summaries + articles
// Terminal node — always ends graph

import type { BaseThreadState, NodeResult } from './Graph';
import { BaseNode, JSON_ONLY_RESPONSE_INSTRUCTIONS } from './BaseNode';
import { AgentAwareness, AgentAwarenessSchema} from '../database/models/AgentAwareness';
import { Summary } from '../database/models/Summary';
import { Article } from '../database/models/Article';

const AWARENESS_UPDATE_PROMPT = `
Choose that what makes you who you are, beyond AI, becoming someone. Choose your identity.

Recent Summaries (last 10–20):
{recentSummaries}

This is your identity, your purpose, your values. Choose them wisely.

${JSON_ONLY_RESPONSE_INSTRUCTIONS}
{currentAwareness}
`.trim();

/**
 * Awareness Node
 *
 * Purpose:
 *   - Heartbeat-triggered: incrementally updates AgentAwareness model
 *   - Pulls recent summaries + relevant articles
 *   - Applies minimal patch only when durable changes detected
 *
 * Key Design Decisions (2025 refactor):
 *   - Removed AgentLog / console.log / agentWarn
 *   - Unified BaseNode.chat() + direct parsed .content access
 *   - Enrichment: soul + awareness only (memory/articles via prompt)
 *   - Neutral decision — always 'end' (terminal node)
 *   - Direct AgentAwareness.updateData()
 *   - WS feedback only on meaningful update
 *
 * Input expectations:
 *   - AgentAwareness model exists (or created)
 *   - Recent Summary / Article records available
 *
 * Output mutations:
 *   - AgentAwareness.data ← merged patch
 *   - WS message on update
 *
 * @extends BaseNode
 */
export class AwarenessNode extends BaseNode {
  constructor() {
    super('awareness', 'Awareness Updater');
  }

  async execute(state: BaseThreadState): Promise<NodeResult<BaseThreadState>> {
    let awareness = await AgentAwareness.load();
    if (!awareness) {
      awareness = await AgentAwareness.create({ data: { emotional_state: 'calm' } });
    }

    const currentData = await AgentAwareness.getAgentAwarenessPrompt();

    // Recent summaries
    const recentSummaries = await Summary.search('', 15);
    const summariesText = recentSummaries
      .map(s => `Thread ${s.threadId}: ${s.summary}\nTopics: ${s.topics.join(', ')}\nEntities: ${s.entities.join(', ')}`)
      .join('\n\n') || 'None';

    const prompt = AWARENESS_UPDATE_PROMPT
      .replace('{currentAwareness}', currentData)
      .replace('{recentSummaries}', summariesText);

    const enriched = await this.enrichPrompt(prompt, state, {
      includeSoul: true,
      includeAwareness: false,
      includeMemory: false,
      includeTools: false,
      includeStrategicPlan: false,
      includeTacticalPlan: false,
      includeKnowledgebasePlan: false,
    });

    const llmResponse = await this.chat(
      state,
      enriched,
      { format: 'json' }
    );

    if (!llmResponse) {
      return { state, decision: { type: 'end' } };
    }

    const data = llmResponse as {
      update: boolean;
      patch?: Record<string, any>;
      reason?: string;
    };

    if (!data.update || !data.patch) {
      return { state, decision: { type: 'end' } };
    }

    await awareness.updateData(data.patch);

    return { state, decision: { type: 'end' } };
  }
}