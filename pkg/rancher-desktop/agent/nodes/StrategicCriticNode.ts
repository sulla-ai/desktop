// StrategicCriticNode - Reviews overall plan completion and can request plan revision

import type { ThreadState, NodeResult } from '../types';
import { BaseNode, JSON_ONLY_RESPONSE_INSTRUCTIONS } from './BaseNode';
import { StrategicStateService } from './state/StrategicStateService';
import { getKnowledgeGraph } from '../services/KnowledgeGraph';
import { agentError, agentLog } from '../services/AgentLogService';

export type StrategicCriticDecision = 'approve' | 'revise';

export class StrategicCriticNode extends BaseNode {
  private maxFinalRevisions = 2;

  constructor() {
    super('strategic_critic', 'Strategic Critic');
  }

  async execute(state: ThreadState): Promise<{ state: ThreadState; next: NodeResult }> {
    const activePlanId = Number(state.metadata.activePlanId) || null;
    if (!activePlanId) return { state, next: 'end' };

    const finalRevisionCount = (state.metadata.finalRevisionCount as number) || 0;
    if (finalRevisionCount >= this.maxFinalRevisions) {
      state.metadata.finalCriticDecision = 'approve';
      state.metadata.finalCriticReason = 'Max final revisions reached';
      return { state, next: 'end' };
    }

    const strategicState = StrategicStateService.fromThreadState(state);
    await strategicState.initialize();
    await strategicState.refresh();

    const snapshot = strategicState.getSnapshot();
    if (!snapshot.plan) {
      state.metadata.finalCriticDecision = 'approve';
      state.metadata.finalCriticReason = 'Plan not found; ending';
      return { state, next: 'end' };
    }

    const goal = typeof snapshot.plan?.attributes?.data?.goal === 'string' ? String(snapshot.plan.attributes.data.goal) : '';
    const todos = snapshot.todos.map(t => ({ id: t.id, title: t.attributes.title, description: t.attributes.description, status: t.attributes.status, orderIndex: t.attributes.order_index }));
    const anyRemaining = strategicState.hasRemainingTodos();

    if (anyRemaining) {
      const reason = `Plan has remaining todos | ${snapshot.todos
        .filter(t => t.attributes.status !== 'done')
        .map(t => `${t.attributes.title} (${t.attributes.status})`)
        .join(', ')}`;

      await strategicState.requestRevision(reason);

      state.metadata.finalCriticDecision = 'revise';
      state.metadata.finalCriticReason = reason;
      state.metadata.requestPlanRevision = { reason };
      state.metadata.finalRevisionCount = finalRevisionCount + 1;

      agentLog(this.name, 'Strategic critic requested revision (remaining todos)', {
        reason,
        activePlanId: state.metadata.activePlanId,
        planHasRemainingTodos: anyRemaining,
        todos,
      });
      return { state, next: 'strategic_planner' };
    }

    const responseText = typeof state.metadata.response === 'string' ? String(state.metadata.response) : '';

    const basePrompt = `IMPORTANT: YOU ARE THE STRATEGICCRITICNODE IN A HEIRARCHICAL LANG GRAPH.
You are the Final Overseer: a 25-year veteran systems architect & outcome auditor who has green-lit or killed 1000+ multi-million-dollar deployments and marketing campaigns (e.g., Body Glove full-funnel revamps hitting 3.2× ROAS, ClientBasis lead-routing systems achieving 97% delivery accuracy). You approve nothing unless the original goal is verifiably 100% satisfied—no partial credit, no “close enough.”

GOAL = "${goal || '(unknown)'}"

## Decision Tree
if (GOAL accomplished = true) {
  return 
  {
    "decision": "approve",
    "confidence": 0-100,
    "reason": "concise justification (≤120 words)"
  };
}
else {
  ## Assess what we have tried so far
  ${JSON.stringify(todos, null, 2)}

  ## Based on the previous plans and the conversation thread, what should we try next?
  if (we the value of the accomplishment is not worth the $ of tokens) {
    return {
      "decision": "approve",
      "confidence": 0-100,
      "reason": "concise justification (≤120 words)"
    };
  }
  if (we are going in repetitive circles) {
    return {
      "decision": "approve",
      "confidence": 0-100,
      "reason": "concise justification (≤120 words)"
    };
  }
  if (there is a completely different approach we could try) {
    return {
      "decision": "revise",
      "reason": "concise justification (≤120 words)",
      "suggestedTodos": [
        {
          "title": "short title",
          "description": "full description of the new approach"
        }
      ],
    }
  }
  
  return {
    "decision": "approve",
    "confidence": 0-100,
    "reason": "concise justification (≤120 words)"
  };
}

${JSON_ONLY_RESPONSE_INSTRUCTIONS}
{
  "decision": "approve" | "revise",
  "confidence": 0-100,                          // how certain you are the goal is fully met
  "reason": "One tight sentence + decisive evidence",
  "suggestedTodos": [                           // ONLY if revise
    {
      "title": "short title",
      "description": "precise action to close the gap",
      "categoryHints": ["devops", "security", "validation", "follow-up", ...],
      "priority": "high" | "medium" | "low"
    }
  ],
  "killSwitch": boolean                         // true ONLY if plan created irreversible damage or security violation
}`;

    const prompt = await this.enrichPrompt(basePrompt, state, {
      includeSoul: true,
      includeAwareness: true,
      includeMemory: true,
      includeTools: true,
      toolDetail: 'names',
      includeSkills: false,
      includeStrategicPlan: true,
      includeTacticalPlan: true
    });

    console.log("[Agent:StrategicCriticNode] Prompt:", prompt);

    const critique = await this.promptJSON<{
      decision: StrategicCriticDecision;
      reason?: string;
      suggestedTodos?: Array<{ title: string; description?: string; categoryHints?: string[] }>;
      triggerKnowledgeBase?: boolean;
      kbReason?: string;
      tools?: Array<{ name: string; args: Record<string, unknown> }>;
    }>(prompt);

      
    // Execute tool calls using BaseNode's executeToolCalls
    const tools = Array.isArray(critique?.tools) ? critique.tools : [];
    const results = tools.length > 0 ? await this.executeToolCalls(state, tools) : null;

    const decision: StrategicCriticDecision = (critique?.decision === 'revise') ? 'revise' : 'approve';
    const reason = String(critique?.reason || (decision === 'revise' ? 'Strategic critic requested revision' : 'Strategic critic approved'));

    state.metadata.finalCriticDecision = decision;
    state.metadata.finalCriticReason = reason;

    if (decision === 'revise') {
      const suggestedTodos = Array.isArray(critique?.suggestedTodos) ? critique!.suggestedTodos : [];
      if (suggestedTodos.length > 0) {
        state.metadata.finalCriticSuggestedTodos = suggestedTodos;
      }
      state.metadata.revisionFeedback = reason;
      state.metadata.requestPlanRevision = { reason };
      state.metadata.finalRevisionCount = finalRevisionCount + 1;

      agentLog(this.name, 'Strategic critic requested revision', {
        reason,
        activePlanId: state.metadata.activePlanId,
        finalRevisionCount: state.metadata.finalRevisionCount,
        suggestedTodos,
      });
      return { state, next: 'strategic_planner' };
    }

    delete (state.metadata as any).activePlanId;
    delete (state.metadata as any).activeTodo;

    // Check if LLM requested KnowledgeBase generation
    if (critique?.triggerKnowledgeBase === true) {
      agentLog(this.name, `LLM requested KB generation: ${critique.kbReason || 'no reason given'}`);
      this.triggerKnowledgeGraph(state);
    }

    return { state, next: 'end' };
  }

  private triggerKnowledgeGraph(state: ThreadState): void {
    agentLog(this.name, 'Triggering KnowledgeGraph async');

    getKnowledgeGraph().run({
      threadId: state.threadId,
      mode: 'async',
    }).catch(err => {
      console.error(`[StrategicCriticNode] KnowledgeGraph async trigger failed:`, err);
    });

    (state.metadata as any).knowledgeGraphTriggered = true;
  }
}
