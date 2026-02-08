import type { HierarchicalThreadState, NodeResult } from './Graph';
import { BaseNode, JSON_ONLY_RESPONSE_INSTRUCTIONS } from './BaseNode';

const STRATEGIC_CRITIC_PROMPT = `
You are the Strategic Critic: 25-year veteran systems architect & outcome auditor.

Goal: {{goal}}
Goal description: {{goalDescription}}

Current plan status:
{{planSnapshot}}

Rules:
- Approve ONLY if goal is 100% verifiably achieved (confidence ≥ 90)
- Revise if gaps remain, loops detected, or better path exists
- Kill-switch (rare): irreversible damage / security violation
- Pragmatic on diminishing returns: approve if marginal gain < token cost
- Suggest new todos only when clear high-ROI pivot

${JSON_ONLY_RESPONSE_INSTRUCTIONS}
{
  "decision": "approve" | "revise",
  "confidence": 0-100,
  "reason": "why this did or did not reach the goal?",
  "suggestions": "what should be done next?",
  "triggerKnowledgeBase": boolean,              // true if milestone worth documenting
  "killSwitch": boolean                         // true only on catastrophic failure
}
`.trim();

/**
 * Strategic Critic Node
 *
 * Purpose:
 *   - Final review of entire plan execution
 *   - Approves goal completion or requests revision
 *   - Triggers async KB generation when valuable
 *   - Updates plan status in DB on approval
 *
 * Key Design Decisions (2025 refactor):
 *   - Removed StrategicStateService, AgentLog, retry counters
 *   - Unified BaseNode.chat() + direct parsed .content
 *   - Neutral decision only — graph edges route
 *   - Direct AgentPlan DB update on approve
 *   - Minimal WS feedback on decision / KB trigger
 *   - No maxFinalRevisions — graph loop protection
 *
 * Input expectations:
 *   - state.metadata.plan exists & active
 *   - All tactical steps/milestones processed
 *   - HierarchicalThreadState shape
 *
 * Output mutations:
 *   - state.metadata.strategicCriticVerdict = { status, reason, at }
 *   - DB: plan.status = 'complete' on approve
 *   - Triggers async KB graph if requested
 *
 * @extends BaseNode
 */
export class StrategicCriticNode extends BaseNode {
  constructor() {
    super('strategic_critic', 'Strategic Critic');
  }

  async execute(state: HierarchicalThreadState): Promise<NodeResult<HierarchicalThreadState>> {
    const plan = state.metadata.plan;
    if (!plan?.model) {
      return { state, decision: { type: 'end' } };
    }

    const enriched = await this.enrichPrompt(STRATEGIC_CRITIC_PROMPT, state, {
      includeSoul: true,
      includeAwareness: true,
      includeMemory: true,
      includeTools: true,
      includeStrategicPlan: true,
      includeTacticalPlan: true,
      includeKnowledgebasePlan: false,
    });

    const llmResponse = await this.chat(state, enriched, { format: 'json' });

    if (!llmResponse) {
      return { state, decision: { type: 'end' } };
    }

    const data = llmResponse as {
      decision: 'approve' | 'revise';
      confidence: number;
      reason: string;
      suggestions?: string;
      triggerKnowledgeBase?: boolean;
      killSwitch?: boolean;
    };

    // Just write the facts
    state.metadata.strategicCriticVerdict = {
      status: data.decision,
      confidence: data.confidence,
      reason: data.reason || (data.decision === 'approve' ? 'Goal achieved' : 'Revision needed'),
      suggestions: data.suggestions,
      triggerKnowledgeBase: data.triggerKnowledgeBase,
      killSwitch: data.killSwitch,
      at: Date.now(),
    };

    // Let the conditional edge decide routing
    return { state, decision: { type: 'next' } };
  }
}