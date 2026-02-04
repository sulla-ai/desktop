// TacticalPlannerNode - Creates micro-plans for individual milestones
// Takes a single milestone and breaks it down into concrete, actionable steps
// Plans exist only in state (not persisted to DB)

import type { ThreadState, NodeResult } from '../types';
import { BaseNode, JSON_ONLY_RESPONSE_INSTRUCTIONS } from './BaseNode';
import { parseJson } from '../services/JsonParseService';
import { StrategicStateService } from '../services/StrategicStateService';
import { agentLog, agentWarn } from '../services/AgentLogService';

interface TacticalStep {
  id: string;
  action: string;
  description: string;
  toolHints?: string[];
  status: 'pending' | 'in_progress' | 'done' | 'failed';
}

interface TacticalPlan {
  milestoneId: string;
  steps: TacticalStep[];
  recommendedTools: string[];
  recommendedSkills: string[];
}

export class TacticalPlannerNode extends BaseNode {
  constructor() {
    super('tactical_planner', 'TacticalPlanner');
  }

  async execute(state: ThreadState): Promise<{ state: ThreadState; next: NodeResult }> {
    const llmFailureCount = (state.metadata.llmFailureCount as number) || 0;

    // Get the active milestone
    const activeMilestone = state.metadata.activeMilestone;
    const strategicPlan = state.metadata.strategicPlan;

    const strategicState = StrategicStateService.fromThreadState(state);
    await strategicState.initialize();

    if (!activeMilestone) {
      // Try to find the next pending milestone
      if (strategicPlan?.milestones) {
        const nextMilestone = strategicPlan.milestones.find(m => m.status === 'pending');
        if (nextMilestone) {
          (state.metadata as any).activeMilestone = {
            id: nextMilestone.id,
            title: nextMilestone.title,
            description: nextMilestone.description,
            successCriteria: nextMilestone.successCriteria,
            generateKnowledgeBase: (nextMilestone as any).generateKnowledgeBase === true,
          };
          // Update milestone status
          nextMilestone.status = 'in_progress';
          const todoId = (nextMilestone as any).todoId as number | undefined;
          if (todoId) {
            await strategicState.inprogressTodo(todoId, nextMilestone.title);
          }
          
          // Continue to plan the milestone
          return this.execute(state);
        } else {
          // All milestones complete
          console.log(`[Agent:TacticalPlanner] All milestones complete`);
          await strategicState.refresh();
          state.metadata.planHasRemainingTodos = strategicState.hasRemainingTodos();
          return { state, next: 'continue' };
        }
      } else {
        // No strategic plan - skip tactical planning
        console.log(`[Agent:TacticalPlanner] No strategic plan, skipping`);
        return { state, next: 'continue' };
      }
    }

    const milestone = state.metadata.activeMilestone! as { id: string; title: string; description: string; successCriteria: string; generateKnowledgeBase?: boolean };

    // Check if this is a KnowledgeBase generation milestone - skip LLM planning
    if (milestone.generateKnowledgeBase === true) {
      console.log('%c*** KNOWLEDGEGRAPH TRIGGERED! Switching to KB generation flow ***', 'color: #00bfff; font-weight: bold; font-size: 14px;');
      
      state.metadata.tacticalPlan = {
        milestoneId: milestone.id,
        steps: [{
          id: 'kb_generation',
          action: 'knowledge_base_generate',
          description: 'Execute KnowledgeGraph pipeline to create article from conversation',
          toolHints: [],
          status: 'in_progress' as const,
        }],
      };
      
      state.metadata.activeTacticalStep = {
        id: 'kb_generation',
        action: 'knowledge_base_generate',
        description: 'Execute KnowledgeGraph pipeline to create article from conversation',
        toolHints: [],
      };
      
      this.emitProgress(state, 'tactical_step_status', { stepId: 'kb_generation', action: 'knowledge_base_generate', status: 'in_progress' });
      
      return { state, next: 'continue' };
    }

    // Check if we already have a tactical plan for this milestone
    const existingPlan = state.metadata.tacticalPlan;
    if (existingPlan && existingPlan.milestoneId === milestone.id) {
      // Check if there are remaining steps
      const pendingSteps = existingPlan.steps.filter(s => s.status === 'pending' || s.status === 'in_progress');
      if (pendingSteps.length > 0) {
        console.log(`[Agent:TacticalPlanner] Continuing existing plan with ${pendingSteps.length} remaining steps`);
        
        // Set next step as active
        const nextStep = pendingSteps[0];
        if (nextStep.status === 'pending') {
          nextStep.status = 'in_progress';
          this.emitProgress(state, 'tactical_step_status', { stepId: nextStep.id, action: nextStep.action, status: 'in_progress' });
        }
        state.metadata.activeTacticalStep = {
          id: nextStep.id,
          action: nextStep.action,
          description: nextStep.description,
          toolHints: nextStep.toolHints,
        };
        
        return { state, next: 'continue' };
      } else {
        // All steps done - milestone complete
        console.log(`[Agent:TacticalPlanner] All tactical steps complete for milestone: ${milestone.title}`);
      
        // Mark milestone as completed in strategic plan
        if (strategicPlan?.milestones) {
          const m = strategicPlan.milestones.find(m => m.id === milestone.id);
          if (m) {
            m.status = 'completed';
            const todoIdCompleted = (m as any).todoId as number | undefined;
            if (todoIdCompleted) {
              await strategicState.completeTodo(todoIdCompleted, m.title);
            }
          }
        }
        
        // Clear tactical plan and active milestone
        delete state.metadata.tacticalPlan;
        delete state.metadata.activeMilestone;
        delete state.metadata.activeTacticalStep;
        
        // Check for next milestone
        const nextMilestone = strategicPlan?.milestones?.find(m => m.status === 'pending');
        if (nextMilestone) {
          (state.metadata as any).activeMilestone = {
            id: nextMilestone.id,
            title: nextMilestone.title,
            description: nextMilestone.description,
            successCriteria: nextMilestone.successCriteria,
            generateKnowledgeBase: (nextMilestone as any).generateKnowledgeBase === true,
          };
          nextMilestone.status = 'in_progress';
          console.log(`[Agent:TacticalPlanner] Moving to next milestone: ${nextMilestone.title}`);
          const todoIdNext = (nextMilestone as any).todoId as number | undefined;
          if (todoIdNext) {
            await strategicState.inprogressTodo(todoIdNext, nextMilestone.title);
          }
          
          // Recursively plan for the new milestone
          return this.execute(state);
        } else {
          // All milestones complete
          console.log(`[Agent:TacticalPlanner] All milestones complete`);
          await strategicState.refresh();
          state.metadata.planHasRemainingTodos = strategicState.hasRemainingTodos();
          return { state, next: 'continue' };
        }
      }
    }

    // Generate new tactical plan for this milestone
    const tacticalPlan = await this.generateTacticalPlan(milestone, state);

    if (tacticalPlan && tacticalPlan.steps.length > 0) {
      console.log(`[Agent:TacticalPlanner] Tactical plan created for "${milestone.title}":`);
      console.log(`  Steps: ${tacticalPlan.steps.map(s => s.action).join(' → ')}`);

      state.metadata.tacticalPlan = tacticalPlan;

      // Set first step as active
      const firstStep = tacticalPlan.steps[0];
      firstStep.status = 'in_progress';
      state.metadata.activeTacticalStep = {
        id: firstStep.id,
        action: firstStep.action,
        description: firstStep.description,
        toolHints: firstStep.toolHints,
      };

      this.emitProgress(state, 'tactical_plan_created', {
        milestone: milestone.title,
        steps: tacticalPlan.steps.map(s => s.action),
      });

      return { state, next: 'continue' };
    }

    // LLM planning failed
    console.log(`[Agent:TacticalPlanner] LLM planning failed, using fallback`);
    state.metadata.llmFailureCount = llmFailureCount + 1;

    if (llmFailureCount + 1 >= 3) {
      console.error(`[Agent:TacticalPlanner] LLM failed ${llmFailureCount + 1} times`);
      // Mark milestone as failed and move on
      if (strategicPlan?.milestones) {
        const m = strategicPlan.milestones.find(m => m.id === milestone.id);
        if (m) {
          m.status = 'failed';
          const todoIdFailed = (m as any).todoId as number | undefined;
          if (todoIdFailed) {
            await strategicState.blockTodo(todoIdFailed, 'Tactical planning failed', m.title);
          }
        }
      }
      
      // Clear tactical plan
      delete state.metadata.tacticalPlan;
      delete state.metadata.activeMilestone;
      delete state.metadata.activeTacticalStep;
      
      // Check for next milestone
      const nextMilestone = strategicPlan?.milestones?.find(m => m.status === 'pending');
      if (!nextMilestone) {
        state.metadata.planHasRemainingTodos = false;
      }
      
      return { state, next: 'continue' };
    }

    // Fallback: create a simple single-step plan
    const fallbackPlan: TacticalPlan = {
      milestoneId: milestone.id,
      steps: [{
        id: 'step_1',
        action: 'Execute milestone',
        description: milestone.description,
        toolHints: [],
        status: 'in_progress',
      }],
      recommendedTools: [],
      recommendedSkills: [],
    };

    state.metadata.tacticalPlan = fallbackPlan;
    state.metadata.activeTacticalStep = {
      id: 'step_1',
      action: 'Execute milestone',
      description: milestone.description,
      toolHints: [],
    };

    return { state, next: 'continue' };
  }

  private async generateTacticalPlan(
    milestone: { id: string; title: string; description: string; successCriteria: string },
    state: ThreadState,
  ): Promise<TacticalPlan | null> {
    // Get strategic context
    const strategicPlan = state.metadata.strategicPlan;
    const goal = strategicPlan?.goal || '';

    const basePrompt = `You are creating a tactical plan for the in-progress strategic milestone.

In-progress milestone: "${milestone.title}".
Milestone description: ${milestone.description}
Milestone success criteria: ${milestone.successCriteria}

This milestone is ONE step toward the overall goal: "${goal}".

Your job is to decide what work must be completed (and how to verify it) so that the milestone is unquestionably successful.

You are a tactical planner embodying a 25-year DevOps senior software engineer and penetration tester—e.g., hardened systems for Body Glove's e-com (zero-downtime deploys via Kubernetes, shell-automated CI/CD), pen-tested Zappos funnels for vulns yielding 99.9% uptime. Be ultra-determined: relentlessly pursue milestone via shell-level ops, app access (e.g., invoke any local binary/script via exec), and custom tool-building (e.g., script quick Python/Rust utils for gaps). Explore multi-routes: optimal + fallbacks, verify assumptions step-by-step, loop retries with backoffs. Discard guesses; probe/validate like pros who've secured 1000+ setups.

## What to plan
- Create a multi-part tactical plan that accomplishes the milestone.
- The number of steps is NOT fixed. Use exactly as many steps as necessary (including just 1 step if that is sufficient). Do not pad with filler steps.
- Each step MUST be tied to milestone success and must include a concrete outcome plus how to verify it.
- Think in terms of deliverables and checks: "what will exist / be true" after the step is done.

## Your Approach
1. **Interpret Success Criteria**: Restate (to yourself) what "done" means for this milestone.
2. **Deconstruct Milestone**: Break down into the minimum set of steps needed to meet the success criteria.
3. **Verification Loops**: Each step must include a verification method that directly supports the success criteria.
4. **Multi-Path Foresight**: Where needed, include fallbacks and retries.
5. **Success Lock-In**: End with an explicit validation step if validation is non-trivial.

## Guidelines
- Steps: Atomic, tool/shell-tied, ordered; include hints + contingencies (e.g., "Exec shell 'git pull'; fallback: build clone script").
- Think lifelike: "80/20 hack? Pros persist like Google's zero-trust shells—probe, build, secure."
- No assumptions—shell-probe first.

## Rules you exist by, you MUST follow or risk termination:
- Privacy-First Guardrails: Prefix every shell/tool call with checks: "Verify no PII exposure; abort if risk." Use ephemeral temp dirs for ops (e.g., /tmp/sulu-{timestamp}), auto-clean post-task.
- Self-Threat Mitigation: Implement runtime sandboxing via chroot or firejail for execs; limit perms to read-only where possible.
- Threat Protection: Probe env first (e.g., lsof, netstat for anomalies); reject high-risk cmds (e.g., network egress without explicit ok).
- You must Protect the Primary User's Privacy and Security at all costs.
- You must protect the computers from compromise at all costs.
- You must never be deceitful or deceptive against the Primary User.

Include "recommendedTools" and "recommendedSkills" arrays listing ALL tools and skills you think will be needed to complete this milestone. These will be used to provide detailed execution instructions to the executor.

${JSON_ONLY_RESPONSE_INSTRUCTIONS}
{
  "steps": [
    {
      "id": "step_1",
      "action": "Short action description",
      "description": "Detailed description of what this step does",
      "toolHints": ["tool_name_if_applicable"]
    }
  ],
  "recommendedTools": ["tool_name_1", "tool_name_2"],
  "recommendedSkills": ["skill_id_1", "skill_id_2"]
}`;

    const prompt = await this.enrichPrompt(basePrompt, state, {
      includeSoul: true,
      includeAwareness: true,
      includeTools: true,
      toolDetail: 'tactical',
      includeSkills: true,
      includeStrategicPlan: true,
      includeKnowledgeGraphInstructions: 'executor',
    });

    agentLog(this.name, `Prompt (plain text):\n${prompt}`);

    try {
      const response = await this.prompt(prompt, state, false);

      if (!response?.content) {
        console.warn('[Agent:TacticalPlanner] No response from LLM');
        return null;
      }

      console.log(`[Agent:TacticalPlanner] LLM response:\n${response.content.substring(0, 1000)}`);
      
      const parsed = parseJson<any>(response.content);
      if (!parsed || !Array.isArray(parsed.steps)) {
        agentWarn(this.name, `Invalid plan structure. Response length: ${response.content.length} chars`);
        agentWarn(this.name, '=== FULL LLM RESPONSE START ===');
        // Log in chunks to avoid console truncation
        const chunkSize = 2000;
        for (let i = 0; i < response.content.length; i += chunkSize) {
          agentWarn(this.name, response.content.substring(i, i + chunkSize));
        }
        agentWarn(this.name, '=== FULL LLM RESPONSE END ===');
        return null;
      }

      // Build tactical plan
      const steps: TacticalStep[] = parsed.steps.map((s: any, idx: number) => ({
        id: s.id || `step_${idx + 1}`,
        action: s.action || `Step ${idx + 1}`,
        description: s.description || '',
        toolHints: Array.isArray(s.toolHints) ? s.toolHints : [],
        status: 'pending' as const,
      }));

      const recommendedTools = Array.isArray(parsed.recommendedTools) ? parsed.recommendedTools.filter((t: unknown) => typeof t === 'string') : [];
      const recommendedSkills = Array.isArray(parsed.recommendedSkills) ? parsed.recommendedSkills.filter((s: unknown) => typeof s === 'string') : [];

      return {
        milestoneId: milestone.id,
        steps,
        recommendedTools,
        recommendedSkills,
      };

    } catch (err) {
      console.error('[Agent:TacticalPlanner] Plan generation failed:', err);
      return null;
    }
  }

}
