// StrategicPlannerNode.ts
// Updated: uses AgentPlan / AgentPlanTodo models directly
// Removed PlanService dependency — no breaking changes to API/signature

import type { ThreadState, NodeResult } from '../types';
import { BaseNode, JSON_ONLY_RESPONSE_INSTRUCTIONS } from './BaseNode';
import { parseJson } from '../services/JsonParseService';
import { agentLog, agentWarn } from '../services/AgentLogService';
import { StrategicStateService, type StrategicPlanData } from './state/StrategicStateService';
import { AgentPlan } from '../database/models/AgentPlan';
import { AgentPlanTodo } from '../database/models/AgentPlanTodo';

interface StrategicPlan {
  goal: string;
  goalDescription: string;
  requiresTools: boolean;
  estimatedComplexity: 'simple' | 'moderate' | 'complex';
  planNeeded: boolean;
  milestones: Array<{
    id: string;
    title: string;
    description: string;
    successCriteria: string;
    dependsOn: string[];
    status: 'pending' | 'completed' | 'in_progress' | 'failed';
    todoId?: number;
  }>;
  responseGuidance: {
    tone: 'formal' | 'casual' | 'technical' | 'friendly';
    format: 'brief' | 'detailed' | 'json' | 'markdown' | 'conversational';
  };
  emit_chat_message?: string;
}

export class StrategicPlannerNode extends BaseNode {
  constructor() {
    super('strategic_planner', 'StrategicPlanner');
  }

  async execute(state: ThreadState): Promise<{ state: ThreadState; next: NodeResult }> {
    console.log(`[Agent:StrategicPlanner] Executing...`);

    const llmFailureCount = (state.metadata.llmFailureCount as number) || 0;
    const strategicPlanRetryCount = (state.metadata.strategicPlanRetryCount as number) || 0;

    const lastUserMessage = state.messages.filter(m => m.role === 'user').pop();
    if (!lastUserMessage) {
      console.log(`[Agent:StrategicPlanner] No user message, ending`);
      return { state, next: 'end' };
    }

    const revisionContext = state.metadata.requestPlanRevision;
    const priorPlanId = state.metadata.activePlanId;
    const lastStrategicPlanError = typeof state.metadata.strategicPlanLastError === 'string'
      ? String(state.metadata.strategicPlanLastError)
      : '';

    const strategicPlan = await this.generateStrategicPlan(
      state,
      revisionContext ? String((revisionContext as any).reason || '') : (lastStrategicPlanError || undefined),
    );

    if (!strategicPlan) {
      state.metadata.llmFailureCount = llmFailureCount + 1;
      state.metadata.strategicPlanRetryCount = strategicPlanRetryCount + 1;

      if (strategicPlanRetryCount + 1 >= 2) {
        console.error(`[Agent:StrategicPlanner] Strategic plan failed after ${strategicPlanRetryCount + 1} attempts`);
        state.metadata.error = state.metadata.strategicPlanLastError || 'Strategic planning failed';
        return { state, next: 'end' };
      }

      agentWarn(this.name, 'Strategic plan invalid; retrying', {
        attempt: strategicPlanRetryCount + 1,
      });

      return { state, next: 'strategic_planner' };
    }

    delete state.metadata.strategicPlanLastError;
    state.metadata.strategicPlanRetryCount = 0;

    if (strategicPlan.planNeeded && strategicPlan.milestones.length > 0) {
      try {
        const strategicState = StrategicStateService.fromThreadState(state);
        await strategicState.initialize();

        const todos = strategicPlan.milestones.map((m, idx) => ({
          title: m.title,
          description: `${m.description}\n\nSuccess Criteria: ${m.successCriteria}`,
          orderIndex: idx,
          categoryHints: [],
        }));

        const planData: StrategicPlanData = {
          type: 'strategic',
          goal: strategicPlan.goal,
          goalDescription: strategicPlan.goalDescription,
          estimatedComplexity: strategicPlan.estimatedComplexity,
          responseGuidance: strategicPlan.responseGuidance,
        };

        if (priorPlanId && revisionContext) {
          console.log(`[Agent:StrategicPlanner] Revising plan ${priorPlanId}`);
          const revised = await strategicState.revisePlan({
            planId: Number(priorPlanId),
            data: planData,
            milestones: todos.map(t => ({ title: t.title, description: t.description, orderIndex: t.orderIndex })),
          });

          if (revised) {
            state.metadata.activePlanId = revised.planId;
          }
        } else {
          console.log(`[Agent:StrategicPlanner] Creating new plan`);
          const createdPlanId = await strategicState.createPlan({
            data: planData,
            milestones: todos.map(t => ({ title: t.title, description: t.description, orderIndex: t.orderIndex })),
          });

          if (createdPlanId) {
            state.metadata.activePlanId = createdPlanId;
          }
        }

        // Clear revision flags
        delete state.metadata.requestPlanRevision;
        delete state.metadata.revisionFeedback;

        // Map milestones to DB todos for state
        await strategicState.refresh();
        state.metadata.strategicPlan = {
          goal: strategicPlan.goal,
          goalDescription: strategicPlan.goalDescription,
          milestones: strategicPlan.milestones.map((m, idx) => ({
            ...m,
            status: 'pending' as const,
            todoId: strategicState.getTodoIdByOrderIndex(idx),
          })) as Array<{
            id: string;
            title: string;
            description: string;
            successCriteria: string;
            dependsOn: string[];
            status: 'pending' | 'completed' | 'in_progress' | 'failed';
            todoId?: number;
          }>,
          requiresTools: strategicPlan.requiresTools,
          estimatedComplexity: strategicPlan.estimatedComplexity,
        };

        // Activate first milestone
        if (strategicPlan.milestones.length > 0) {
          const first = strategicPlan.milestones[0];
          const firstMilestone = state.metadata.strategicPlan.milestones.find((m: any) => m.id === first.id);
          if (firstMilestone) {
            firstMilestone.status = 'in_progress';
            const todoId = firstMilestone.todoId as number | undefined;
            if (todoId) {
              await strategicState.inprogressTodo(todoId, first.title);
            }
          }
          (state.metadata as any).activeMilestone = {
            id: first.id,
            title: first.title,
            description: first.description,
            successCriteria: first.successCriteria,
            generateKnowledgeBase: (first as any).generateKnowledgeBase === true,
          };
        }

        state.metadata.planHasRemainingTodos = strategicState.hasRemainingTodos();

      } catch (err) {
        console.error(`[Agent:StrategicPlanner] Failed to persist plan:`, err);
        state.metadata.strategicPlanLastError = err instanceof Error ? err.message : String(err);
      }

      if (strategicPlan.emit_chat_message) {
        await this.emitChatMessage(state, strategicPlan.emit_chat_message);
      }

      return { state, next: 'continue' };
    }

    // No plan needed — simple response
    console.log(`[Agent:StrategicPlanner] No strategic plan needed`);
    state.metadata.planHasRemainingTodos = false;
    state.metadata.plan = {
      planNeeded: false,
      goal: strategicPlan.goal,
      requiresTools: false,
    };

    if (strategicPlan.emit_chat_message) {
      await this.emitChatMessage(state, strategicPlan.emit_chat_message);
    }

    return { state, next: 'end' };
  }

  private async generateStrategicPlan(
    state: ThreadState,
    revisionReason?: string,
  ): Promise<StrategicPlan | null> {
    const basePrompt = `IMPORTANT: YOU ARE A STRATEGICPLANNERNODE INSIDE OF A HIERARCHICAL LANG GRAPH.
You need to think like an expert strategic planner with 20+ years across industries—tech (e.g., Amazon's predictive scaling for 40% efficiency gains), retail (Zappos' personalization driving 30% repeats), nonprofits (SWOT-led 25% donation boosts). Avoid novice pitfalls like generic steps; craft high-leverage, low-risk plans from battle-tested tactics that deliver 2-5x results. Expose blind spots, rethink assumptions, use foresight for lifelike overdelivery.

${revisionReason ? 
`## Revision Required
The previous plan needs revision because: ${revisionReason}
` : `
## Decision Tree
if (the inquiry does require a plan to be successful) {
  planNeeded = true;
  emit_chat_message = reiterate the goal of the inquiry and conversationally explain the plan;
  Important: use the milestones array to outline the plan
}
else {
  planNeeded = false; 
  IMPORTANT: emit_chat_message = respond to the user
}`}

## Your Approach
1. Identify Primary Goal: Uncover the true win-condition.
2. Anticipate Beyond: Predict unstated delights.
3. Expert Lens: Prioritize proven plays.
4. Scenario Planning: Outline optimal/fallback/stretch paths.
5. Work Backwards: Map milestones with efficiencies.
6. First Principles: Deconstruct to core checkpoints.
7. Success Criteria: Use SMARTER goals.

## Guidelines
- If more than one step → create plan
- Do not ask questions
- Do not run tools yourself
- Milestones: fewer preferred; include 1-2 enhancements
- Abstract goals only

${JSON_ONLY_RESPONSE_INSTRUCTIONS}
{
  "goal": "Primary objective in one sentence",
  "goalDescription": "What success looks like",
  "requiresTools": boolean,
  "estimatedComplexity": "simple" | "moderate" | "complex",
  "planNeeded": boolean,
  "milestones": [
    {
      "id": "milestone_1",
      "title": "Short title",
      "description": "What it accomplishes",
      "successCriteria": "How we know it's done",
      "dependsOn": []
    }
  ],
  "responseGuidance": {
    "tone": "formal" | "casual" | "technical" | "friendly",
    "format": "brief" | "detailed" | "json" | "markdown" | "conversational"
  },
  "emit_chat_message": "string to show user if planNeeded"
}
`;

    const prompt = await this.enrichPrompt(basePrompt, state, {
      includeSoul: true,
      includeAwareness: true,
      includeMemory: true,
      includeTools: true,
      toolDetail: 'names',
      includeSkills: false,
      includeStrategicPlan: false,
      includeKnowledgeGraphInstructions: 'planner',
    });

    agentLog(this.name, `Prompt built (${prompt.length} chars)`);

    try {
      const response = await this.prompt(prompt, state, false);

      if (!response?.content) {
        agentWarn(this.name, 'No response from LLM');
        return null;
      }

      const plan = parseJson<StrategicPlan>(response.content);
      if (!plan) {
        state.metadata.strategicPlanLastError = 'Failed to parse JSON for strategic plan';
        agentWarn(this.name, 'Failed to parse plan JSON');
        return null;
      }

      // Normalize & defaults
      plan.goal = plan.goal?.trim() || 'Unspecified goal';
      plan.goalDescription = plan.goalDescription?.trim() || '';
      plan.requiresTools = !!plan.requiresTools;
      plan.estimatedComplexity = plan.estimatedComplexity || 'moderate';
      plan.planNeeded = !!plan.planNeeded;
      plan.milestones = Array.isArray(plan.milestones) ? plan.milestones : [];
      plan.responseGuidance = plan.responseGuidance || { tone: 'technical', format: 'detailed' };

      return plan;
    } catch (err) {
      state.metadata.strategicPlanLastError = `Strategic plan generation error: ${String(err)}`;
      console.error('[Agent:StrategicPlanner] Plan generation failed:', err);
      return null;
    }
  }
}