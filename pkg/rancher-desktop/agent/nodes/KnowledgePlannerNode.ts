// KnowledgePlannerNode - Plans goals/steps for generating a KnowledgeBase page
// Loads messages by threadId if not provided, then uses LLM to plan the page outline

import type { ThreadState, NodeResult } from '../types';
import { BaseNode, JSON_ONLY_RESPONSE_INSTRUCTIONS } from './BaseNode';
import { getPersistenceService } from '../services/PersistenceService';
import type { KnowledgeGoal } from '../services/KnowledgeState';
import { getLLMService } from '../services/LLMServiceFactory';

interface PlannerLLMResponse {
  slug: string;
  title: string;
  goals: Array<{
    id: string;
    title: string;
    description: string;
  }>;
}

export class KnowledgePlannerNode extends BaseNode {
  constructor() {
    super('knowledge_planner', 'Knowledge Planner');
  }

  async execute(state: ThreadState): Promise<{ state: ThreadState; next: NodeResult }> {
    console.log(`[KnowledgePlannerNode] Executing for thread: ${state.threadId}`);

    // Load messages if not already present
    let messages = state.messages;
    if (!messages || messages.length === 0) {
      const persistence = getPersistenceService();
      await persistence.initialize();
      const loaded = await persistence.loadConversation(state.threadId);
      if (loaded && loaded.length > 0) {
        messages = loaded.map((m, i) => ({
          id: `msg_loaded_${i}`,
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
          timestamp: Date.now(),
        }));
        state.messages = messages;
      }
    }

    if (!messages || messages.length === 0) {
      (state.metadata as any).knowledgePlannerError = 'No messages found for thread';
      return { state, next: 'end' };
    }

    // Build conversation text for LLM
    const conversationText = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n')
      .substring(0, 8000);

    const prompt = `You are planning a KnowledgeBase article based on this conversation.

Conversation:
${conversationText}

Analyze the conversation and plan the article structure.

${JSON_ONLY_RESPONSE_INSTRUCTIONS}
{
  "slug": "kebab-case-url-slug",
  "title": "Article Title",
  "goals": [
    {
      "id": "goal_1",
      "title": "Section title",
      "description": "What this section should cover"
    }
  ]
}

Rules:
- slug must be lowercase kebab-case, max 60 chars
- title should be clear and descriptive
- goals are the sections/steps needed to create a complete article
- Include 3-6 goals covering: introduction, main content sections, conclusion/validation
- Each goal becomes a section in the final article`;

    try {
      const response = await this.promptLLM(state, prompt);
      if (!response) {
        (state.metadata as any).knowledgePlannerError = 'LLM returned empty response';
        return { state, next: 'end' };
      }

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        (state.metadata as any).knowledgePlannerError = 'Failed to parse LLM response as JSON';
        return { state, next: 'end' };
      }

      const parsed: PlannerLLMResponse = JSON.parse(jsonMatch[0]);

      const goals: KnowledgeGoal[] = (parsed.goals || []).map(g => ({
        id: g.id || `goal_${Math.random().toString(36).substring(2, 8)}`,
        title: g.title,
        description: g.description,
        status: 'pending' as const,
      }));

      (state.metadata as any).knowledgeGoals = goals;
      (state.metadata as any).knowledgePlannedSlug = parsed.slug;
      (state.metadata as any).knowledgePlannedTitle = parsed.title;

      console.log(`[KnowledgePlannerNode] Planned ${goals.length} goals for: ${parsed.title}`);

      return { state, next: 'continue' };
    } catch (err) {
      (state.metadata as any).knowledgePlannerError = err instanceof Error ? err.message : String(err);
      return { state, next: 'end' };
    }
  }

  private async promptLLM(state: ThreadState, prompt: string): Promise<string | null> {
    try {
      const enriched = await this.enrichPrompt(prompt, state, {
        includeSoul: false,
        includeAwareness: false,
        includeMemory: false,
      });

      const llm = getLLMService();
      await llm.initialize();
      if (!llm.isAvailable()) {
        return null;
      }

      return await llm.generate(enriched);
    } catch {
      return null;
    }
  }
}
