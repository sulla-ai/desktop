// OverLordPlannerNode - High-level autonomous planning triggered by heartbeat
// Performs strategic oversight and long-term planning during idle periods

import type { ThreadState, NodeResult } from '../types';
import { BaseNode, JSON_ONLY_RESPONSE_INSTRUCTIONS } from './BaseNode';
import { parseJson } from '../services/JsonParseService';
import { agentLog, agentWarn } from '../services/AgentLogService';
import { getAgentConfig } from '../services/ConfigService';

const WS_CONNECTION_ID = 'chat-controller-backend';

type OverLordDecision = {
  action: 'trigger_hierarchical' | 'stop';
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

    const emit = (state.metadata.__emitAgentEvent as ((event: { type: 'progress' | 'chunk' | 'complete' | 'error'; threadId: string; data: unknown }) => void) | undefined);

    try {
      const iteration = Number((state.metadata as any).__overlordIteration || 0);
      if (iteration >= 25) {
        delete (state.metadata as any).__overlordRunHierarchy;
        agentWarn(this.name, 'OverLord max iterations reached');
        return { state, next: 'end' };
      }

      (state.metadata as any).__overlordIteration = iteration + 1;

      const config = getAgentConfig();
      const heartbeatPrompt = config.heartbeatPrompt || 'Review current system state and determine if hierarchical planning should be triggered.';
      
      const enrichedprompt = await this.enrichPrompt(heartbeatPrompt, state, {
        includeSoul: true,
        includeMemory: true,
        includeConversation: true,
      });

      const decisionPrompt = `${enrichedprompt}\n\n${JSON_ONLY_RESPONSE_INSTRUCTIONS}\n{\n  "action": "trigger_hierarchical" | "stop",\n  "reason": "optional"\n}`;

      // Emit via both WebSocket and traditional emit
      const progressData = { phase: 'overlord_llm' };
      this.dispatchToWebSocket(WS_CONNECTION_ID, { type: 'progress', ...progressData });
      emit?.({ type: 'progress', threadId: state.threadId, data: progressData });

      const response = await this.prompt(decisionPrompt, state, true);

      if (!response?.content) {
        delete (state.metadata as any).__overlordRunHierarchy;
        return { state, next: 'end' };
      }

      const parsed = parseJson<OverLordDecision>(response.content);
      const action = parsed?.action;

      if (action === 'trigger_hierarchical') {
        (state.metadata as any).__overlordRunHierarchy = true;
        (state.metadata as any).__overlordLastDecision = parsed;
        agentLog(this.name, `Decision: trigger_hierarchical (${parsed?.reason || ''})`);

        // Emit decision via WebSocket
        this.dispatchToWebSocket(WS_CONNECTION_ID, {
          type: 'chat_message',
          payload: {
            role: 'system',
            content: `OverLord: Triggering hierarchical planning (${parsed?.reason || 'no reason provided'})`,
          },
        });

        return { state, next: 'continue' };
      }

      delete (state.metadata as any).__overlordRunHierarchy;
      (state.metadata as any).__overlordLastDecision = parsed;
      agentLog(this.name, `Decision: stop (${parsed?.reason || ''})`);

      // Emit decision via WebSocket
      this.dispatchToWebSocket(WS_CONNECTION_ID, {
        type: 'chat_message',
        payload: {
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
        payload: {
          role: 'error',
          content: `OverLord failed: ${err.message}`,
        },
      });

      return { state, next: 'end' };
    }
    // Note: WebSocket connection stays alive for reuse across executions
  }
}
