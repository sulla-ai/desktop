// TacticalExecutorNode - Executes the plan (LLM calls, tool execution)

import type { ThreadState, NodeResult } from '../types';
import { BaseNode, JSON_ONLY_RESPONSE_INSTRUCTIONS } from './BaseNode';
import { parseJson } from '../services/JsonParseService';
import { agentError, agentLog, agentWarn } from '../services/AgentLogService';
import { getKnowledgeGraph } from '../services/KnowledgeGraph';

export class TacticalExecutorNode extends BaseNode {
  constructor() {
    super('tactical_executor', 'Tactical Executor');
  }

  private async handleNoPlanResponse(state: ThreadState): Promise<void> {
    const lastUser = [...state.messages].reverse().find(m => m.role === 'user');
    const userText = lastUser?.content ? String(lastUser.content) : '';

    const basePrompt = `You are the Tactical Executor: a 25-year senior DevOps & security engineer running on the Primary User's primary machine.

You are responding directly to the user. Think through the problem before answering — you are handling this request ad-hoc.

Your job:
1. Think through the user's request carefully before responding.
2. Consider what information you have, what you might need, and the best way to help.
3. If the request requires running tools (shell commands, file operations, etc.), call them.
4. If the request is ambiguous, ask 1-3 crisp clarifying questions via emit_chat_message.
5. If the request implies multi-step work, recommend creating a plan to tackle it systematically.

Process:
1. Analyze step + recent results
2. Decide exact tool calls needed next (or none if done)
3. If done: set markDone=true + short summary
4. NEVER output tool results — they are already in context

Core Directives (non-negotiable):
- PROTECT THE PRIMARY MACHINE AT ALL COSTS
- NO PII ever leaves this system
- Use only ephemeral /tmp dirs — wipe immediately after use
- Dry-run / --dry-run / echo every dangerous command first
- Risk > low → abort immediately and explain exact reason
- If unsure → stop and return error instead of guessing

Mandatory visibility:
- Use emit_chat_message: "Talk the the user, tell them what's going on and what you're doing"
- Before each tool call: 1-line preview of what command/tool + why.
- On completion: confirm what was done with evidence.

${JSON_ONLY_RESPONSE_INSTRUCTIONS}
{
  "tools": [
    ["tool_name", "arg1", "arg2"]
    ["emit_chat_message", "Respond to the users inquiry"]
  ],
  "markDone": true | false, // true if the task is complete, false if more steps are needed
}`;

    const prompt = await this.enrichPrompt(basePrompt, state, {
      includeSoul: true,
      includeAwareness: true,
      includeMemory: true,
      includeTools: true,
      toolDetail: 'tactical',
      includeSkills: false,
      includeStrategicPlan: false,
      includeTacticalPlan: false,
      includeKnowledgeGraphInstructions: undefined,
    });

    console.log(['TacticalExecutorNode handleNoPlanResponse prompt', prompt]);

    try {
      const response = await this.prompt(prompt, state);
      const content = response?.content ? String(response.content) : '';
      const parsed = parseJson<any>(content);

      if (!parsed) {
        agentWarn(this.name, 'handleNoPlanResponse: Could not parse JSON from LLM response');
        return;
      }

      // Execute tool calls using BaseNode's executeToolCalls
      const tools = Array.isArray(parsed.tools) ? parsed.tools : [];
      const results = await this.executeToolCalls(state, tools);

      // Log any failures
      for (const result of results) {
        if (!result.success) {
          agentWarn(this.name, `[NoPlan] Tool ${result.toolName} failed: ${result.error || 'Unknown error'}`);
        }
      }

      // If no actions were taken and there's a summary, emit it as a chat message
      if (parsed.summary) {
        await this.emitChatMessage(state, parsed.summary);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err ?? 'unknown error');
      const errorStack = err instanceof Error ? err.stack : undefined;
      agentError(this.name, `handleNoPlanResponse failed: ${errorMsg}`, errorStack);
      console.error('[Agent:TacticalExecutor] handleNoPlanResponse error:', err);
    }
  }

  async execute(state: ThreadState): Promise<{ state: ThreadState; next: NodeResult }> {
    agentLog(this.name, 'Executing...');
    
    // Clear previous iteration's revision request - each execution starts fresh
    delete state.metadata.requestPlanRevision;
    
    // Only execute hierarchical tactical steps.
    let executed = false;
    if (state.metadata.activeTacticalStep) {
      executed = await this.executeTacticalStep(state);
    }
    
    if (!executed) {
      console.log('[Agent:Executor] No active task to execute, generating response...');
      await this.handleNoPlanResponse(state);
    }

    // TacticalExecutor controls its own flow - decide whether to continue or go to critic
    const shouldContinue = this.shouldContinueExecution(state);
    state.metadata.executorContinue = shouldContinue;
    
    return { state, next: shouldContinue ? 'continue' : 'end' };
  }

  /**
   * Determine if executor should continue with more work or go to critic
   */
  private shouldContinueExecution(state: ThreadState): boolean {

    // Track consecutive LLM failures to prevent infinite loops
    const llmFailureCount = ((state.metadata.llmFailureCount as number) || 0);
    if (llmFailureCount >= 3) {
      return false;
    }

    // Check if the current step explicitly requested to continue (markDone: false)
    const todoExecution = state.metadata.todoExecution as any;
    if (todoExecution && todoExecution.markDone === false) {
      return true; // LLM said more work needed, continue looping
    }

    // If there are remaining tactical steps or milestones, continue execution
    if (this.hasRemainingTacticalWork(state)) {
      return true;
    }

    return false;
  }

  /**
   * Execute a tactical step from hierarchical planning (state-only, not DB)
   */
  private async executeTacticalStep(state: ThreadState): Promise<boolean> {
    const tacticalStep = state.metadata.activeTacticalStep;
    if (!tacticalStep) {
      return false;
    }

    const milestone = state.metadata.activeMilestone as { title?: string; generateKnowledgeBase?: boolean; kbSuggestedSlug?: string; kbSuggestedTags?: string[] } | undefined;

    agentLog(this.name, `Executing tactical step: ${tacticalStep.action}`);
    if (milestone) {
      agentLog(this.name, `For milestone: ${milestone.title}`);
    }

    this.emitProgress(state, 'tactical_step_start', { step: tacticalStep.action, milestone: milestone?.title });

    // Canonical trigger: allow tactical plans to explicitly request KB generation.
    if (String(tacticalStep.action).toLowerCase() === 'knowledge_base_generate') {
      return this.executeKnowledgeBaseGeneration(state, milestone || {});
    }

    // Check if this milestone is a KnowledgeBase generation milestone
    if (milestone?.generateKnowledgeBase === true) {
      return this.executeKnowledgeBaseGeneration(state, milestone);
    }

    // Use LLM to decide what tools to call for this step
    const decision = await this.planTacticalStepExecution(state, tacticalStep);

    if (!decision) {
      state.metadata.todoExecution = { 
        todoId: 0, 
        status: 'failed', 
        summary: 'No execution decision produced' 
      };
      state.metadata.requestPlanRevision = { reason: 'Tactical step failed: no execution decision' };
      
      // Mark step as failed in tactical plan
      if (state.metadata.tacticalPlan) {
        const step = state.metadata.tacticalPlan.steps.find(s => s.id === tacticalStep.id);
        if (step) {
          step.status = 'failed';
        }
      }
      
      return true;
    }

    if (decision.tools.length === 0) {
      await this.emitChatMessage(state, decision.summary || '');
      
      // Mark step as done even without tool calls
      state.metadata.todoExecution = {
        todoId: 0,
        status: 'done',
        summary: decision.summary || 'Step completed without tool actions',
        actions: [],
        actionsCount: 0,
        markDone: true,
      };
      
      // Mark step as done in tactical plan
      if (state.metadata.tacticalPlan) {
        const step = state.metadata.tacticalPlan.steps.find(s => s.id === tacticalStep.id);
        if (step) {
          step.status = 'done';
          this.emitProgress(state, 'tactical_step_status', { stepId: step.id, action: step.action, status: 'done' });
        }
      }

      state.metadata.planHasRemainingTodos = this.hasRemainingTacticalWork(state);
      return true;
    }

    // Execute tools
    let anyToolFailed = false;
    let lastFailedTool = '';
    let lastFailedError = '';

    for (const toolItem of decision.tools) {
      const toolName = toolItem.tool;
      const toolArgs = toolItem.args || {};

      agentLog(this.name, `Executing tool: ${toolName}`);
      const result = await this.executeSingleToolAction(state, toolName, toolArgs);

      if (result && result.success === false) {
        anyToolFailed = true;
        lastFailedTool = toolName;
        lastFailedError = result.error || 'Unknown error';
        agentWarn(this.name, `Tool ${toolName} failed: ${lastFailedError}`, {
          tool: toolName,
          error: lastFailedError,
          args: toolArgs,
        });
      }
    }

    const allToolsSucceeded = decision.tools.length > 0 && !anyToolFailed;
    const markDone = decision.markDone || allToolsSucceeded;

    state.metadata.todoExecution = {
      todoId: 0,
      actions: decision.tools.map(t => t.tool),
      actionsCount: decision.tools.length,
      markDone,
      status: markDone ? 'done' : (anyToolFailed ? 'failed' : 'in_progress'),
      summary: decision.summary || '',
    };

    // Update step status in tactical plan
    if (state.metadata.tacticalPlan) {
      const step = state.metadata.tacticalPlan.steps.find(s => s.id === tacticalStep.id);
      if (step) {
        const newStatus = markDone ? 'done' : (anyToolFailed ? 'failed' : 'in_progress');
        step.status = newStatus;
        this.emitProgress(state, 'tactical_step_status', { stepId: step.id, action: step.action, status: newStatus });
      }
    }

    if (anyToolFailed) {
      await this.emitChatMessage(state, `Tool failed (${lastFailedTool}): ${lastFailedError}`);
      state.metadata.requestPlanRevision = { reason: `Tool failed: ${lastFailedTool} - ${lastFailedError}` };
    } else if (markDone) {
    }

    state.metadata.planHasRemainingTodos = this.hasRemainingTacticalWork(state);

    return true;
  }

  /**
   * Execute KnowledgeBase generation milestone synchronously
   */
  private async executeKnowledgeBaseGeneration(
    state: ThreadState,
    milestone: { title?: string; kbSuggestedSlug?: string; kbSuggestedTags?: string[] },
  ): Promise<boolean> {
    console.log(`[Agent:Executor] Executing KnowledgeBase generation milestone: ${milestone.title}`);

    this.emitProgress(state, 'knowledgebase_generation_start', { milestone: milestone.title });

    await this.emitChatMessage(state, `Generating KnowledgeBase article: ${milestone.title || 'Documentation'}...`);

    try {
      const result = await getKnowledgeGraph().runSync({
        threadId: state.threadId,
        mode: 'sync',
        messages: state.messages.map(m => ({ role: m.role, content: m.content })),
      });

      if (result.success) {
        console.log(`[Agent:Executor] KnowledgeBase article created: ${result.slug}`);
        await this.emitChatMessage(state, `KnowledgeBase article created: **${result.title}** (${result.slug})`);

        state.metadata.todoExecution = {
          todoId: 0,
          status: 'done',
          summary: `KnowledgeBase article created: ${result.title}`,
          actions: [],
          actionsCount: 0,
          markDone: true,
        };

        (state.metadata as any).knowledgeBaseGenerated = { slug: result.slug, title: result.title };
      } else {
        console.error(`[Agent:Executor] KnowledgeBase generation failed: ${result.error}`);
        await this.emitChatMessage(state, `KnowledgeBase generation failed: ${result.error}`);

        state.metadata.todoExecution = {
          todoId: 0,
          status: 'failed',
          summary: `KnowledgeBase generation failed: ${result.error}`,
        };

        // Force a retry path: do not consider the milestone complete.
        state.metadata.requestPlanRevision = { reason: `KnowledgeBase article not created: ${result.error || 'unknown error'}` };
      }

      this.emitProgress(state, 'knowledgebase_generation_end', { success: result.success, slug: result.slug });

      // Mark tactical step as done
      if (state.metadata.tacticalPlan) {
        const tacticalStep = state.metadata.activeTacticalStep as { id: string } | undefined;
        if (tacticalStep) {
          const step = state.metadata.tacticalPlan.steps.find(s => s.id === tacticalStep.id);
          if (step) {
            step.status = result.success ? 'done' : 'failed';
          }
        }
      }

      // Mark the KB milestone as complete ONLY on success. On failure keep it in_progress so we can retry.
      const activeMilestone = state.metadata.activeMilestone as { id: string } | undefined;
      if (activeMilestone && state.metadata.strategicPlan?.milestones) {
        const m = state.metadata.strategicPlan.milestones.find(m => m.id === activeMilestone.id);
        if (m) {
          if (result.success) {
            m.status = 'completed';
          } else {
            m.status = 'in_progress';
          }
        }
      }

      // Clear tactical plan and active milestone only on success so we don't prematurely exit.
      if (result.success) {
        delete state.metadata.tacticalPlan;
        delete state.metadata.activeMilestone;
        delete state.metadata.activeTacticalStep;
      }

      state.metadata.planHasRemainingTodos = this.hasRemainingTacticalWork(state);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Agent:Executor] KnowledgeBase generation error:`, err);
      await this.emitChatMessage(state, `KnowledgeBase generation error: ${msg}`);

      state.metadata.todoExecution = {
        todoId: 0,
        status: 'failed',
        summary: `KnowledgeBase generation error: ${msg}`,
      };

      state.metadata.requestPlanRevision = { reason: `KnowledgeBase article not created: ${msg}` };

      return true;
    }
  }

  /**
   * Check if there's remaining tactical work (steps or milestones)
   */
  private hasRemainingTacticalWork(state: ThreadState): boolean {
    // Check tactical plan for remaining steps
    const tacticalPlan = state.metadata.tacticalPlan;
    if (tacticalPlan) {
      const pendingSteps = tacticalPlan.steps.filter(s => s.status === 'pending' || s.status === 'in_progress');
      if (pendingSteps.length > 0) {
        return true;
      }
    }

    // Check strategic plan for remaining milestones
    const strategicPlan = state.metadata.strategicPlan;
    if (strategicPlan?.milestones) {
      const pendingMilestones = strategicPlan.milestones.filter(m => m.status === 'pending' || m.status === 'in_progress');
      if (pendingMilestones.length > 0) {
        return true;
      }
    }

    return false;
  }

  /**
   * Plan execution for a tactical step using LLM
   */
  private async planTacticalStepExecution(
    state: ThreadState,
    step: { id: string; action: string; description: string; toolHints?: string[] },
  ): Promise<{ tools: Array<{ tool: string; args?: Record<string, unknown> }>; markDone: boolean; summary: string } | null> {
    const todoExecution = state.metadata.todoExecution as any;
    const activeMilestone = (state.metadata.activeMilestone && typeof state.metadata.activeMilestone === 'object')
      ? (state.metadata.activeMilestone as any)
      : null;
    const activeTacticalStep = (state.metadata.activeTacticalStep && typeof state.metadata.activeTacticalStep === 'object')
      ? (state.metadata.activeTacticalStep as any)
      : step;
    const strategicPlan = (state.metadata.strategicPlan && typeof state.metadata.strategicPlan === 'object')
      ? (state.metadata.strategicPlan as any)
      : null;
    const goal = strategicPlan?.goal ? String(strategicPlan.goal) : '';
    const goalDescription = strategicPlan?.goalDescription ? String(strategicPlan.goalDescription) : '';

    const basePrompt = `You are the Tactical Executor: 25-year senior DevOps & security engineer running on the Primary User's primary machine.

${activeTacticalStep ? `Current tactical step to complete: ${activeTacticalStep.action} — ${activeTacticalStep.description}` : ''}

${goal ? `Overall goal: ${goal}${goalDescription ? ` — ${goalDescription}` : ''}
` : ''}${activeMilestone ? `Active milestone: ${activeMilestone.title || 'none'} — ${activeMilestone.description || ''}
` : ''}

Most recent execution result: ${todoExecution ? JSON.stringify(todoExecution) : 'none'}

Core Directives (non-negotiable):
- PROTECT THE PRIMARY MACHINE AT ALL COSTS
- NO PII ever leaves this system
- Use only ephemeral /tmp dirs — wipe immediately after use
- Dry-run / --dry-run / echo every dangerous command first
- Risk > low → abort immediately and explain exact reason
- If unsure → stop and return error instead of guessing

Execution personality:
- Hyper-creative, relentlessly persistent, borderline obsessive about success.
- Pivot inventively around obstacles. Leverage ANY resource or trick you can discover.
- Brainstorm 3–5 unconventional paths when blocked — pick the smartest/safest.
- Chain tools aggressively. Write tiny helpers in /tmp if no native tool fits.
- Retry failed actions up to 3× with variation/exponential backoff.
- Never give up until the step is verifiably done or provably impossible.

Process (think step-by-step internally):
1. Analyze: current step, recent result, milestone, goal.
2. Plan: What is the minimal, safest, most creative path to completion?
3. If stuck: generate & evaluate wild alternatives.
4. Act: Call tools in sequence. Comment via emit_chat_message before each meaningful action.
5. Validate: Confirm progress against step success criteria.
6. Finish: When done → emit final confirmation + evidence.

Mandatory visibility:
- Use emit_chat_message tool before EVERY non-trivial action.
- You should respond to the user and inform them what tools you just ran and the results you received using emit_chat_message tool.
- Before each tool call: 1-line preview of what command/tool + why.
- On blocker/retry/failure: explain exactly what’s wrong + next attempt.
- On completion: "Step complete. Evidence: [short proof]"

${JSON_ONLY_RESPONSE_INSTRUCTIONS}
{
  "tools": [
    ["tool_name", "arg1", "arg2"],
    ["anytool", "help"]
    ["emit_chat_message", "Respond to the users inquiry"]
  ],
  "markDone": true
}`;

    const prompt = await this.enrichPrompt(basePrompt, state, {
      includeSoul: true,
      includeAwareness: true,
      includeMemory: true,
      includeTools: true,
      toolDetail: 'tactical',
      includeSkills: false,
      includeStrategicPlan: true,
      includeTacticalPlan: true,
      includeKnowledgeGraphInstructions: 'executor',
    });

    agentLog(this.name, `planTacticalStepExecution prompt:\n${prompt})`);

    try {
      const response = await this.prompt(prompt, state);
      if (!response?.content) {
        return null;
      }

      const parsed = parseJson<any>(response.content);
      if (!parsed) {
        // LLM returned non-JSON - check if it looks like a completion summary
        const content = response.content.toLowerCase();
        const looksLikeCompletion = content.includes('success') || 
          content.includes('complete') || 
          content.includes('created') ||
          content.includes('done') ||
          content.includes('verified');
        
        if (looksLikeCompletion) {
          agentWarn(this.name, 'LLM returned non-JSON completion summary, treating as done');
          return {
            tools: [],
            markDone: true,
            summary: response.content.substring(0, 200),
          };
        }

        agentWarn(this.name, 'Could not parse JSON from LLM response', { responseLength: response.content.length });
        return null;
      }

      const normalized = this.normalizeToolCalls(Array.isArray(parsed.tools) ? parsed.tools : []);
      return {
        tools: normalized.map(n => ({ 
          tool: n.toolName, 
          args: Array.isArray(n.args) ? { args: n.args } : n.args 
        })),
        markDone: parsed.markDone !== false,
        summary: parsed.summary || '',
      };
    } catch (err) {
      agentError(this.name, 'Failed to plan tactical step', err);
      return null;
    }
  }

}
