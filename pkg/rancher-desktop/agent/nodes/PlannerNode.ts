// PlannerNode - Uses LLM to analyze requests and create execution plans
// Plans are structured with intent classification, required steps, and context needs
// Includes memory search tool to query ChromaDB for relevant past conversations/entities

import type { ThreadState, NodeResult } from '../types';
import { BaseNode } from './BaseNode';
import { getChromaService } from '../services/ChromaService';
import { getMemoryPedia } from '../services/MemoryPedia';
import { getPlanService } from '../services/PlanService';
import { getAwarenessService } from '../services/AwarenessService';
import { getToolRegistry, registerDefaultTools } from '../tools';
import { jsonrepair } from 'jsonrepair';

// Plan structure for conversation handling
interface ConversationPlan {
  // Intent classification
  intent: {
    type: 'question' | 'task' | 'conversation' | 'clarification' | 'follow_up' | 'exploration';
    confidence: number;
    description: string;
  };
  // Whether we should create/persist a plan (simple questions may not need one)
  planNeeded: boolean;
  // What the user is trying to accomplish
  goal: string;
  // Whether this requires tools/actions or just a response
  requiresTools: boolean;
  // Ordered todos to execute (high-level; executor selects tools per todo)
  todos: Array<{
    id: string;
    title: string;
    description: string;
    dependsOn: string[]; // IDs of todos this depends on
    categoryHints?: string[];
  }>;
  // Back-compat: older planners may return steps; we map them into todos.
  steps?: Array<{
    id: string;
    action: string;
    description: string;
    dependsOn: string[];
  }>;
  // Context requirements
  context?: {
    needsMemoryRecall?: boolean;
    memorySearchQueries?: string[];
    // Specific queries to search in ChromaDB
    needsExternalData: boolean;
    relevantTopics: string[];
  };
  // Response guidance
  responseGuidance: {
    tone: 'formal' | 'casual' | 'technical' | 'friendly';
    format: 'brief' | 'detailed' | 'json' | 'markdown' | 'conversational';
    includeExamples: boolean;
    lengthConstraint: "short" | "medium" | "long"
  };
}

export class PlannerNode extends BaseNode {
  constructor() {
    super('planner', 'Planner');
  }

  async execute(state: ThreadState): Promise<{ state: ThreadState; next: NodeResult }> {
    console.log(`[Agent:Planner] Executing...`);
    const emit = (state.metadata.__emitAgentEvent as ((event: { type: 'progress' | 'chunk' | 'complete' | 'error'; threadId: string; data: unknown }) => void) | undefined);
    const lastUserMessage = state.messages.filter(m => m.role === 'user').pop();

    if (!lastUserMessage) {
      console.log(`[Agent:Planner] No user message, ending`);

      return { state, next: 'end' };
    }

    // Build conversation context for planning
    const conversationContext = this.buildConversationContext(state);
    console.log(`[Agent:Planner] Context: ${state.messages.length} messages, thread: ${state.threadId}`);

    const revisionReason = String(
      (state.metadata.requestPlanRevision && (state.metadata.requestPlanRevision as any).reason)
      || state.metadata.revisionFeedback
      || '',
    ).trim();

    const awareness = getAwarenessService();
    await awareness.initialize();
    const activePlanIdRaw = (state.metadata.activePlanId !== undefined && state.metadata.activePlanId !== null)
      ? String(state.metadata.activePlanId)
      : String((awareness.getData().active_plan_ids || [])[0] || '');
    const priorPlanId = activePlanIdRaw && Number.isFinite(Number(activePlanIdRaw)) ? Number(activePlanIdRaw) : null;

    const forcePlan = Boolean(priorPlanId || revisionReason);

    // Use LLM to create a plan
    const plan = await this.createPlan(lastUserMessage.content, conversationContext, state);

    const mentionsMemory = /\b(chroma|chromadb|memorypedia|memory pedia|memory graph|long[- ]term memory|remember|recall|previously)\b/i
      .test(lastUserMessage.content);

    if (plan) {
      console.log(`[Agent:Planner] Plan created:`);
      console.log(`  Intent: ${plan.intent.type} (${(plan.intent.confidence * 100).toFixed(0)}%)`);
      console.log(`  Plan needed: ${plan.planNeeded}`);
      console.log(`  Goal: ${plan.goal}`);
      console.log(`  Todos: ${plan.todos.map(t => t.title).join(' → ')}`);
      console.log(`  Requires tools: ${plan.requiresTools}`);
      console.log(`  Needs memory recall: ${plan.context?.needsMemoryRecall || false}`);
      console.log(`  Response format: ${plan.responseGuidance.format}, tone: ${plan.responseGuidance.tone}`);

      const shouldPersistPlan = forcePlan || !!plan.planNeeded;

      if (shouldPersistPlan) {
        try {
          registerDefaultTools();
          const todos = plan.todos
            .map((t, idx) => ({
              title: t.title,
              description: t.description || t.title,
              orderIndex: idx,
              categoryHints: Array.isArray(t.categoryHints) ? t.categoryHints.map(String) : [],
            }));

          const planService = getPlanService();
          await planService.initialize();

          console.log(`[Agent:Planner] Persisting plan to Postgres: thread=${state.threadId}, todos=${todos.length}, priorPlanId=${priorPlanId || 'none'}`);

          const data = {
            intent: plan.intent,
            goal: plan.goal,
            context: plan.context,
            responseGuidance: plan.responseGuidance,
          };

          if (priorPlanId) {
            const revised = await planService.revisePlan({
              planId: priorPlanId,
              data,
              todos,
              eventData: {
                reason: revisionReason || 'Plan revised',
              },
            });

            console.log(`[Agent:Planner] Plan revision result: ${revised ? `planId=${revised.planId} revision=${revised.revision}` : 'FAILED'}`);

            if (revised) {
              await awareness.update({ active_plan_ids: [String(revised.planId)] });
              state.metadata.activePlanId = revised.planId;

              emit?.({
                type:     'progress',
                threadId: state.threadId,
                data:     { phase: 'plan_revised', planId: revised.planId, revision: revised.revision, goal: plan.goal },
              });

              for (const deletedId of revised.todosDeleted) {
                emit?.({
                  type:     'progress',
                  threadId: state.threadId,
                  data:     { phase: 'todo_deleted', planId: revised.planId, todoId: deletedId },
                });
              }

              for (const t of revised.todosCreated) {
                emit?.({
                  type:     'progress',
                  threadId: state.threadId,
                  data:     { phase: 'todo_created', planId: revised.planId, todoId: t.todoId, title: t.title, orderIndex: t.orderIndex, status: t.status },
                });
              }

              for (const t of revised.todosUpdated) {
                emit?.({
                  type:     'progress',
                  threadId: state.threadId,
                  data:     { phase: 'todo_updated', planId: revised.planId, todoId: t.todoId, title: t.title, orderIndex: t.orderIndex, status: t.status },
                });
              }

              // Clear revision request flags for the next executor cycle.
              delete (state.metadata as any).requestPlanRevision;
              delete (state.metadata as any).revisionFeedback;
            }
          } else {
            const created = await planService.createPlan({
              threadId: state.threadId,
              data,
              todos,
              eventData: {},
            });

            console.log(`[Agent:Planner] Plan creation result: ${created?.planId ? `planId=${created.planId}` : 'FAILED'}`);

            if (created?.planId) {
              await awareness.update({ active_plan_ids: [String(created.planId)] });
              state.metadata.activePlanId = created.planId;

              emit?.({
                type:     'progress',
                threadId: state.threadId,
                data:     { phase: 'plan_created', planId: created.planId, revision: 1, goal: plan.goal },
              });

              for (const t of created.todos) {
                emit?.({
                  type:     'progress',
                  threadId: state.threadId,
                  data:     { phase: 'todo_created', planId: created.planId, todoId: t.todoId, title: t.title, orderIndex: t.orderIndex, status: 'pending' },
                });
              }

              console.log(`[Agent:Planner] Awareness updated: active_plan_ids=[${created.planId}]`);

              // Clear revision request flags for the next executor cycle.
              delete (state.metadata as any).requestPlanRevision;
              delete (state.metadata as any).revisionFeedback;
            }
          }
        } catch (err) {
          console.warn('[Agent:Planner] Failed to persist plan:', err);
        }
      } else {
        // Explicitly do not create a persistent plan for simple queries.
        console.log('[Agent:Planner] Plan not persisted (planNeeded=false and no active plan/revision).');
        state.metadata.planHasRemainingTodos = false;
      }

      // Store the full plan in metadata
      state.metadata.plan = {
        requiresTools: plan.requiresTools,
        todos: plan.todos.map(t => t.title),
        fullPlan: plan,
      };

      return { state, next: 'executor' };
    }

    // Fallback to simple plan if LLM planning fails
    console.log(`[Agent:Planner] LLM planning failed, using fallback`);

    const wantsCount = /\b(how many|count|number of|total)\b/i.test(lastUserMessage.content)
      && /\b(memory|memories|articles|pages|chroma|chromadb|memorypedia)\b/i.test(lastUserMessage.content);

    const fallbackMentionsMemory = /\b(chroma|chromadb|memorypedia|memory pedia|memory graph|long[- ]term memory|remember|recall|previously)\b/i
      .test(lastUserMessage.content);

    const fallbackTodos: Array<{ id: string; title: string; description: string; dependsOn: string[] }> = [];
    const fallbackTodoTitles: string[] = [];

    if (wantsCount) {
      fallbackTodos.push({
        id: 'todo_1',
        title: 'Count memory items',
        description: 'Count memory items stored in ChromaDB/MemoryPedia',
        dependsOn: [],
      });
      fallbackTodoTitles.push('Count memory items');
    }

    if (fallbackMentionsMemory) {
      fallbackTodos.push({
        id: `todo_${fallbackTodos.length + 1}`,
        title: 'Recall relevant memory',
        description: 'Recall relevant long-term memory from ChromaDB/MemoryPedia',
        dependsOn: fallbackTodos.length > 0 ? [fallbackTodos[fallbackTodos.length - 1].id] : [],
      });
      fallbackTodoTitles.push('Recall relevant memory');
    }

    fallbackTodos.push({
      id: `todo_${fallbackTodos.length + 1}`,
      title: 'Generate response',
      description: 'Respond to the user using any tool outputs and conversation context',
      dependsOn: fallbackTodos.length > 0 ? [fallbackTodos[fallbackTodos.length - 1].id] : [],
    });
    fallbackTodoTitles.push('Generate response');

    const fallbackRequiresTools = wantsCount || fallbackMentionsMemory;

    state.metadata.plan = {
      requiresTools: fallbackRequiresTools,
      todos: fallbackTodoTitles,
      fullPlan: {
        intent: {
          type: 'question',
          confidence: 0.4,
          description: 'Fallback plan generated because LLM planning timed out or failed',
        },
        goal: 'Answer the user request using available tools where applicable',
        requiresTools: fallbackRequiresTools,
        todos: fallbackTodos,
        context: {
          needsMemoryRecall: fallbackMentionsMemory,
          memorySearchQueries: fallbackMentionsMemory ? [lastUserMessage.content] : [],
          needsExternalData: false,
          relevantTopics: [],
        },
        responseGuidance: {
          tone: 'technical',
          format: 'brief',
          includeExamples: false,
        },
      },
    };

    return { state, next: 'executor' };
  }

  /**
   * Build context from conversation history for planning
   */
  private buildConversationContext(state: ThreadState): string {
    const recentMessages = state.messages.slice(-6); // Last 6 messages for context
    const contextParts: string[] = [];

    const memories = state.metadata.memories as string[] | undefined;

    if (memories && memories.length > 0) {
      contextParts.push(`Relevant memories: ${memories.slice(0, 3).join('; ')}`);
    }

    if (recentMessages.length > 1) {
      const history = recentMessages.slice(0, -1).map(m => `${m.role}: ${m.content.substring(0, 100)}`).join('\n');

      contextParts.push(`Recent conversation:\n${history}`);
    }

    return contextParts.join('\n\n');
  }

  /**
   * Use LLM to create a structured plan for handling the request
   */
  private async createPlan(
    userMessage: string,
    context: string,
    state: ThreadState,
  ): Promise<ConversationPlan | null> {
    if (!this.llmService) {
      console.warn('[Agent:Planner] No LLM service available');

      return null;
    }

    registerDefaultTools();
    const registry = getToolRegistry();
    const categoryIndex = registry.getCompactCategoryIndexBlock({ includeToolNames: true });
    const toolsBlock = registry.getCompactPlanningInstructionsBlock({
      includeCategories: ['memory'],
    });

    const prompt = `You are an advanced planning agent for complex tasks. Analyze the user request and generate a high-level execution plan.

User message: "${userMessage}"

${context ? `Context:\n${context}\n` : ''}

Long-term memory access: Use tool:memory_search for past summaries, entities (people, projects, tech, concepts).

Available tool categories:
${categoryIndex}

Tools:
${toolsBlock}

Guidelines:
- Output high-level steps as TODOs (focus on objectives, not specific tool calls—defer tool selection to execution phase).
- For tool/capability discovery: Prioritize summarizing categories, suggest read-only tests for safety.
- Detect if plan unnecessary (simple queries): Set planNeeded false.
- Incorporate dependencies, parallelism where possible.
- Optimize for efficiency: Minimize steps, maximize reuse of memory/external data.

Output JSON plan:
{
  "intent": {
    "type": "question" | "task" | "conversation" | "clarification" | "follow_up" | "exploration",
    "confidence": 0.0-1.0,
    "description": "concise user intent summary"
  },
  "planNeeded": boolean,
  "goal": "user's core objective",
  "requiresTools": boolean,
  "todos": [
    {
      "id": "todo_id",
      "title": "short TODO title",
      "description": "step purpose and expected output",
      "dependsOn": string[] (previous todo/step ids),
      "parallelizable": boolean,
      "categoryHints": []
    }
  ],
  "context": {
    "relevantTopics": string[],
    "potentialRisks": string[] (e.g., data privacy, API limits)
  },
  "responseGuidance": {
    "tone": "formal" | "casual" | "technical" | "friendly",
    "format": "brief" | "detailed" | "json" | "markdown" | "conversational",
    "includeExamples": boolean,
    "lengthConstraint": "short" | "medium" | "long"
  }
}

Respond solely with JSON.`;

    try {
      const response = await this.prompt(prompt);

      if (!response?.content) {
        console.warn('[Agent:Planner] No response from LLM');

        return null;
      }

      console.log(`[Agent:Planner] Received response (${response.content.length} chars)`);

      // Extract JSON from response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        console.warn('[Agent:Planner] No JSON found in response');

        return null;
      }

      const plan = this.tryParsePlanJson(jsonMatch[0]);
      if (!plan) {
        console.warn('[Agent:Planner] Failed to parse plan JSON');
        return null;
      }

      // Back-compat: map steps into todos if needed.
      if ((!plan.todos || !Array.isArray(plan.todos) || plan.todos.length === 0) && Array.isArray(plan.steps)) {
        plan.todos = plan.steps.map(s => ({
          id: s.id,
          title: s.action,
          description: s.description || s.action,
          dependsOn: Array.isArray(s.dependsOn) ? s.dependsOn.map(String) : [],
          categoryHints: [],
        }));
      }

      // Validate required fields
      if (!plan.intent || !plan.goal || !plan.todos || typeof plan.planNeeded !== 'boolean') {
        console.warn('[Agent:Planner] Invalid plan structure');

        return null;
      }

      return plan;
    } catch (err) {
      console.error('[Agent:Planner] Planning failed:', err);

      return null;
    }
  }

  private tryParsePlanJson(raw: string): ConversationPlan | null {
    try {
      return JSON.parse(raw) as ConversationPlan;
    } catch {
      // continue to repair
    }

    try {
      const repaired = jsonrepair(raw);
      return JSON.parse(repaired) as ConversationPlan;
    } catch {
      return null;
    }
  }

  private selectRelevantTools(userMessage: string): string[] {
    const wantsMemory = /\b(chroma|chromadb|memorypedia|memory pedia|memory graph|long[- ]term memory|remember|recall|previously)\b/i
      .test(userMessage);
    const wantsK8s = /\b(kubernetes|k8s|kubectl|pod|pods|node|nodes|deployment|deployments|service|services|ingress|namespace|namespaces)\b/i
      .test(userMessage);
    const wantsLima = /\b(lima|limactl)\b/i.test(userMessage);
    const wantsApply = /\b(apply|manifest|yaml|helm)\b/i.test(userMessage);
    const wantsLogs = /\b(logs?|describe|events?|rollout|restart|top)\b/i.test(userMessage);
    const wantsSettings = /\b(settings?|config|configuration|preferences?|model mode|timeout|retries|retry|api key|provider|temperature)\b/i
      .test(userMessage);
    const wantsHost = /\b(host|filesystem|file system|files|folder|directory|path|grep|search files|find files|tail|cat|read file|run command)\b/i
      .test(userMessage);
    const wantsPodExec = /\b(exec|shell|bash|sh|inside (the )?pod|in (the )?pod|kubectl exec|run in pod)\b/i
      .test(userMessage);

    const selected = new Set<string>();

    if (wantsMemory) {
      selected.add('memory_search');
      selected.add('count_memory_articles');
    }

    if (wantsK8s) {
      selected.add('kubectl_list_pods');
      selected.add('kubectl_list_nodes');
      selected.add('kubectl_get_deployments');
      selected.add('kubectl_get_services');
      selected.add('kubectl_get_ingresses');
      if (wantsLogs) {
        selected.add('kubectl_logs');
        selected.add('kubectl_describe_pod');
        selected.add('kubectl_get_events');
        selected.add('kubectl_top_nodes');
        selected.add('kubectl_top_pods');
        selected.add('kubectl_rollout_status');
        selected.add('kubectl_rollout_restart');
      }
      if (wantsApply) {
        selected.add('kubectl_apply_dry_run');
        selected.add('kubectl_apply');
      }

      if (wantsPodExec) {
        selected.add('kubectl_exec');
        selected.add('kubectl_cp_from_pod');
        selected.add('kubectl_cp_to_pod');
        selected.add('kubectl_get_pod_yaml');
        selected.add('kubectl_get_pod_status');
      }
    }

    if (wantsLima) {
      selected.add('lima_list_instances');
      selected.add('lima_instance_status');
      selected.add('lima_shell');
    }

    if (wantsSettings) {
      selected.add('agent_get_settings');
      selected.add('agent_update_settings');
    }

    if (wantsHost) {
      selected.add('host_list_dir');
      selected.add('host_read_file');
      selected.add('host_tail_file');
      selected.add('host_stat');
      selected.add('host_find_files');
      selected.add('host_grep');
      selected.add('host_run_command');
    }

    if (selected.size === 0) {
      selected.add('memory_search');
      selected.add('count_memory_articles');
    }

    return Array.from(selected);
  }

  /**
   * Search ChromaDB for relevant memories based on queries
   * Searches both conversation summaries and entity pages
   */
  private async searchMemory(queries: string[]): Promise<string[]> {
    const chroma = getChromaService();
    const results: string[] = [];

    try {
      // Ensure MemoryPedia has initialized (it ensures the collections exist)
      try {
        const memoryPedia = getMemoryPedia();
        await memoryPedia.initialize();
      } catch (err) {
        console.warn('[Agent:Planner] MemoryPedia init failed (continuing):', err);
      }

      const ok = await chroma.initialize();
      if (!ok || !chroma.isAvailable()) {
        console.log('[Agent:Planner] ChromaDB not available');

        return [];
      }

      // Refresh collection cache in case collections were created after initial init
      await chroma.refreshCollections();

      // Search each query across relevant collections
      for (const query of queries) {
        // Search conversation summaries
        const summaryResults = await chroma.query('conversation_summaries', [query], 3);
        if (summaryResults?.documents?.[0]) {
          for (const doc of summaryResults.documents[0]) {
            if (doc && !results.includes(doc)) {
              results.push(doc);
            }
          }
        }

        // Search entity pages (MemoryPedia)
        const pageResults = await chroma.query('memorypedia_pages', [query], 3);
        if (pageResults?.documents?.[0]) {
          for (const doc of pageResults.documents[0]) {
            if (doc && !results.includes(doc)) {
              results.push(doc);
            }
          }
        }
      }

      // Limit total results
      return results.slice(0, 5);
    } catch (err) {
      console.error('[Agent:Planner] Memory search failed:', err);

      return [];
    }
  }
}
