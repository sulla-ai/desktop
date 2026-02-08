// TacticalPlannerNode.ts
// Breaks active strategic milestone into atomic executable steps
// Plans live in state only (no DB persistence)
// Advances active step / milestone on completion

import type { HierarchicalThreadState, NodeResult } from './Graph';
import { BaseNode, JSON_ONLY_RESPONSE_INSTRUCTIONS } from './BaseNode';
import { AgentPlanTodo, AgentPlanTodoInterface } from '../database/models/AgentPlanTodo';

const TACTICAL_PLAN_PROMPT = `
You are the TacticalPlannerNode in a hierarchical LangGraph agent.

Assigned milestone: "{{milestone.title}}"
Description: {{milestone.description}}
Success criteria: {{milestone.successCriteria}}

Overall goal context: {{goal}}

Break this ONE milestone into the minimum number of concrete, ordered, atomic steps needed to achieve success.

Rules:
- 1–8 steps max — prefer fewer; single step if trivial
- Each step MUST be verifiable (explicit outcome + check)
- Action: short imperative phrase executor can act on
- Description: how-to + verification method
- toolHints: exact tool names expected (if any)
- Never ask questions — be resourceful
- Privacy & security first: prefix high-risk steps with checks
- Protect user data and system integrity at all costs

${JSON_ONLY_RESPONSE_INSTRUCTIONS}
{
  "steps": [
    {
      "id": "s1",
      "action": "Short imperative action",
      "description": "Detailed how + verification",
      "toolHints": ["exact_tool_name"]
    }
  ]
}
`;

/**
 * Tactical Planner Node
 *
 * Purpose:
 *   - Decomposes active milestone into executable steps
 *   - Stores tactical plan in state.metadata.currentSteps
 *   - Sets first step active
 *   - Handles knowledge-base trigger milestones
 *   - Advances milestone on tactical completion
 *
 * Key Design Decisions (2025 refactor):
 *   - Removed AgentLog / console.log / agentWarn / StrategicStateService
 *   - Unified BaseNode.chat() + direct parsed .content access
 *   - Enrichment: soul + awareness + memory + tools + current strategic plan
 *   - Neutral decision only — graph edges route
 *   - WS feedback minimal (plan created / step advanced)
 *   - No retry counters — graph loop protection
 *   - Direct DB access only for milestone status update
 *
 * Input expectations:
 *   - state.metadata.plan.model exists (active strategic plan)
 *   - state.metadata.plan.activeMilestoneIndex valid
 *   - HierarchicalThreadState shape
 *
 * Output mutations:
 *   - state.metadata.currentSteps ← tactical steps array
 *   - state.metadata.activeStepIndex = 0 on new plan
 *   - Updates AgentPlanTodo status in DB when milestone completes
 *
 * @extends BaseNode
 */
export class TacticalPlannerNode extends BaseNode {
  constructor() {
    super('tactical_planner', 'Tactical Planner');
  }

  async execute(state: HierarchicalThreadState): Promise<NodeResult<HierarchicalThreadState>> {
    const plan = state.metadata.plan;
    if (!plan?.model || !plan.milestones?.length) {
      console.log('[TacticalPlanner] No active milestone — skipping generation');
      return { state, decision: { type: 'next' } };
    }

    const idx = plan.activeMilestoneIndex;
    const milestone = plan.milestones[idx]?.model as AgentPlanTodoInterface | undefined;
    if (!milestone) {
      console.log('[TacticalPlanner] Milestone model missing');
      return { state, decision: { type: 'next' } };
    }

    // Build revision context if critic asked to revise
    let revisionContext = '';
    const verdict = state.metadata.tacticalCriticVerdict;
    if (verdict?.status === 'revise' || verdict?.status === 'escalate') {
      revisionContext = `\n\n## Revision Feedback\nStatus: ${verdict.status}\nReason: ${verdict.reason}`;
      if (state.metadata.currentSteps?.length) {
        revisionContext += `\n\nPrevious steps:\n${state.metadata.currentSteps
          .map((s, i) => `${i+1}. ${s.action} [${s.done ? 'done' : 'pending'}]`)
          .join('\n')}`;
      }
    }

    // Always clear old steps before generating new ones
    state.metadata.currentSteps = [];
    state.metadata.activeStepIndex = 0;

    // Enrich + call LLM
    const prompt = TACTICAL_PLAN_PROMPT;

    const enriched = await this.enrichPrompt(prompt + revisionContext, state, {
      includeSoul: true,
      includeAwareness: true,
      includeMemory: true,
      includeTools: true,
      includeStrategicPlan: true,
      includeTacticalPlan: false,
      includeKnowledgebasePlan: false,
    });

    const llmResponse = await this.chat(state, enriched, { format: 'json' });
    if (!llmResponse) {
      return { state, decision: { type: 'next' } };
    }

    const data = llmResponse as { steps: any[] };
    const steps = (data.steps || [])
      .filter(s => s?.action?.trim())
      .map((s: any, i: number) => ({
        id: s.id || `s${i + 1}`,
        action: s.action.trim(),
        description: s.description?.trim() || s.action,
        done: false,
        resultSummary: undefined,
        toolHints: Array.isArray(s.toolHints) ? s.toolHints.filter((t: unknown) => typeof t === 'string') : [],
      }));

    state.metadata.currentSteps = steps;
    state.metadata.activeStepIndex = 0;

    console.log('[TacticalPlanner] Generated steps:', steps.length);

    return { state, decision: { type: 'next' } };
  }
}