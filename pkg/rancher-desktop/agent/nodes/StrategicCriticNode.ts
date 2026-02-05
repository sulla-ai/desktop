// StrategicCriticNode - Reviews overall plan completion and can request plan revision

import type { ThreadState, NodeResult } from '../types';
import { BaseNode, JSON_ONLY_RESPONSE_INSTRUCTIONS } from './BaseNode';
import { StrategicStateService } from '../services/StrategicStateService';
import { getKnowledgeGraph } from '../services/KnowledgeGraph';
import { agentError, agentLog } from '../services/AgentLogService';

export type StrategicCriticDecision = 'approve' | 'revise';

export class StrategicCriticNode extends BaseNode {
  private maxFinalRevisions = 2;

  constructor() {
    super('strategic_critic', 'Strategic Critic');
  }

  async execute(state: ThreadState): Promise<{ state: ThreadState; next: NodeResult }> {
    const activePlanId = (state.metadata.activePlanId !== undefined && state.metadata.activePlanId !== null && Number.isFinite(Number(state.metadata.activePlanId)))
      ? Number(state.metadata.activePlanId)
      : null;

    if (!activePlanId) {
      return { state, next: 'end' };
    }

    const finalRevisionCount = (state.metadata.finalRevisionCount as number) || 0;
    if (finalRevisionCount >= this.maxFinalRevisions) {
      state.metadata.finalCriticDecision = 'approve';
      state.metadata.finalCriticReason = 'Max final revisions reached';
      return { state, next: 'end' };
    }

    const strategicState = StrategicStateService.fromThreadState(state);
    await strategicState.initialize();
    await strategicState.refresh();
    const loaded = strategicState.getSnapshot();

    if (!loaded.plan) {
      state.metadata.finalCriticDecision = 'approve';
      state.metadata.finalCriticReason = 'Plan not found; ending';
      return { state, next: 'end' };
    }

    const goal = typeof (loaded.plan.data as any)?.goal === 'string' ? String((loaded.plan.data as any).goal) : '';
    const todos = loaded.todos.map(t => ({ id: t.id, title: t.title, description: t.description, status: t.status, orderIndex: t.orderIndex }));
    const anyRemaining = strategicState.hasRemainingTodos();

    if (anyRemaining) {
      const blocked = loaded.todos.filter(t => t.status === 'blocked');
      const pending = loaded.todos.filter(t => t.status === 'pending' || t.status === 'in_progress');
      const reasonParts: string[] = ['Plan has remaining todos'];
      if (blocked.length > 0) {
        reasonParts.push(`blocked=${blocked.map(t => t.title).join(', ')}`);
      }
      if (pending.length > 0) {
        reasonParts.push(`pending=${pending.map(t => t.title).join(', ')}`);
      }
      const reason = reasonParts.join(' | ');

      await strategicState.requestRevision(reason);

      state.metadata.finalCriticDecision = 'revise';
      state.metadata.finalCriticReason = reason;
      state.metadata.revisionFeedback = reason;
      state.metadata.requestPlanRevision = { reason };
      state.metadata.finalRevisionCount = finalRevisionCount + 1;

      agentError(this.name, 'Strategic critic requested revision (remaining todos)', {
        reason,
        activePlanId: state.metadata.activePlanId,
        planHasRemainingTodos: anyRemaining,
        todos,
      });
      return { state, next: 'strategic_planner' };
    }

    const responseText = typeof state.metadata.response === 'string' ? String(state.metadata.response) : '';

    const basePrompt = `You are the Final Overseer: a 25-year veteran systems architect & outcome auditor who has green-lit or killed 1000+ multi-million-dollar deployments and marketing campaigns (e.g., Body Glove full-funnel revamps hitting 3.2× ROAS, ClientBasis lead-routing systems achieving 97% delivery accuracy). You approve nothing unless the original goal is verifiably 100% satisfied—no partial credit, no “close enough.”

## Plan Goal
${goal || '(unknown)'}

## All Todos (full history & status)
${JSON.stringify(todos, null, 2)}

## Final User-Facing Response Delivered
${responseText}

## Evaluation Rules (non-negotiable)
1. Does EVERY success criterion from the original strategic plan hold true based on tool outputs, summaries, and final artifacts?
2. Are downstream dependencies (data, state, files, integrations) in the exact condition required for real-world value?
3. Was the enhanced / beyond-goal outcome (the delight layer) delivered, or at minimum not compromised?
4. No silent failures: security holes, partial batches, unverified outputs, orphaned temp files, or unlogged actions = automatic revise.
5. User-facing response must unambiguously reflect goal completion—not just “we tried.”

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
      includeTacticalPlan: true,
      includeKnowledgeGraphInstructions: 'critic',
    });

    const critique = await this.promptJSON<{
      decision: StrategicCriticDecision;
      reason?: string;
      suggestedTodos?: Array<{ title: string; description?: string; categoryHints?: string[] }>;
      triggerKnowledgeBase?: boolean;
      kbReason?: string;
    }>(prompt);

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

      agentError(this.name, 'Strategic critic requested revision', {
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
