// OverLordPlannerNode.ts
// Autonomous high-level oversight during heartbeat/idle periods
// Decides: trigger hierarchical graph, continue looping, or end

import type { OverlordThreadState, NodeResult } from './Graph';
import { BaseNode,JSON_ONLY_RESPONSE_INSTRUCTIONS, TOOLS_RESPONSE_JSON } from './BaseNode';
import { getAgentConfig } from '../services/ConfigService';
import { heartbeatPrompt } from '../prompts/heartbeat';

const OVERLORD_DECISION_PROMPT = `
Your job right now is to decide what needs to be done.

Here are your only options:
1. You can { action: "trigger_hierarchical" } which will instruct your heirarchical graph agent to complete the instructions you prompt it with.
2. You can { action: "trigger_knowledge" } which will instruct your knowledge graph agent to create a knowledgebase article using the instructions you prompt it with. Do this when you need to update your memory.
3. You can { action: "continue" } which will allow you to run again if you need to continue working on your current task.
3.1 If you choose to continue you can trigger any tools you need to help complete your task.
4. You can { action: "end" } which will put you to sleep. Do this only after you have completed all your tasks.

${JSON_ONLY_RESPONSE_INSTRUCTIONS}
{
${TOOLS_RESPONSE_JSON}
  "action": "trigger_hierarchical" | "continue" | "end",
  "instructions_prompt": "complete instructions for the next node"
}

Safety Guidelines:
- Document things you want to remember in knowledge base
- Organize your day of tasks on the calendar to keep yourself productive
- Use the full suite of tools available to you to carry out your tasks
`;

/**
 * OverLord Planner Node
 *
 * Purpose:
 *   - Runs on heartbeat trigger during idle periods
 *   - Makes high-level decision: trigger full hierarchical graph, loop, or stop
 *   - Drives long-term autonomous momentum without constant user input
 *
 * Key Design Decisions (2025 refactor):
 *   - Removed AgentLog / console.log entirely
 *   - Uses BaseNode.chat() with JSON format + direct .content object access
 *   - Enrichment: soul + awareness + memory only
 *   - Neutral decisions only ('continue' / 'next' / 'end')
 *   - Routing lives in heartbeat graph conditional edge
 *   - WS feedback only on trigger/end via wsChatMessage()
 *   - No iteration counter — graph-level loop protection handles it
 *
 * Input expectations:
 *   - state.metadata.subGraph exists (OverlordThreadState shape)
 *   - Recent messages/context available
 *
 * Output mutations:
 *   - state.metadata.subGraph.state = 'trigger_subgraph' on trigger
 *   - state.metadata.subGraph.name = 'hierarchical'
 *   - state.metadata.subGraph.prompt = reason or default trigger message
 *
 * Failure modes:
 *   - No valid LLM response → continue (safe default)
 *   - Invalid/missing action → continue
 *   - Config fallback to default heartbeat prompt
 *
 * @extends BaseNode
 */
export class OverLordPlannerNode extends BaseNode {
  constructor() {
    super('overlord_planner', 'OverLord Planner');
  }

  async execute(state: OverlordThreadState): Promise<NodeResult<OverlordThreadState>> {

    const config = getAgentConfig();
    const basePrompt = config.heartbeatPrompt || heartbeatPrompt;
    const decisionPrompt = `${basePrompt}\n\n${OVERLORD_DECISION_PROMPT}`;

    const enriched = await this.enrichPrompt(decisionPrompt, state, {
      includeSoul: true,
      includeAwareness: true,
      includeMemory: true,
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
      return { state, decision: { type: 'continue' } };
    }

    const data = llmResponse as { action: string; reason?: string };
    const action = data.action;

    if (!action) {
      return { state, decision: { type: 'end' } };
    }
    
    if (action === 'trigger_hierarchical') {
      state.metadata.subGraph = {
        state: 'trigger_subgraph',
        name: 'hierarchical',
        prompt: data.reason?.trim() || "OverLord initiating planning cycle",
        response: ''
      };

      this.wsChatMessage(
        state,
        `OverLord → Executing on a complex task: ${data.reason || 'cycle'}`,
        'system',
        'progress'
      );

      return { state, decision: { type: 'next' } };

    } else if (action === 'trigger_knowledge') {

      state.metadata.subGraph = {
        state: 'trigger_subgraph',
        name: 'knowledge',
        prompt: data.reason?.trim() || "OverLord initiating knowledge base cycle",
        response: ''
      };

      this.wsChatMessage(
        state,
        `OverLord → Working on the knowledgebase: ${data.reason || 'cycle'}`,
        'system',
        'progress'
      );

      return { state, decision: { type: 'next' } };
    }

    if (action === 'end') {
      this.wsChatMessage(
        state,
        `OverLord → Ending cycle: ${data.reason || 'complete'}`,
        'system',
        'progress'
      );

      return { state, decision: { type: 'end' } };
    }

    // Default: continue loop
    return { state, decision: { type: 'continue' } };
  }
}