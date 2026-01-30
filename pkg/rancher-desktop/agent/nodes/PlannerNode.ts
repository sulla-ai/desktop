// PlannerNode - Uses LLM to analyze requests and create execution plans
// Plans are structured with intent classification, required steps, and context needs
// Includes memory search tool to query ChromaDB for relevant past conversations/entities

import type { ThreadState, NodeResult } from '../types';
import { BaseNode } from './BaseNode';
import { getChromaService } from '../services/ChromaService';
import { getMemoryPedia } from '../services/MemoryPedia';

// Plan structure for conversation handling
interface ConversationPlan {
  // Intent classification
  intent: {
    type: 'question' | 'task' | 'conversation' | 'clarification' | 'follow_up';
    confidence: number;
    description: string;
  };
  // What the user is trying to accomplish
  goal: string;
  // Whether this requires tools/actions or just a response
  requiresTools: boolean;
  // Ordered steps to execute
  steps: Array<{
    id: string;
    action: string;
    description: string;
    dependsOn: string[]; // IDs of steps this depends on
  }>;
  // Context requirements
  context: {
    needsMemoryRecall: boolean;
    memorySearchQueries: string[]; // Specific queries to search in ChromaDB
    needsExternalData: boolean;
    relevantTopics: string[];
  };
  // Response guidance
  responseGuidance: {
    tone: 'formal' | 'casual' | 'technical' | 'friendly';
    format: 'brief' | 'detailed' | 'structured' | 'conversational';
    includeExamples: boolean;
  };
}

export class PlannerNode extends BaseNode {
  constructor() {
    super('planner', 'Planner');
  }

  async execute(state: ThreadState): Promise<{ state: ThreadState; next: NodeResult }> {
    console.log(`[Agent:Planner] Executing...`);
    const lastUserMessage = state.messages.filter(m => m.role === 'user').pop();

    if (!lastUserMessage) {
      console.log(`[Agent:Planner] No user message, ending`);

      return { state, next: 'end' };
    }

    // Build conversation context for planning
    const conversationContext = this.buildConversationContext(state);
    console.log(`[Agent:Planner] Context: ${state.messages.length} messages, thread: ${state.threadId}`);

    // Use LLM to create a plan
    const plan = await this.createPlan(lastUserMessage.content, conversationContext, state);

    const mentionsMemory = /\b(chroma|chromadb|memorypedia|memory pedia|memory graph|long[- ]term memory|remember|recall|previously)\b/i
      .test(lastUserMessage.content);

    if (plan) {
      console.log(`[Agent:Planner] Plan created:`);
      console.log(`  Intent: ${plan.intent.type} (${(plan.intent.confidence * 100).toFixed(0)}%)`);
      console.log(`  Goal: ${plan.goal}`);
      console.log(`  Steps: ${plan.steps.map(s => s.action).join(' → ')}`);
      console.log(`  Requires tools: ${plan.requiresTools}`);
      console.log(`  Needs memory recall: ${plan.context?.needsMemoryRecall || false}`);
      console.log(`  Response format: ${plan.responseGuidance.format}, tone: ${plan.responseGuidance.tone}`);

      const shouldRecallMemory = Boolean(plan.context?.needsMemoryRecall) || mentionsMemory;
      const memoryQueries = (plan.context?.memorySearchQueries && plan.context.memorySearchQueries.length > 0)
        ? plan.context.memorySearchQueries
        : (mentionsMemory ? [lastUserMessage.content] : []);

      // If plan needs memory recall (or user explicitly asked about memory), search ChromaDB now
      if (shouldRecallMemory && memoryQueries.length > 0) {
        console.log(`[Agent:Planner] Searching memory for: ${memoryQueries.join(', ')}`);
        const memoryResults = await this.searchMemory(memoryQueries);

        if (memoryResults.length > 0) {
          console.log(`[Agent:Planner] Found ${memoryResults.length} relevant memories`);
          state.metadata.retrievedMemories = memoryResults;
          state.metadata.memoryContext = memoryResults
            .map((m: string, i: number) => `[Memory ${i + 1}]: ${m}`)
            .join('\n');
        } else {
          console.log(`[Agent:Planner] No relevant memories found`);
        }
      }

      // Store the full plan in metadata
      state.metadata.plan = {
        requiresTools: plan.requiresTools,
        steps:         plan.steps.map(s => s.action),
        fullPlan:      plan,
      };

      return { state, next: 'executor' };
    }

    // Fallback to simple plan if LLM planning fails
    console.log(`[Agent:Planner] LLM planning failed, using fallback`);

    const wantsCount = /\b(how many|count|number of|total)\b/i.test(lastUserMessage.content)
      && /\b(memory|memories|articles|pages|chroma|chromadb|memorypedia)\b/i.test(lastUserMessage.content);

    const fallbackMentionsMemory = /\b(chroma|chromadb|memorypedia|memory pedia|memory graph|long[- ]term memory|remember|recall|previously)\b/i
      .test(lastUserMessage.content);

    const fallbackSteps: Array<{ id: string; action: string; description: string; dependsOn: string[] }> = [];
    const fallbackStepActions: string[] = [];

    if (wantsCount) {
      fallbackSteps.push({
        id:          'step_1',
        action:      'count_memory_articles',
        description: 'Count memory items stored in ChromaDB/MemoryPedia',
        dependsOn:   [],
      });
      fallbackStepActions.push('count_memory_articles');
    }

    if (fallbackMentionsMemory) {
      fallbackSteps.push({
        id:          `step_${fallbackSteps.length + 1}`,
        action:      'recall_memory',
        description: 'Recall relevant long-term memory from ChromaDB/MemoryPedia',
        dependsOn:   fallbackSteps.length > 0 ? [fallbackSteps[fallbackSteps.length - 1].id] : [],
      });
      fallbackStepActions.push('recall_memory');
    }

    fallbackSteps.push({
      id:          `step_${fallbackSteps.length + 1}`,
      action:      'generate_response',
      description: 'Respond to the user using any tool outputs and conversation context',
      dependsOn:   fallbackSteps.length > 0 ? [fallbackSteps[fallbackSteps.length - 1].id] : [],
    });
    fallbackStepActions.push('generate_response');

    const fallbackRequiresTools = wantsCount || fallbackMentionsMemory;

    state.metadata.plan = {
      requiresTools: fallbackRequiresTools,
      steps:         fallbackStepActions,
      fullPlan:      {
        intent: {
          type:        'question',
          confidence:  0.4,
          description: 'Fallback plan generated because LLM planning timed out or failed',
        },
        goal:          'Answer the user request using available tools where applicable',
        requiresTools: fallbackRequiresTools,
        steps:         fallbackSteps,
        context: {
          needsMemoryRecall:  fallbackMentionsMemory,
          memorySearchQueries: fallbackMentionsMemory ? [lastUserMessage.content] : [],
          needsExternalData:  false,
          relevantTopics:     [],
        },
        responseGuidance: {
          tone:            'technical',
          format:          'brief',
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

    const prompt = `You are a planning assistant. Analyze this user request and create an execution plan.

User message: "${userMessage}"

${context ? `Context:\n${context}\n` : ''}

IMPORTANT: You have access to a long-term memory system (ChromaDB) that stores:
- Past conversation summaries
- Entity pages (people, projects, technologies, concepts, etc.)

Available tools:
1) memory_search (ChromaDB/MemoryPedia)
   - Purpose: Recall relevant long-term memory (past conversation summaries and entity pages).
   - Input: One or more short, specific search queries (entity names, project names, error strings, feature names).
   - Output: Relevant memory snippets will be provided to the assistant as additional context.
   - Use when:
     - User asks about what you "remember" or prior discussions.
     - User references MemoryPedia, Chroma, long-term memory, or an entity/topic that may already exist.
     - User asks follow-ups like "how did we do X last time" or "what was the previous decision".

2) count_memory_articles (ChromaDB/MemoryPedia)
   - Purpose: Count how many memory items exist in long-term memory.
   - Output: Counts for conversation summaries and memorypedia pages (and a total).
   - Use when:
     - User asks: "how many articles/memories/pages are stored" or any question requiring counts.
   - Planning guidance:
     - Set requiresTools=true
     - Include a step with action "count_memory_articles" before generating the final response.

If the user is asking about something that might have been discussed before, or references a topic/entity that could be in memory, you MUST:
- Set context.needsMemoryRecall=true
- Provide context.memorySearchQueries with 1-5 specific queries
- Include a step with action "recall_memory" before generating the final response.

Create a plan in JSON format:
{
  "intent": {
    "type": "question" | "task" | "conversation" | "clarification" | "follow_up",
    "confidence": 0.0-1.0,
    "description": "brief description of what user wants"
  },
  "goal": "what the user is trying to accomplish",
  "requiresTools": false,
  "steps": [
    {
      "id": "step_1",
      "action": "action_name (e.g., recall_memory, generate_response, search_knowledge)",
      "description": "what this step does",
      "dependsOn": []
    }
  ],
  "context": {
    "needsMemoryRecall": true/false (set true if user asks about past topics, entities, or references something that might be stored),
    "memorySearchQueries": ["specific search query 1", "entity name to look up"] (provide if needsMemoryRecall is true),
    "needsExternalData": true/false,
    "relevantTopics": ["topic1", "topic2"]
  },
  "responseGuidance": {
    "tone": "formal" | "casual" | "technical" | "friendly",
    "format": "brief" | "detailed" | "structured" | "conversational",
    "includeExamples": true/false
  }
}

Respond ONLY with the JSON, no other text.`;

    try {
      console.log(`[Agent:Planner] Sending planning prompt (${prompt.length} chars)`);
      const response = await this.llmService.generate(prompt);

      if (!response) {
        console.warn('[Agent:Planner] No response from LLM');

        return null;
      }

      console.log(`[Agent:Planner] Received response (${response.length} chars)`);

      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        console.warn('[Agent:Planner] No JSON found in response');

        return null;
      }

      const plan = JSON.parse(jsonMatch[0]) as ConversationPlan;

      // Validate required fields
      if (!plan.intent || !plan.goal || !plan.steps) {
        console.warn('[Agent:Planner] Invalid plan structure');

        return null;
      }

      return plan;
    } catch (err) {
      console.error('[Agent:Planner] Planning failed:', err);

      return null;
    }
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
