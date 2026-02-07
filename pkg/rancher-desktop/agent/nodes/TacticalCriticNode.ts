// TacticalCriticNode.ts
// Reviews tactical step outcome and decides: approve / revise
// No retry counters — graph handles looping
// Neutral decision only — graph edges route

import type { HierarchicalThreadState, NodeResult } from './Graph';
import { BaseNode, JSON_ONLY_RESPONSE_INSTRUCTIONS } from './BaseNode';
import { AgentPlanTodo } from '../database/models/AgentPlanTodo';

const CRITIC_PROMPT = `
You are the Tactical Critic: 25-year senior DevOps & QA engineer auditing 1000+ mission-critical pipelines.

Milestone being reviewed:
- Title: {{milestone.title}}
- Description: {{milestone.description}}
- Success criteria: {{milestone.successCriteria}}

Overall goal: {{goal}}

Execution outcome:
- Status: {{execStatus}}
- Summary: {{execSummary}}
{{toolResults ? '- Tool results: ' + JSON.stringify(toolResults) : ''}}
{{executorIssues ? '- Executor issues: ' + executorIssues : ''}}

Rules:
- Approve ONLY if ALL success criteria are verifiably met (score >= 8/10)
- Revise if partial, wrong approach, or missing verification (score < 8)
- Be ruthless: downstream milestones fail on weak foundations
- Quote exact evidence from results or criteria
- Pragmatic on cosmetic issues; core outcome non-negotiable

${JSON_ONLY_RESPONSE_INSTRUCTIONS}
{
  "successScore": 0,                    // 0-10 integer
  "decision": "approve" | "revise",
  "reason": "One-sentence verdict with evidence",
  "suggestedFix": "Precise next action (optional)",
  "emit_chat_message": "Inform user about review"
}
`.trim();

/**
 * Tactical Critic Node
 *
 * Purpose:
 *   - Evaluates tactical step outcome against milestone criteria
 *   - Decides approve (done) or revise (retry)
 *   - Updates DB todo status on approve
 *   - Emits user-facing message if needed
 *
 * Key Design Decisions (2025 refactor):
 *   - No retry counters / maxRevisions — graph loop protection
 *   - Unified BaseNode.chat() + direct parsed .content
 *   - Neutral decision only — graph edges route to planner/executor
 *   - Direct DB access for todo status
 *   - WS feedback only on decision
 *   - No StrategicStateService dependency
 *
 * Input expectations:
 *   - state.metadata.plan exists (active milestone)
 *   - state.metadata.currentSteps[idx].done = true (step just finished)
 *   - HierarchicalThreadState shape
 *
 * Output mutations:
 *   - state.metadata.tacticalCriticVerdict = { status, reason, at }
 *   - DB: AgentPlanTodo.status = 'done' on approve
 *
 * @extends BaseNode
 */
export class TacticalCriticNode extends BaseNode {
  constructor() {
    super('tactical_critic', 'Tactical Critic');
  }

  async execute(state: HierarchicalThreadState): Promise<NodeResult<HierarchicalThreadState>> {
    const plan = state.metadata.plan;
    if (!plan?.model || !plan.milestones?.length) {
      return { state, decision: { type: 'next' } };
    }

    const milestoneIdx = plan.activeMilestoneIndex;
    const todo = plan.milestones[milestoneIdx]?.model as AgentPlanTodo | undefined;
    if (!todo) {
      return { state, decision: { type: 'next' } };
    }

    const step = state.metadata.currentSteps?.[state.metadata.activeStepIndex];
    if (!step || step.done === false) {
      return { state, decision: { type: 'next' } };
    }

    const enriched = await this.enrichPrompt(CRITIC_PROMPT, state, {
      includeSoul: true,
      includeAwareness: true,
      includeMemory: true,
      includeTools: true,
      includeStrategicPlan: true,
      includeTacticalPlan: true,
      includeKnowledgebasePlan: false,
    });

    const llmResponse = await this.chat(
      state,
      enriched,
      { format: 'json' }
    );

    if (!llmResponse) {
      return { state, decision: { type: 'next' } };
    }

    const data = llmResponse as {
      successScore: number;
      decision: 'approve' | 'revise';
      reason: string;
      suggestedFix?: string;
      emit_chat_message?: string;
    };

    const score = Number.isFinite(Number(data.successScore)) ? Math.max(0, Math.min(10, Number(data.successScore))) : 0;
    const decision = score >= 8 ? 'approve' : 'revise';

    state.metadata.tacticalCriticVerdict = {
      status: decision,
      reason: (data.reason || (decision === 'approve' ? 'Outcome meets criteria' : 'Outcome incomplete')) 
        + (data.suggestedFix ? `\n\nSuggested fix: ${data.suggestedFix}` : ''),
      at: Date.now(),
    };

    if (data.emit_chat_message?.trim()) {
      this.wsChatMessage(state, data.emit_chat_message, 'assistant', 'progress');
    }

    if (decision === 'approve') {
      todo.markStatus('done');
      await todo.save();

      return { state, decision: { type: 'next' } };
    }

    // Revise: block todo, emit feedback
    todo.markStatus('blocked');
    await todo.save();

    if (data.suggestedFix?.trim()) {
      state.metadata.tacticalCriticVerdict.reason = data.suggestedFix;
    }

    return { state, decision: { type: 'revise' } };
  }
}