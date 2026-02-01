// ContextDetector - Fast heuristic/LLM for thread selection
// Prefrontal analog: classifies topic, matches to existing thread or creates new
// Integrates with MemoryPedia for semantic search of past conversations

import type { SensoryInput, ThreadContext, Message } from './types';
import { getMemoryPedia } from './services/MemoryPedia';
import { getLLMService } from './services/LLMServiceFactory';
import { getAwarenessService } from './services/AwarenessService';
import { getPlanService } from './services/PlanService';
import { getPersistenceService } from './services/PersistenceService';

interface TopicAnalysis {
  newtopic: boolean;
  oldtopic: boolean;
  searchTerms?: string[];
}

export class ContextDetector {
  private initialized = false;

  /**
   * Initialize by loading existing thread summaries from MemoryPedia
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log('[ContextDetector] Initializing...');
    this.initialized = true;
  }

  /**
   * Detect context from sensory input
   * Returns thread ID (existing or new) + summary
   */
  async detect(input: SensoryInput, currentThreadId?: string): Promise<ThreadContext> {
    // Ensure initialized
    if (!this.initialized) {
      await this.initialize();
    }

    const text = input.data;

    console.log(`[ContextDetector] detect(): currentThreadId=${currentThreadId || 'none'}`);

    let effectiveThreadId: string | undefined = currentThreadId;
    let planPinned = false;

    try {
      const awareness = getAwarenessService();
      await awareness.initialize();
      const activePlanIds = awareness.getData().active_plan_ids || [];
      const activePlanId = activePlanIds[0] && Number.isFinite(Number(activePlanIds[0])) ? Number(activePlanIds[0]) : null;

      if (activePlanId && currentThreadId) {
        const planService = getPlanService();
        await planService.initialize();
        const loaded = await planService.getPlan(activePlanId);

        if (loaded?.plan?.status === 'active' && loaded.plan.threadId) {
          effectiveThreadId = loaded.plan.threadId;
          planPinned = true;
        }
      }
    } catch {
      // If plan pinning fails, fall back to normal detection.
    }

    console.log(
      `[ContextDetector] effectiveThreadId=${effectiveThreadId || 'none'} planPinned=${planPinned}`,
    );

    // If we have an effective thread (current or pinned), load recent messages and use LLM to detect topic changes
    if (effectiveThreadId) {
      const messages = await this.loadRecentMessages(effectiveThreadId, 20);
      console.log(`[ContextDetector] Loaded ${messages.length} recent messages for topic analysis`);

      if (!messages.length) {
        return {
          threadId:   effectiveThreadId,
          isNew:      false,
          summary:    '',
          confidence: 1.0,
        };
      }

      console.log('[ContextDetector] Invoking LLM topic analysis');
      const topicAnalysis = await this.analyzeTopicChange(text, messages);

      if (topicAnalysis.newtopic) {
        console.log('[ContextDetector] LLM detected new topic - creating fresh thread');
        const newContext = await this.createNewThread(text);
        newContext.clearMessages = true;
        return newContext;
      }

      if (topicAnalysis.oldtopic && topicAnalysis.searchTerms && topicAnalysis.searchTerms.length > 0) {
        console.log(`[ContextDetector] LLM detected old topic - searching with terms: ${topicAnalysis.searchTerms.join(', ')}`);
        const oldThread = await this.findOldTopicThread(topicAnalysis.searchTerms);
        if (oldThread) {
          console.log(`[ContextDetector] Found old topic thread: ${oldThread.threadId}`);
          oldThread.clearMessages = true;
          return oldThread;
        }
        // If no old thread found, create new one
        console.log('[ContextDetector] Old topic indicated but no matching thread found - creating new thread');
        const newContext = await this.createNewThread(text);
        newContext.clearMessages = true;
        return newContext;
      }

      // Neither newtopic nor oldtopic - keep effective thread
      return {
        threadId:   effectiveThreadId,
        isNew:      false,
        summary:    '',
        confidence: 1.0,
      };
    }

    // No current thread; create a new one.
    console.log('[ContextDetector] No thread, creating new thread');
    return this.createNewThread(text);
  }

  private async loadRecentMessages(threadId: string, limit: number): Promise<Message[]> {
    try {
      const persistence = getPersistenceService();
      await persistence.initialize();

      const saved = await persistence.loadConversation(threadId);
      if (!saved || saved.length === 0) {
        return [];
      }

      const now = Date.now();
      const recent = saved.slice(-limit);
      return recent
        .filter(m => m.role === 'user' || m.role === 'assistant' || m.role === 'system')
        .map((m, i) => ({
          id:        `msg_ctx_${threadId}_${i}`,
          role:      m.role as 'user' | 'assistant' | 'system',
          content:   m.content,
          timestamp: now,
        }));
    } catch (err) {
      console.warn('[ContextDetector] Failed to load recent messages:', err);
      return [];
    }
  }

  /**
   * Use LLM to analyze if the user's message indicates a topic change
   */
  private async analyzeTopicChange(userMessage: string, messages: Message[]): Promise<TopicAnalysis> {
    try {
      const llm = getLLMService();

      // Format recent conversation history
      const recentMessages = messages.slice(-10).map(m => `${m.role}: ${m.content}`).join('\n');

      const prompt = `Analyze the following conversation and the user's latest message.

CONVERSATION HISTORY:
${recentMessages}

USER'S LATEST MESSAGE:
${userMessage}

Determine:
1. Is the latest message a CLEAR indication that the user is changing topics to something that could NOT possibly be part of the existing conversation? (newtopic)
2. Is the latest message a change of topic AND does the user indicate there was a PREVIOUS conversation on this new topic in the past? (oldtopic)

If oldtopic is true, provide 2-3 search terms to find the old conversation.

Respond with ONLY valid JSON:
{
  "newtopic": true/false,
  "oldtopic": true/false,
  "searchTerms": ["term1", "term2"] // only if oldtopic is true
}`;

      console.log(`[ContextDetector] Topic analysis prompt:\n${prompt}`);

      const response = await llm.generate(prompt);

      console.log(`[ContextDetector] Topic analysis raw response:\n${response || ''}`);

      if (response) {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]) as TopicAnalysis;
          console.log(`[ContextDetector] Topic analysis: newtopic=${parsed.newtopic}, oldtopic=${parsed.oldtopic}`);
          return parsed;
        }
      }
    } catch (err) {
      console.warn('[ContextDetector] Topic analysis failed:', err);
    }

    // Default: no topic change
    return { newtopic: false, oldtopic: false };
  }

  /**
   * Search for an old topic thread using provided search terms
   */
  private async findOldTopicThread(searchTerms: string[]): Promise<ThreadContext | null> {
    try {
      const memoryPedia = getMemoryPedia();

      await memoryPedia.initialize();

      // Search with each term and collect results
      for (const term of searchTerms) {
        const summaries = await memoryPedia.searchSummaries(term, 5);

        if (summaries.length > 0) {
          const best = summaries[0];
          const confidence = 1 - Math.min(best.score, 1);

          if (confidence >= 0.5) { // Lower threshold for old topic search
            return {
              threadId:   best.threadId,
              isNew:      false,
              summary:    best.summary,
              confidence,
            };
          }
        }
      }

      // Try combined search
      const combinedQuery = searchTerms.join(' ');
      const summaries = await memoryPedia.searchSummaries(combinedQuery, 3);

      if (summaries.length > 0) {
        const best = summaries[0];
        const confidence = 1 - Math.min(best.score, 1);

        if (confidence >= 0.4) {
          return {
            threadId:   best.threadId,
            isNew:      false,
            summary:    best.summary,
            confidence,
          };
        }
      }
    } catch (err) {
      console.warn('[ContextDetector] Old topic search failed:', err);
    }

    return null;
  }

  /**
   * Create a new thread context
   */
  private async createNewThread(text: string): Promise<ThreadContext> {
    const threadId = `thread_${ Date.now() }`;
    const summary = await this.generateSummary(text);

    return {
      threadId,
      isNew:      true,
      summary,
      confidence: 1.0,
    };
  }

  /**
   * Generate a brief summary of the input
   * Uses LLM for better summaries, falls back to truncation
   */
  private async generateSummary(text: string): Promise<string> {
    try {
      const llm = getLLMService();
      const response = await llm.generate(
        `Summarize this in 5 words or less: "${ text.substring(0, 200) }"`,
      );

      if (response) {
        return response.trim() || text.substring(0, 50);
      }
    } catch {
      // Fall back to simple truncation
    }

    return text.substring(0, 50) + (text.length > 50 ? '...' : '');
  }
}

// Singleton instance
let detectorInstance: ContextDetector | null = null;

export function getContextDetector(): ContextDetector {
  if (!detectorInstance) {
    detectorInstance = new ContextDetector();
  }

  return detectorInstance;
}
