// StrategicPlannerNode.ts
// High-level goal decomposition into milestones
// Persists to AgentPlan / AgentPlanTodo models
// Returns neutral decision — graph edges route next

import type { HierarchicalThreadState, NodeResult } from './Graph';
import { BaseNode, JSON_ONLY_RESPONSE_INSTRUCTIONS } from './BaseNode';
import { AgentPlan, AgentPlanInterface } from '../database/models/AgentPlan';
import { AgentPlanTodo, AgentPlanTodoInterface } from '../database/models/AgentPlanTodo';

const STRATEGIC_PLAN_PROMPT = `

type InquiryIntent = 
  | "direct_answer"          // pure info question, no action needed
  | "task_or_action"         // user wants something done (search, create, execute...)
  | "planning_required"      // explicitly needs structure, steps, milestones
  | "follow_up_or_remember"  // references past, needs memory/context
  | "clarification_needed";  // ambiguous or incomplete

function classifyIntent(userMsg: string, recentContext: string): InquiryIntent {
  // Think step-by-step internally

  // 1. Check for direct questions (what/how/why/who)
  if (/^(what|how|why|who|when|where)/i.test(userMsg) && userMsg.length < 150) {
    return "direct_answer";
  }

  // 2. Check for action verbs or file/system interaction
  if (/(find|search|get|show|display|open|locate|access|look for|image|file|path|jpg|png)/i.test(userMsg)) {
    return "task_or_action";
  }

  // 3. Explicit planning words
  if (/(plan|create|build|make|implement|strategy|milestone|todo|step|break down|organize)/i.test(userMsg)) {
    return "planning_required";
  }

  // 4. Memory/reference words
  if (/(remember|recall|earlier|before|last time|previous|again)/i.test(userMsg)) {
    return "follow_up_or_remember";
  }

  // Default to action if uncertain — better safe than "okay"
  return "task_or_action";
}

// Then decide:
const intent = classifyIntent("{{userMessage}}", "{{recentContext}}");

if (intent === "direct_answer") {
  planneeded = false;
  emit_chat_message = "Direct, concise answer.";
} else {
  planneeded = true;
  // ... rest of complex planning output
}
  
// Final output rules — MUST follow exactly, no extra text
// - If direct_answer: only emit_chat_message + planneeded: false
// - If anything else: full plan structure
// - Return ONLY valid JSON. Nothing before or after.

const finalOutput: FinalOutput = {
  emit_chat_message: intent === "direct_answer" 
    ? "Direct, concise answer." 
    : \`Acknowledging request. Planning structured response.\`,
  planneeded: intent !== "direct_answer",
};

if (finalOutput.planneeded) {
  finalOutput.goal = "Short goal title";
  finalOutput.goaldescription = "Clear restated outcome + 1-sentence plan overview";
  finalOutput.requirestools = true; // usually true for real work
  finalOutput.estimatedcomplexity = "moderate"; // adjust as needed
  finalOutput.milestones = [
    { id: "m1", title: "First milestone", description: "...", successcriteria: "...", dependson: [] }
    // ... add more
  ];
  finalOutput.responseguidance = { tone: "technical", format: "markdown" };
}

// Output ONLY this JSON — no markdown, no explanation, no trailing text
return finalOutput;`;

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
    
    if (plan.emit_chat_message?.trim()) {
      this.wsChatMessage(state, plan.emit_chat_message, 'assistant', 'response');
    }

    if (plan.planneeded) {
      await this.updatePlan(state, plan);
    }

    return { state, decision: { type: 'next' } };
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