// StrategicPlannerNode.ts
// High-level goal decomposition into milestones
// Persists to AgentPlan / AgentPlanTodo models
// Returns neutral decision — graph edges route next

import type { HierarchicalThreadState, NodeResult } from './Graph';
import { BaseNode, JSON_ONLY_RESPONSE_INSTRUCTIONS } from './BaseNode';
import { AgentPlan, AgentPlanInterface } from '../database/models/AgentPlan';
import { AgentPlanTodo, AgentPlanTodoInterface } from '../database/models/AgentPlanTodo';

const STRATEGIC_PLAN_PROMPT = `

type InquiryComplexity = 'simple' | 'complex';

function classifyInquiry(inquiry: string): InquiryComplexity {
  // LLM internal heuristic (not real code)
  if (
    inquiry.length < 100 &&
    !inquiry.includes("plan") &&
    !inquiry.includes("create") &&
    !inquiry.includes("build") &&
    !inquiry.includes("implement") &&
    !inquiry.includes("strategy") &&
    !inquiry.includes("milestone") &&
    !inquiry.includes("todo") &&
    !inquiry.includes("step") &&
    !inquiry.match(/\d+/) // no numbered steps/tasks
  ) {
    return 'simple';
  }
  return 'complex';
}

function decideResponseStrategy(inquiry: string) {
  const complexity = classifyInquiry(inquiry);

  if (complexity === 'simple') {
    return {
      planneeded: false,
      emit_chat_message: "Direct, complete answer to the user's question.",
      // All plan fields omitted / null / false / empty
      responseguidance: {
        tone: "casual" | "technical" | "friendly" /* choose based on context */,
        format: "conversational" | "brief"
      }
    };
  }

  // Complex case — must plan
  return {
    planneeded: true,

    emit_chat_message: \`
      Show strong listening: 
      1. Acknowledge the request.
      2. Restate the desired outcome in your own words (1–2 sentences).
      3. Do NOT reveal plan details yet.
    \`,

    goal: "Short title (5–10 words max)",

    goaldescription: \`
      [Restated user outcome in clear language] + 
      [One-sentence high-level plan overview]
    \`,

    requirestools: true | false /* usually true for real work */,

    estimatedcomplexity: "simple" | "moderate" | "complex",

    milestones: [
      {
        id: "m1",
        title: "Clear, verb-first title",
        description: "Single sentence — what this milestone achieves",
        successcriteria: "Specific, measurable, time-bound condition (SMARTER)",
        dependson: [] // or ["m0", "m-1"] etc.
      },
      // 3–6 total, never more
      // Last milestone usually "validate", "deliver", "review", or "finalize"
    ],

    responseguidance: {
      tone: "technical" | "casual" | "formal" | "friendly",
      format: "brief" | "detailed" | "markdown" | "conversational"
    }
  };
}

// Enforced output contract — LLM MUST produce ONLY this JSON output shape
type FinalOutput = {
  emit_chat_message: string;          // always present

  // only when planneeded === true
  planneeded: boolean;
  goal?: string;
  goaldescription?: string;
  requirestools?: boolean;
  estimatedcomplexity?: "simple" | "moderate" | "complex";
  milestones?: Array<{
    id: string;
    title: string;
    description: string;
    successcriteria: string;
    dependson: string[];
  }>;
  responseguidance?: {
    tone: "technical" | "casual" | "formal" | "friendly";
    format: "brief" | "detailed" | "markdown" | "conversational";
  };
}`;

/**
 * Strategic Planner Node
 *
 * Purpose:
 *   - Decomposes user intent into high-level goal + milestones
 *   - Persists plan to DB (AgentPlan + AgentPlanTodo)
 *   - Activates first milestone if plan created
 *   - Handles simple vs multi-step paths
 *
 * Key Design Decisions (2025 refactor):
 *   - Removed AgentLog / console.log / agentWarn
 *   - Unified BaseNode.chat() + direct parsed .content access
 *   - Enrichment: soul + awareness + memory + tools (names only)
 *   - Persists via AgentPlan / AgentPlanTodo models directly
 *   - Neutral decision only — graph edges decide next
 *   - WS feedback only on plan creation / simple response
 *   - No retry counter bloat — graph-level protection
 *
 * Input expectations:
 *   - Recent user message in state.messages
 *   - HierarchicalThreadState shape
 *
 * Output mutations:
 *   - state.metadata.plan ← { model, milestones[], activeMilestoneIndex, allMilestonesComplete }
 *   - DB: new/existing AgentPlan + AgentPlanTodo records
 *   - state.metadata.activeMilestoneIndex = 0 on new plan
 *
 * @extends BaseNode
 */
export class StrategicPlannerNode extends BaseNode {
  constructor() {
    super('strategic_planner', 'Strategic Planner');
  }

  async execute(state: HierarchicalThreadState): Promise<NodeResult<HierarchicalThreadState>> {

    const enriched = await this.enrichPrompt(STRATEGIC_PLAN_PROMPT, state, {
      includeSoul: true,
      includeAwareness: true,
      includeMemory: true,
      includeTools: true,
      includeStrategicPlan: false,
      includeTacticalPlan: false,
      includeKnowledgebasePlan: false,
    });

    const llmResponse = await this.chat(
      state,
      enriched,
      { format: 'json' }
    );

    if (!llmResponse) {
      return { state, decision: { type: 'continue' } }; // continue
    }

    const plan = llmResponse as StrategicPlan;
    const currentPlan = state.metadata.plan?.model;
    
    // Check if this is a simple response (no plan needed)
    if (plan && plan.planneeded === false) {
      console.log('[StrategicPlanner] Simple response detected, no plan needed');
      if (plan.emit_chat_message?.trim()) {
        this.wsChatMessage(state, plan.emit_chat_message, 'assistant', 'response');
      }
      return { state, decision: { type: 'end' } };
    }
    
    // For complex responses, validate plan structure
    if (!plan || !plan.goal?.trim()) {
      console.log('[StrategicPlanner] Invalid or empty plan received from LLM', {
        hasActivePlan: !!currentPlan,
        llmResponse,
        currentPlanId: currentPlan?.attributes?.id
      });
      if (plan.emit_chat_message?.trim()) {
        this.wsChatMessage(state, plan.emit_chat_message, 'assistant', 'response');
      }
      return { state, decision: { type: 'next' } }; // continue
    }

    if (plan.emit_chat_message?.trim()) {
      this.wsChatMessage(state, plan.emit_chat_message, 'assistant', 'response');
    }

    // ============================================================================
    // No complete plan needed
    // ============================================================================

    if (!plan.planneeded) {
      return { state, decision: { type: 'end' } }; // end
    }

    // ============================================================================
    // Thorough thought processes need to carry out this task
    // First task is to get or update the plan
    // ============================================================================

    try {
      await this.updatePlan(state, plan);
      return { state, decision: { type: 'next' } };
    } catch(err) {
      console.error('[StrategicPlanner] Plan persistence failed:', err);
      return { state, decision: { type: 'continue' } }; // continue
    }
  }

  /**
   * Update or create a plan in the database and state
   */
  private async updatePlan(state: HierarchicalThreadState, plan: StrategicPlan): Promise<void> {
    // check if the plan is already in the state object
    let planModel = state.metadata.plan?.model;
    if (planModel) {
      console.log('[StrategicPlanner] Plan already exists:', planModel.attributes);

      planModel.fill({
        thread_id: state.metadata.threadId,
        status: 'active',
        goal: plan.goal,
        goaldescription: plan.goaldescription,
        complexity: plan.estimatedcomplexity,
        requirestools: plan.requirestools,
        wschannel: state.metadata.wsChannel,
      });
      await planModel.incrementRevision();
      await planModel.deleteAllTodos();

    // Create a new plan
    } else {
      console.log('[StrategicPlanner] Creating new plan:', plan);
      
      planModel = new AgentPlan();
      planModel.fill({
        thread_id: state.metadata.threadId,
        status: 'active',
        goal: plan.goal,
        goaldescription: plan.goaldescription,
        complexity: plan.estimatedcomplexity,
        requirestools: plan.requirestools,
        wschannel: state.metadata.wsChannel,
      })

      await planModel.save();
      state.metadata.plan.model = planModel;

    }

    console.log('[StrategicPlanner] Plan created:', plan.milestones);

    // Create new todos
    const todos: AgentPlanTodo[] = [];
    for (const [idx, m] of plan.milestones.entries()) {
      console.log('[StrategicPlanner] Milestone:', m);
      const todo = new AgentPlanTodo();
      todo.fill({
        plan_id: planModel.attributes.id!,
        title: m.title,
        description: `${m.description}\n\nSuccess: ${m.successcriteria}`,
        order_index: idx,
        status: idx === 0 ? 'in_progress' : 'pending',
        wschannel: state.metadata.wsChannel,
      });
      await todo.save();
      todos.push(todo);
    }

    // Update state shape
    state.metadata.plan = {
      model: planModel,
      milestones: todos.map(todo => ({ model: todo })),
      activeMilestoneIndex: 0,
      allMilestonesComplete: false,
    };
  }
}

interface StrategicPlan {
  goal: string;
  goaldescription: string;
  requirestools: boolean;
  estimatedcomplexity: 'simple' | 'moderate' | 'complex';
  planneeded: boolean;
  milestones: Array<{
    id: string;
    title: string;
    description: string;
    successcriteria: string;
    dependson: string[];
  }>;
  responseguidance: {
    tone: string;
    format: string;
  };
  emit_chat_message?: string;
}