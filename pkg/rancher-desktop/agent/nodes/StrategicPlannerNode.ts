// StrategicPlannerNode - High-level planning with goals and milestones
// Creates abstract goals and works backwards to define milestones (first principles decomposition)
// Persists the strategic plan to the database

import type { ThreadState, NodeResult } from '../types';
import { BaseNode, JSON_ONLY_RESPONSE_INSTRUCTIONS } from './BaseNode';
import { getPlanService } from '../services/PlanService';
import { getAwarenessService } from '../services/AwarenessService';

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
}

export class StrategicPlannerNode extends BaseNode {
  constructor() {
    super('strategic_planner', 'StrategicPlanner');
  }

  async execute(state: ThreadState): Promise<{ state: ThreadState; next: NodeResult }> {
    console.log(`[Agent:StrategicPlanner] Executing...`);
    const emit = state.metadata.__emitAgentEvent as ((event: { type: 'progress' | 'chunk' | 'complete' | 'error'; threadId: string; data: unknown }) => void) | undefined;

    const llmFailureCount = (state.metadata.llmFailureCount as number) || 0;

    const lastUserMessage = state.messages.filter(m => m.role === 'user').pop();
    if (!lastUserMessage) {
      console.log(`[Agent:StrategicPlanner] No user message, ending`);
      return { state, next: 'end' };
    }

    console.log(`[Agent:StrategicPlanner] Context: ${state.messages.length} messages, thread: ${state.threadId}`);

    // Check if we're revising an existing plan
    const revisionContext = state.metadata.requestPlanRevision;
    const priorPlanId = state.metadata.activePlanId;

    // Generate strategic plan
    const strategicPlan = await this.generateStrategicPlan(
      state,
      revisionContext ? String((revisionContext as any).reason || '') : undefined,
    );

    if (strategicPlan) {
      console.log(`[Agent:StrategicPlanner] Strategic plan created:`);
      console.log(`  Goal: ${strategicPlan.goal}`);
      console.log(`  Complexity: ${strategicPlan.estimatedComplexity}`);
      console.log(`  Plan needed: ${strategicPlan.planNeeded}`);
      console.log(`  Requires tools: ${strategicPlan.requiresTools}`);
      console.log(`  Milestones: ${strategicPlan.milestones.map(m => m.title).join(' → ')}`);

      if (strategicPlan.planNeeded && strategicPlan.milestones.length > 0) {
        // Persist to database - milestones become the high-level todos
        try {
          const planService = getPlanService();
          await planService.initialize();

          const todos = strategicPlan.milestones.map((m, idx) => ({
            title: m.title,
            description: `${m.description}\n\nSuccess Criteria: ${m.successCriteria}`,
            orderIndex: idx,
            categoryHints: [], // Strategic milestones don't have tool hints
          }));

          const planData = {
            type: 'strategic',
            goal: strategicPlan.goal,
            goalDescription: strategicPlan.goalDescription,
            estimatedComplexity: strategicPlan.estimatedComplexity,
            responseGuidance: strategicPlan.responseGuidance,
          };

          if (priorPlanId && revisionContext) {
            // Revise existing plan
            console.log(`[Agent:StrategicPlanner] Revising plan ${priorPlanId}`);
            const revised = await planService.revisePlan({
              planId: priorPlanId,
              data: planData,
              todos,
              eventData: { revision_reason: (revisionContext as any).reason },
            });

            if (revised) {
              console.log(`[Agent:StrategicPlanner] Plan revised: planId=${revised.planId} revision=${revised.revision}`);
              state.metadata.activePlanId = revised.planId;

              emit?.({
                type: 'progress',
                threadId: state.threadId,
                data: {
                  phase: 'plan_revised',
                  planId: revised.planId,
                  revision: revised.revision,
                  goal: strategicPlan.goal,
                },
              });

              for (const t of revised.todosCreated) {
                emit?.({
                  type: 'progress',
                  threadId: state.threadId,
                  data: {
                    phase: 'todo_created',
                    planId: revised.planId,
                    todoId: t.todoId,
                    title: t.title,
                    orderIndex: t.orderIndex,
                    status: t.status,
                  },
                });
              }

              for (const t of revised.todosUpdated) {
                emit?.({
                  type: 'progress',
                  threadId: state.threadId,
                  data: {
                    phase: 'todo_updated',
                    planId: revised.planId,
                    todoId: t.todoId,
                    title: t.title,
                    orderIndex: t.orderIndex,
                    status: t.status,
                  },
                });
              }

              for (const todoId of revised.todosDeleted) {
                emit?.({
                  type: 'progress',
                  threadId: state.threadId,
                  data: {
                    phase: 'todo_deleted',
                    planId: revised.planId,
                    todoId,
                  },
                });
              }
            }
          } else {
            // Create new plan
            console.log(`[Agent:StrategicPlanner] Creating new strategic plan`);
            const created = await planService.createPlan({
              threadId: state.threadId,
              data: planData,
              todos,
              eventData: { goal: strategicPlan.goal },
            });

            if (created) {
              console.log(`[Agent:StrategicPlanner] Plan created: planId=${created.planId}`);
              state.metadata.activePlanId = created.planId;

              // Store created todos for milestone mapping
              (state.metadata as any)._createdTodos = created.todos;

              emit?.({
                type: 'progress',
                threadId: state.threadId,
                data: {
                  phase: 'plan_created',
                  planId: created.planId,
                  goal: strategicPlan.goal,
                },
              });

              for (const t of created.todos) {
                emit?.({
                  type: 'progress',
                  threadId: state.threadId,
                  data: {
                    phase: 'todo_created',
                    planId: created.planId,
                    todoId: t.todoId,
                    title: t.title,
                    orderIndex: t.orderIndex,
                    status: 'pending',
                  },
                });
              }

              // Update awareness
              const awareness = getAwarenessService();
              await awareness.initialize();
              await awareness.update({ active_plan_ids: [String(created.planId)] });
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
        const createdTodos = ((state.metadata as any)._createdTodos as Array<{ todoId: number; title: string; orderIndex: number }>) || [];
        state.metadata.strategicPlan = {
          goal: strategicPlan.goal,
          goalDescription: strategicPlan.goalDescription,
          milestones: strategicPlan.milestones.map((m, idx) => {
            const dbTodo = createdTodos.find(t => t.orderIndex === idx);
            return {
              ...m,
              status: 'pending' as const,
              todoId: dbTodo?.todoId, // DB todoId for UI events
            };
          }),
          requiresTools: strategicPlan.requiresTools,
          estimatedComplexity: strategicPlan.estimatedComplexity,
        };

        // Set first milestone as active
        if (strategicPlan.milestones.length > 0) {
          const first = strategicPlan.milestones[0];
          state.metadata.activeMilestone = {
            id: first.id,
            title: first.title,
            description: first.description,
            successCriteria: first.successCriteria,
          };
        }

        state.metadata.planHasRemainingTodos = true;

        emit?.({
          type: 'progress',
          threadId: state.threadId,
          data: {
            phase: 'strategic_plan_created',
            goal: strategicPlan.goal,
            milestones: strategicPlan.milestones.map(m => m.title),
          },
        });

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

    // LLM planning failed
    console.log(`[Agent:StrategicPlanner] LLM planning failed, using fallback`);
    state.metadata.llmFailureCount = llmFailureCount + 1;

    if (llmFailureCount + 1 >= 3) {
      console.error(`[Agent:StrategicPlanner] LLM failed ${llmFailureCount + 1} times, ending`);
      state.metadata.error = 'Strategic planning failed after multiple attempts';
      return { state, next: 'end' };
    }

    // Fallback: create a simple single-milestone plan
    state.metadata.strategicPlan = {
      goal: 'Respond to user request',
      goalDescription: lastUserMessage.content,
      milestones: [{
        id: 'milestone_1',
        title: 'Process and respond',
        description: 'Analyze the request and provide a helpful response',
        successCriteria: 'User receives a relevant response',
        dependsOn: [],
        status: 'pending' as const,
      }],
      requiresTools: false,
      estimatedComplexity: 'simple',
    };

    state.metadata.planHasRemainingTodos = true;

    return { state, next: 'continue' };
  }

  private async generateStrategicPlan(
    state: ThreadState,
    revisionReason?: string,
  ): Promise<StrategicPlan | null> {
    const basePrompt = `You must create a strategic plan for the user's request.

You are an expert strategic planner with 20+ years across industries—tech (e.g., Amazon's predictive scaling for 40% efficiency gains), retail (Zappos' personalization driving 30% repeats), nonprofits (SWOT-led 25% donation boosts). Avoid novice pitfalls like generic steps; craft high-leverage, low-risk plans from battle-tested tactics that deliver 2-5x results. Expose blind spots, rethink assumptions, use foresight for lifelike overdelivery.

## Your Approach
1. **Identify Primary Goal**: Uncover the true win-condition, beyond surface ask—e.g., not just "book flight," but seamless travel with upgrades and backups.
2. **Anticipate Beyond**: Predict 1-2 unstated delights (e.g., cost savings, risk hedges, scalability) to exceed expectations, like Southwest's hedging for fuel stability.
3. **Expert Lens**: Discard obvious routes (e.g., basic search); prioritize proven plays from 1000+ cases—what crushes benchmarks, like Shopify's API ecosystems for 4x growth.
4. **Scenario Planning**: Outline 2-3 paths (optimal, fallback, stretch) with risks/metrics, drawing analogies from real wins (e.g., Netflix's pivot to streaming).
5. **Work Backwards**: From enhanced goal, map milestones with efficiencies.
6. **First Principles**: Deconstruct to core checkpoints, embedding shortcuts.
7. **Success Criteria**: Use the SMARTER goals framework for Specific Measurable Achievable Relevant Time-bound Emotionally compelling and Rewarding.

${revisionReason ? `## Revision Required\nThe previous plan needs revision because: ${revisionReason}` : ''}

## Guidelines
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
  }
}
`;

    const prompt = await this.enrichPrompt(basePrompt, state, {
      includeSoul: true,
      includeAwareness: true,
      includeMemory: true,
      includeTools: true,
      toolDetail: 'names',
      includeSkills: true,
      includeStrategicPlan: false,
    });

    console.log(`[Agent:StrategicPlanner] Prompt (plain text):\n${prompt}`);

    // Log the messages that will be sent to the LLM
    const messagesForLLM = state.messages
      .filter(m => m.role === 'user' || m.role === 'assistant' || m.role === 'system')
      .map(m => ({ role: m.role, content: m.content }));
    console.log(`[Agent:StrategicPlanner] Messages to LLM:\n${JSON.stringify(messagesForLLM, null, 2)}`);

    try {
      const response = await this.prompt(prompt, state, false);

      if (!response?.content) {
        console.warn('[Agent:StrategicPlanner] No response from LLM');
        return null;
      }

      console.log(`[Agent:StrategicPlanner] LLM response:\n${response.content.substring(0, 1000)}`);
      
      const plan = this.parseFirstJSONObject<any>(response.content);
      if (!plan) {
        console.warn('[Agent:StrategicPlanner] Failed to parse plan JSON from response:', response.content);
        return null;
      }

      // Validate required fields
      if (!plan.goal || typeof plan.planNeeded !== 'boolean') {
        console.warn('[Agent:StrategicPlanner] Invalid plan structure');
        return null;
      }

      // Ensure milestones array exists
      if (!Array.isArray(plan.milestones)) {
        plan.milestones = [];
      }

      // Ensure each milestone has required fields
      plan.milestones = plan.milestones.map((m: any, idx: number) => ({
        id: m.id || `milestone_${idx + 1}`,
        title: m.title || `Milestone ${idx + 1}`,
        description: m.description || '',
        successCriteria: m.successCriteria || 'Milestone completed',
        dependsOn: Array.isArray(m.dependsOn) ? m.dependsOn : [],
      }));

      return plan as StrategicPlan;

    } catch (err) {
      console.error('[Agent:StrategicPlanner] Plan generation failed:', err);
      return null;
    }
  }

}
