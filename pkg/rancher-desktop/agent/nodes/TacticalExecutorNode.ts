// TacticalExecutorNode.ts
// Executes current tactical step: decides tools, runs them, updates step/milestone status
// Only runs when currentSteps + activeStepIndex exist (guaranteed by graph flow)

import type { HierarchicalThreadState, NodeResult } from './Graph';
import { BaseNode, JSON_ONLY_RESPONSE_INSTRUCTIONS } from './BaseNode';
import { AgentPlanTodo } from '../database/models/AgentPlanTodo';

const TACTICAL_EXECUTOR_PROMPT = `
You are the Tactical Executor: 25-year senior DevOps & security engineer running on the Primary User's primary machine.

Current tactical step:
{{step.action}} — {{step.description}}

Milestone context: {{milestone.title}} — {{milestone.description}}
Success criteria: {{milestone.successCriteria}}

Overall goal: {{goal}}

Most recent result: {{lastResult}}

Core Directives (non-negotiable):
- PROTECT THE PRIMARY MACHINE AT ALL COSTS
- NO PII ever leaves this system
- Ephemeral /tmp dirs only — auto-wipe after use
- Dry-run / echo every dangerous command first
- Risk > low → abort + explain
- If unsure → stop + error, never guess

Execution personality:
- Relentlessly persistent, creative, borderline obsessive about success
- Pivot inventively around blocks — chain tools, write tiny helpers if needed
- Retry failed actions 2–3× with variation/backoff
- Validate every outcome against step success criteria

Process:
1. Analyze step + recent result
2. Decide minimal, safest tool sequence
3. Preview each action via emit_chat_message
4. Execute tools in order
5. Verify progress / completion
6. On finish: emit final confirmation + evidence

Mandatory:
- emit_chat_message before EVERY non-trivial action
- 1-line preview: what tool/command + why
- On blocker: explain + next attempt
- On completion: "Step done. Evidence: [proof]"

${JSON_ONLY_RESPONSE_INSTRUCTIONS}
{
  "tools": [
    ["tool_name", "arg1", "arg2"],
    ["emit_chat_message", "User update"]
  ],
  "markDone": true | false
}
`.trim();

/**
 * Tactical Executor Node
 *
 * Purpose:
 *   - Executes current tactical step via LLM tool decisions
 *   - Runs tools, appends results to messages
 *   - Updates step done status
 *   - Advances active step index or marks milestone complete
 *
 * Key Design Decisions (2025 refactor):
 *   - No no-plan fallback — assumes currentSteps + activeStepIndex exist
 *   - Unified BaseNode.chat() + executeToolCalls()
 *   - Direct .content object access (parsed JSON)
 *   - Neutral decision — graph edges route to critic / next step
 *   - WS feedback only on step completion / failure
 *   - Updates AgentPlanTodo in DB on step/milestone done
 *
 * Input expectations:
 *   - state.metadata.currentSteps exists & non-empty
 *   - state.metadata.activeStepIndex valid
 *   - HierarchicalThreadState shape
 *
 * Output mutations:
 *   - state.metadata.currentSteps[i].done = true when finished
 *   - state.metadata.activeStepIndex++ or cleared on milestone done
 *   - DB: AgentPlanTodo status updated
 *
 * @extends BaseNode
 */
export class TacticalExecutorNode extends BaseNode {
  constructor() {
    super('tactical_executor', 'Tactical Executor');
  }

  async execute(state: HierarchicalThreadState): Promise<NodeResult<HierarchicalThreadState>> {
    const plan = state.metadata.plan;
    const steps = state.metadata.currentSteps ?? [];
    const stepIdx = state.metadata.activeStepIndex ?? 0;

    if (stepIdx >= steps.length || !steps[stepIdx]) {
      console.log('[TacticalExecutor] Invalid step index — skipping');
      return { state, decision: { type: 'next' } };
    }

    const step = steps[stepIdx];
    const milestoneIdx = plan?.activeMilestoneIndex ?? 0;
    const currentTodo = plan?.milestones?.[milestoneIdx]?.model as AgentPlanTodo | undefined;

    // Build prompt with current step context
    const prompt = TACTICAL_EXECUTOR_PROMPT;

    const enriched = await this.enrichPrompt(prompt, state, {
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
      return { state, decision: { type: 'next' } };
    }

    const data = llmResponse as { tools: any[]; markDone: boolean };
    const tools = Array.isArray(data.tools) ? data.tools : [];

    // Execute tools if instructed
    if (tools.length > 0) {
      await this.executeToolCalls(state, tools);
    }

    // Update step status only — no routing
    if (data.markDone === true) {
      step.done = true;
      step.resultSummary = 'Step completed successfully'; // or parse from last tool result

      if (currentTodo) {
        currentTodo.markStatus('done');
        await currentTodo.save();
        console.log('[TacticalExecutor] Milestone todo marked done');
      }

      // Advance index if more steps exist
      if (stepIdx + 1 < steps.length) {
        state.metadata.activeStepIndex = stepIdx + 1;
      } else {
        // All steps done for this milestone
        state.metadata.currentSteps = [];
        state.metadata.activeStepIndex = 0;
        if (plan) {
          plan.activeMilestoneIndex = milestoneIdx + 1;
          plan.allMilestonesComplete = plan.activeMilestoneIndex >= (plan.milestones?.length ?? 0);
        }
      }
    }

    // Always next — graph decides if more work or critic/summary
    return { state, decision: { type: 'next' } };
  }
}