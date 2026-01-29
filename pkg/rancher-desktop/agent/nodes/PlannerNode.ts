// PlannerNode - Uses LLM to analyze requests and create execution plans
// Plans are structured with intent classification, required steps, and context needs

import type { ThreadState, NodeResult } from '../types';
import { BaseNode } from './BaseNode';

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

    if (plan) {
      console.log(`[Agent:Planner] Plan created:`);
      console.log(`  Intent: ${plan.intent.type} (${(plan.intent.confidence * 100).toFixed(0)}%)`);
      console.log(`  Goal: ${plan.goal}`);
      console.log(`  Steps: ${plan.steps.map(s => s.action).join(' → ')}`);
      console.log(`  Requires tools: ${plan.requiresTools}`);
      console.log(`  Response format: ${plan.responseGuidance.format}, tone: ${plan.responseGuidance.tone}`);

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
    state.metadata.plan = {
      requiresTools: false,
      steps:         ['generate_response'],
      fullPlan:      null,
    };

    return { state, next: 'executor' };
  }

  /**
   * Build context from conversation history for planning
   */
  private buildConversationContext(state: ThreadState): string {
    const recentMessages = state.messages.slice(-6); // Last 6 messages for context
    const contextParts: string[] = [];

    if (state.metadata.memories && state.metadata.memories.length > 0) {
      contextParts.push(`Relevant memories: ${state.metadata.memories.slice(0, 3).join('; ')}`);
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
    "needsMemoryRecall": true/false,
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
      const response = await this.llmService.generate(prompt, { timeout: 15000 });

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
}
