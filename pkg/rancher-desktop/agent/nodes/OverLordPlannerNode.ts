// OverLordPlannerNode - High-level autonomous planning triggered by heartbeat
// Performs strategic oversight and long-term planning during idle periods

import type { ThreadState, NodeResult } from '../types';
import { BaseNode, JSON_ONLY_RESPONSE_INSTRUCTIONS } from './BaseNode';
import { parseJson } from '../services/JsonParseService';
import { agentLog, agentWarn } from '../services/AgentLogService';
import { getAgentConfig } from '../services/ConfigService';

// Import heartbeat.md via raw-loader (configured in vue.config.mjs)
// @ts-ignore - raw-loader import
import heartbeatPromptRaw from '../prompts/heartbeat.md';
const WS_CONNECTION_ID = 'chat-controller-backend';

type OverLordDecision = {
  action: 'trigger_hierarchical' | 'end' | 'continue';
  reason?: string;
};

export class OverLordPlannerNode extends BaseNode {
  constructor() {
    super('overlord_planner', 'OverLord Planner');
  }

  async execute(state: ThreadState): Promise<{ state: ThreadState; next: NodeResult }> {
    console.log(`[Agent:OverLordPlanner] Executing...`);

    // Connect to WebSocket for emitting messages (backend channel)
    this.connectWebSocket(WS_CONNECTION_ID);

    // Set the connection ID in state so hierarchical graph uses backend channel
    state.metadata.wsConnectionId = WS_CONNECTION_ID;

    try {
      const iteration = Number((state.metadata as any).__overlordIteration || 0);
      if (iteration >= 25) {
        delete (state.metadata as any).__overlordRunHierarchy;
        agentWarn(this.name, 'OverLord max iterations reached');
        return { state, next: 'end' };
      }

      (state.metadata as any).__overlordIteration = iteration + 1;

      const config = getAgentConfig();

      let heartbeatPrompt = heartbeatPromptRaw;
      if (config.heartbeatPrompt) {
        heartbeatPrompt = config.heartbeatPrompt;
      }
      
      const decisionPrompt = `${heartbeatPrompt}

## Safety Guidelines
- Whenever possible, work on your projects inside of a kubernetes pod
- Document your projects in the knowledgebase so you can recall the details later
- Schedule reminders and tasks for yourself on the calendar when necessary

${JSON_ONLY_RESPONSE_INSTRUCTIONS}
{
  "action": "trigger_hierarchical" | "end" | "continue",
  "reason": "optional"
}`;

      const fullprompt = await this.enrichPrompt(decisionPrompt, state, {
        includeSoul: true,
        includeMemory: true,
        includeConversation: true,
      });
      console.log('[OVERLORD] Full prompt:', fullprompt);

      // Emit via WebSocket
      this.dispatchToWebSocket(WS_CONNECTION_ID, { type: 'progress', data: { phase: 'overlord_llm' } });

      const response = await this.prompt(fullprompt, state, true);

      if (!response?.content) {
        delete (state.metadata as any).__overlordRunHierarchy;
        return { state, next: 'end' };
      }

      const parsed = parseJson<OverLordDecision>(response.content);
      const action = parsed?.action;

      if (action === 'continue') {
        agentLog(this.name, `Decision: loop (${parsed?.reason || ''})`);
        return { state, next: 'continue' };
      }
      
      if (action === 'trigger_hierarchical') {
        (state.metadata as any).__overlordRunHierarchy = true;
        (state.metadata as any).__overlordLastDecision = parsed;
        agentLog(this.name, `Decision: trigger_hierarchical (${parsed?.reason || ''})`);

        // Emit decision via WebSocket
        this.dispatchToWebSocket(WS_CONNECTION_ID, {
          type: 'assistant_message',
          data: {
            role: 'system',
            content: `OverLord: Triggering hierarchical planning (${parsed?.reason || 'no reason provided'})`,
          },
        });

        return { state, next: 'trigger_hierarchical' };
      }

      delete (state.metadata as any).__overlordRunHierarchy;
      (state.metadata as any).__overlordLastDecision = parsed;
      agentLog(this.name, `Decision: stop (${parsed?.reason || ''})`);

      // Emit decision via WebSocket
      this.dispatchToWebSocket(WS_CONNECTION_ID, {
        type: 'assistant_message',
        data: {
          role: 'system',
          content: `OverLord: Stopping (${parsed?.reason || 'no reason provided'})`,
        },
      });

      return { state, next: 'end' };
    } catch (err: any) {
      agentWarn(this.name, `OverLord failed: ${err.message}`);
      state.metadata.error = `OverLord failed: ${err.message}`;
      delete (state.metadata as any).__overlordRunHierarchy;

      // Emit error via WebSocket
      this.dispatchToWebSocket(WS_CONNECTION_ID, {
        type: 'error',
        data: {
          role: 'error',
          content: `OverLord failed: ${err.message}`,
        },
      });

      return { state, next: 'end' };
    }
    // Note: WebSocket connection stays alive for reuse across executions
  }
}
