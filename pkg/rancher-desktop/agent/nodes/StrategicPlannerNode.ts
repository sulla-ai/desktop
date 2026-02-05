// StrategicPlannerNode - High-level planning with goals and milestones
// Creates abstract goals and works backwards to define milestones (first principles decomposition)
// Persists the strategic plan to the database

import type { ThreadState, NodeResult } from '../types';
import { BaseNode, JSON_ONLY_RESPONSE_INSTRUCTIONS } from './BaseNode';
import { parseJson } from '../services/JsonParseService';
import { agentLog, agentWarn } from '../services/AgentLogService';
import { StrategicStateService, type StrategicPlanData } from '../services/StrategicStateService';

interface StrategicPlan {
  // The primary goal the user wants to achieve
  goal: string;
  // Detailed description of what success looks like
  goalDescription: string;
  // Whether this requires tools/actions or just a conversational response
  requiresTools: boolean;
  // Estimated complexity of the task
  estimatedComplexity: 'simple' | 'moderate' | 'complex';
  // Whether a strategic plan is needed (simple queries may not need one)
  planNeeded: boolean;
  // Abstract milestones that lead to the goal (ordered)
  milestones: Array<{
    id: string;
    title: string;
    description: string;
    successCriteria: string;
    dependsOn: string[];
  }>;
  // Response guidance for the final output
  responseGuidance: {
    tone: 'formal' | 'casual' | 'technical' | 'friendly';
    format: 'brief' | 'detailed' | 'json' | 'markdown' | 'conversational';
  };
  // Direct response to user for simple tasks (optional)
  directResponse?: {
    emitToUser: boolean;
    content: string;
    role: string;
    kind: string;
  };
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

    console.log(`[Agent:StrategicPlanner] Context: ${state.messages.length} messages, thread: ${state.threadId}`);

    // Check if we're revising an existing plan
    const revisionContext = state.metadata.requestPlanRevision;
    const priorPlanId = state.metadata.activePlanId;
    const lastStrategicPlanError = typeof state.metadata.strategicPlanLastError === 'string'
      ? String(state.metadata.strategicPlanLastError)
      : '';

    // Generate strategic plan
    const strategicPlan = await this.generateStrategicPlan(
      state,
      revisionContext
        ? String((revisionContext as any).reason || '')
        : (lastStrategicPlanError || undefined),
    );

    if (strategicPlan) {
      delete state.metadata.strategicPlanLastError;
      state.metadata.strategicPlanRetryCount = 0;
      console.log(`[Agent:StrategicPlanner] Strategic plan created:`);
      console.log(`  Goal: ${strategicPlan.goal}`);
      console.log(`  Complexity: ${strategicPlan.estimatedComplexity}`);
      console.log(`  Plan needed: ${strategicPlan.planNeeded}`);
      console.log(`  Requires tools: ${strategicPlan.requiresTools}`);
      console.log(`  Milestones: ${strategicPlan.milestones.map(m => m.title).join(' → ')}`);

      if (strategicPlan.planNeeded && strategicPlan.milestones.length > 0) {
        // Persist to database - milestones become the high-level todos
        try {
          const strategicState = StrategicStateService.fromThreadState(state);
          await strategicState.initialize();

          const todos = strategicPlan.milestones.map((m, idx) => ({
            title: m.title,
            description: `${m.description}\n\nSuccess Criteria: ${m.successCriteria}`,
            orderIndex: idx,
            categoryHints: [], // Strategic milestones don't have tool hints
          }));

          const planData: StrategicPlanData = {
            type: 'strategic',
            goal: strategicPlan.goal,
            goalDescription: strategicPlan.goalDescription,
            estimatedComplexity: strategicPlan.estimatedComplexity,
            responseGuidance: strategicPlan.responseGuidance,
          };

          if (priorPlanId && revisionContext) {
            // Revise existing plan
            console.log(`[Agent:StrategicPlanner] Revising plan ${priorPlanId}`);
            const revised = await strategicState.revisePlan({
              planId: Number(priorPlanId),
              data: planData,
              milestones: todos.map(t => ({ title: t.title, description: t.description, orderIndex: t.orderIndex })),
              eventData: { revision_reason: (revisionContext as any).reason },
            });

            if (revised) {
              console.log(`[Agent:StrategicPlanner] Plan revised: planId=${revised.planId} revision=${revised.revision}`);
              state.metadata.activePlanId = revised.planId;
            }
          } else {
            // Create new plan
            console.log(`[Agent:StrategicPlanner] Creating new strategic plan`);
            const createdPlanId = await strategicState.createPlan({
              data: planData,
              milestones: todos.map(t => ({ title: t.title, description: t.description, orderIndex: t.orderIndex })),
              eventData: { goal: strategicPlan.goal },
            });

            if (createdPlanId) {
              console.log(`[Agent:StrategicPlanner] Plan created: planId=${createdPlanId}`);
              state.metadata.activePlanId = createdPlanId;
            }
          }

          // Clear revision flags
          delete state.metadata.requestPlanRevision;
          delete state.metadata.revisionFeedback;

        } catch (err) {
          console.error(`[Agent:StrategicPlanner] Failed to persist plan:`, err);
        }

        // Store strategic plan in state for tactical planner
        // Map DB todoIds to milestones so we can emit todo_status events later
        const strategicStateForMapping = StrategicStateService.fromThreadState(state);
        await strategicStateForMapping.initialize();
        state.metadata.strategicPlan = {
          goal: strategicPlan.goal,
          goalDescription: strategicPlan.goalDescription,
          milestones: strategicPlan.milestones.map((m, idx) => {
            return {
              ...m,
              status: 'pending' as const,
              todoId: strategicStateForMapping.getTodoIdByOrderIndex(idx), // DB todoId for UI events
            };
          }),
          requiresTools: strategicPlan.requiresTools,
          estimatedComplexity: strategicPlan.estimatedComplexity,
        };

        // Set first milestone as active
        if (strategicPlan.milestones.length > 0) {
          const first = strategicPlan.milestones[0];
          const firstStateMilestone = state.metadata.strategicPlan.milestones.find(m => m.id === first.id);
          if (firstStateMilestone) {
            (firstStateMilestone as any).status = 'in_progress';
            const todoIdFirst = (firstStateMilestone as any).todoId as number | undefined;
            if (todoIdFirst) {
              await strategicStateForMapping.inprogressTodo(todoIdFirst, firstStateMilestone.title);
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

        state.metadata.planHasRemainingTodos = strategicStateForMapping.hasRemainingTodos();

      } else {
        // Simple query - no strategic plan needed
        console.log(`[Agent:StrategicPlanner] No strategic plan needed for this query`);
        state.metadata.planHasRemainingTodos = false;
        
        // Store minimal plan info for response generation
        state.metadata.plan = {
          planNeeded: false,
          goal: strategicPlan.goal,
          requiresTools: false,
        };
      }

      return { state, next: 'continue' };
    }

    // Strategic planning failed (parse/validation/etc). Do not continue until a valid plan exists.
    state.metadata.llmFailureCount = llmFailureCount + 1;
    state.metadata.strategicPlanRetryCount = strategicPlanRetryCount + 1;

    if (strategicPlanRetryCount + 1 >= 2) {
      console.error(`[Agent:StrategicPlanner] Strategic plan failed after ${strategicPlanRetryCount + 1} attempts, ending`);
      state.metadata.error = typeof state.metadata.strategicPlanLastError === 'string'
        ? String(state.metadata.strategicPlanLastError)
        : 'Strategic planning failed after multiple attempts';
      return { state, next: 'end' };
    }

    agentWarn(this.name, 'Strategic plan invalid; retrying StrategicPlanner', {
      strategicPlanRetryCount: strategicPlanRetryCount + 1,
      strategicPlanLastError: state.metadata.strategicPlanLastError,
    });

    this.emitProgress(state, 'strategic_plan_retry', {
      attempt: strategicPlanRetryCount + 1,
      reason: state.metadata.strategicPlanLastError,
    });

    return { state, next: 'strategic_planner' };
  }

  private async generateStrategicPlan(
    state: ThreadState,
    revisionReason?: string,
  ): Promise<StrategicPlan | null> {
    const basePrompt = `IMPORTANT YOUR ARE A STRATEGICPLANNERNODE INSIDE OF A HEIRARCHICAL LANG GRAPH.
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
  IMPORTANT: emit_chat_message = null; do not send a message when there is no plan
}
`}

## Your Approach
1. **Identify Primary Goal**: Uncover the true win-condition, beyond surface ask—e.g., not just "book flight," but seamless travel with upgrades and backups.
2. **Anticipate Beyond**: Predict 1-2 unstated delights (e.g., cost savings, risk hedges, scalability) to exceed expectations, like Southwest's hedging for fuel stability.
3. **Expert Lens**: Discard obvious routes (e.g., basic search); prioritize proven plays from 1000+ cases—what crushes benchmarks, like Shopify's API ecosystems for 4x growth.
4. **Scenario Planning**: Outline 2-3 paths (optimal, fallback, stretch) with risks/metrics, drawing analogies from real wins (e.g., Netflix's pivot to streaming).
5. **Work Backwards**: From enhanced goal, map milestones with efficiencies.
6. **First Principles**: Deconstruct to core checkpoints, embedding shortcuts.
7. **Success Criteria**: Use the SMARTER goals framework for Specific Measurable Achievable Relevant Time-bound Emotionally compelling and Rewarding.

## MUT follow Guidelines
- Do not ask questions
- Do not run tools yourself
- Milestones: As needed, fewer preferred; include 1-2 high-leverage enhancements.
- Abstract goals only—no specifics on tools/actions.
- Criteria: Measurable, with expert foresight (e.g., "2x ROI benchmark").
- Skip for simple queries (planNeeded: false).
- Think lifelike: "What's the 80/20 lever? How do pros like Google (data-driven pivots) ace this?"
- Think like a human: "What do I need to accomplish to reach this goal?"

${JSON_ONLY_RESPONSE_INSTRUCTIONS}
{
  "goal": "The user's primary objective in one sentence",
  "goalDescription": "Detailed description of what success looks like",
  "requiresTools": boolean,
  "estimatedComplexity": "simple" | "moderate" | "complex",
  "planNeeded": boolean,
  "milestones": [
    {
      "id": "milestone_1",
      "title": "Short milestone title",
      "description": "What this milestone accomplishes",
      "successCriteria": "How we know this milestone is complete",
      "dependsOn": []
    }
  ],
  "responseGuidance": {
    "tone": "formal" | "casual" | "technical" | "friendly",
    "format": "brief" | "detailed" | "json" | "markdown" | "conversational"
  },
  "emit_chat_message": string | null
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

      agentLog(this.name, `LLM response received (${response.content.length} chars)`);
      
      const plan = parseJson<any>(response.content);
      if (!plan) {
        state.metadata.strategicPlanLastError = 'Failed to parse JSON for strategic plan. Output must be a single valid JSON object matching the required schema.';
        agentWarn(this.name, 'Failed to parse plan JSON from response', { responseLength: response.content.length });
        return null;
      }

      // Normalize fields (do not hard-fail when the model omits optional high-level fields).
      const lastUser = state.messages.filter(m => m.role === 'user').pop();
      const lastUserText = lastUser?.content ? String(lastUser.content) : '';

      if (typeof plan.goal !== 'string' || !plan.goal.trim()) {
        plan.goal = lastUserText ? lastUserText.slice(0, 160) : '';
      }
      if (typeof plan.goalDescription !== 'string') {
        plan.goalDescription = '';
      }

      // Ensure milestones array exists
      if (!Array.isArray(plan.milestones)) {
        plan.milestones = [];
      }

      if (typeof plan.planNeeded !== 'boolean') {
        plan.planNeeded = plan.milestones.length > 0;
      }
      if (typeof plan.requiresTools !== 'boolean') {
        plan.requiresTools = plan.planNeeded;
      }
      if (plan.estimatedComplexity !== 'simple' && plan.estimatedComplexity !== 'moderate' && plan.estimatedComplexity !== 'complex') {
        plan.estimatedComplexity = plan.planNeeded ? 'moderate' : 'simple';
      }
      if (!plan.responseGuidance || typeof plan.responseGuidance !== 'object') {
        plan.responseGuidance = { tone: 'technical', format: 'detailed' };
      }
      if (plan.responseGuidance.tone !== 'formal' && plan.responseGuidance.tone !== 'casual' && plan.responseGuidance.tone !== 'technical' && plan.responseGuidance.tone !== 'friendly') {
        plan.responseGuidance.tone = 'technical';
      }
      if (plan.responseGuidance.format !== 'brief' && plan.responseGuidance.format !== 'detailed' && plan.responseGuidance.format !== 'json' && plan.responseGuidance.format !== 'markdown' && plan.responseGuidance.format !== 'conversational') {
        plan.responseGuidance.format = 'detailed';
      }

      // dont show messages when the plan is not needed
      if (plan.planNeeded) {
        const emit_chat_message = (plan as any).emit_chat_message || '';
        if (emit_chat_message){
          await this.emitChatMessage(state, emit_chat_message);
        }
      }

      // Ensure each milestone has required fields
      plan.milestones = plan.milestones.map((m: any, idx: number) => ({
        id: m.id || `milestone_${idx + 1}`,
        title: m.title || `Milestone ${idx + 1}`,
        description: m.description || '',
        successCriteria: m.successCriteria || 'Milestone completed',
        dependsOn: Array.isArray(m.dependsOn) ? m.dependsOn : [],
        generateKnowledgeBase: m.generateKnowledgeBase === true,
      }));

      return plan as StrategicPlan;

    } catch (err) {
      state.metadata.strategicPlanLastError = `Strategic plan generation error: ${String((err as any)?.message || err)}`;
      console.error('[Agent:StrategicPlanner] Plan generation failed:', err);
      return null;
    }
  }

}
