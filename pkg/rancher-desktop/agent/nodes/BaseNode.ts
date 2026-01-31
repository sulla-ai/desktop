// BaseNode - Abstract base class for all graph nodes
// Uses LLMServiceFactory for LLM interactions (supports both local Ollama and remote APIs)

import type { GraphNode, ThreadState, NodeResult } from '../types';
import type { ILLMService } from '../services/ILLMService';
import { getLLMService, getCurrentMode } from '../services/LLMServiceFactory';
import { getOllamaService } from '../services/OllamaService';
import { getAwarenessService } from '../services/AwarenessService';

// Import soul.md via raw-loader (configured in vue.config.mjs)
// @ts-ignore - raw-loader import
import soulPromptRaw from '../prompts/soul.md';

function getSoulPrompt(): string {
  // raw-loader may return { default: string } or string depending on config
  const content = typeof soulPromptRaw === 'string' ? soulPromptRaw : soulPromptRaw.default;
  return (content || '').trim();
}

export interface LLMOptions {
  model?: string;
  maxTokens?: number;
  format?: 'json' | undefined;
}

export interface LLMResponse {
  content: string;
  model: string;
  evalCount?: number;
  evalDuration?: number;
}

export abstract class BaseNode implements GraphNode {
  id: string;
  name: string;
  protected availableModel: string | null = null;
  protected llmService: ILLMService | null = null;

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }

  abstract execute(state: ThreadState): Promise<{ state: ThreadState; next: NodeResult }>;

  async initialize(): Promise<void> {
    console.log(`[Agent:${this.name}] Initializing...`);

    // Get the appropriate LLM service (local or remote)
    this.llmService = getLLMService();
    await this.llmService.initialize();

    this.availableModel = this.llmService.getModel();
    const mode = getCurrentMode();

    console.log(`[Agent:${this.name}] Mode: ${mode}, Model: ${this.availableModel || 'none'}`);
  }

  async destroy(): Promise<void> {
    this.llmService = null;
  }

  /**
   * Pull a model from Ollama (only works for local mode)
   */
  protected async pullModel(modelName: string): Promise<boolean> {
    if (getCurrentMode() !== 'local') {
      console.warn(`[Agent:${this.name}] Cannot pull model in remote mode`);

      return false;
    }

    const ollama = getOllamaService();

    return ollama.pullModel(modelName);
  }

  /**
   * Send a prompt to the LLM (works for both local and remote)
   * Falls back to local Ollama if remote service is unavailable
   */
  protected async prompt(prompt: string): Promise<LLMResponse | null> {
    if (!this.llmService) {
      this.llmService = getLLMService();
      await this.llmService.initialize();
      this.availableModel = this.llmService.getModel();
    }

    // If primary service is not available, try fallback to Ollama
    if (!this.llmService.isAvailable()) {
      console.warn(`[Agent:${this.name}] Primary LLM service not available, attempting fallback to Ollama`);
      
      try {
        const ollama = getOllamaService();
        await ollama.initialize();
        
        if (ollama.isAvailable()) {
          console.log(`[Agent:${this.name}] Falling back to local Ollama`);
          this.llmService = ollama;
          this.availableModel = ollama.getModel();
        } else {
          console.error(`[Agent:${this.name}] Ollama fallback also not available`);
          return null;
        }
      } catch (err) {
        console.error(`[Agent:${this.name}] Fallback to Ollama failed:`, err);
        return null;
      }
    }

    const model = this.availableModel || this.llmService.getModel();

    // Prepend soul prompt to every LLM request
    const soulPrompt = getSoulPrompt();
    const fullPrompt = `${soulPrompt}\n\n---\n\n${prompt}`;

    console.log(`[Agent:${this.name}] LLM prompt`, {
      node:   this.name,
      model,
      soulLength: soulPrompt.length,
      promptLength: prompt.length,
      totalLength: fullPrompt.length,
    });

    try {
      const content = await this.llmService.generate(fullPrompt);

      if (!content) {
        console.warn(`[Agent:${this.name}] No response from LLM`);

        return null;
      }

      const result = {
        content,
        model,
      };

      console.log(`[Agent:${this.name}] Response received (${result.content.length} chars)`);

      return result;
    } catch (err) {
      console.error(`[Agent:${this.name}] Prompt failed:`, err);

      return null;
    }
  }

  /**
   * Send a prompt and parse JSON response
   */
  protected async promptJSON<T = unknown>(prompt: string): Promise<T | null> {
    const response = await this.prompt(prompt);

    if (!response) {
      return null;
    }

    try {
      return JSON.parse(response.content) as T;
    } catch {
      return null;
    }
  }

  /**
   * Build a prompt with context from thread state
   */
  protected buildContextualPrompt(
    instruction: string,
    state: ThreadState,
    options: { includeMemory?: boolean; includeHistory?: boolean; maxHistoryItems?: number } = {},
  ): string {
    const parts: string[] = [];

    parts.push(getAwarenessService().identityPrompt);
    parts.push('');

    const historyForLog: Array<{ role: string; content: string }> = [];
    if (options.includeHistory && state.shortTermMemory.length > 0) {
      const maxItems = options.maxHistoryItems || 6;
      historyForLog.push(...state.shortTermMemory.slice(-maxItems));
    }

    // Add memory context if available and requested
    if (options.includeMemory && state.metadata.memoryContext) {
      parts.push('Relevant context from memory:');
      parts.push(state.metadata.memoryContext as string);
      parts.push('');
    }

    // Add conversation history if requested
    // Use full messages array for better continuity, fall back to shortTermMemory
    // Filter out system messages to avoid confusing the LLM with prior prompt context
    if (options.includeHistory) {
      const maxItems = options.maxHistoryItems || 10;
      const historySource = state.messages.length > 0 ? state.messages : state.shortTermMemory;
      const userAssistantMessages = historySource.filter(m => m.role === 'user' || m.role === 'assistant');

      if (userAssistantMessages.length > 0) {
        parts.push('Conversation history:');
        userAssistantMessages.slice(-maxItems).forEach(m => {
          parts.push(`${ m.role === 'user' ? 'User' : 'Assistant' }: ${ m.content }`);
        });
        parts.push('');
      }
    }

    // Add the main instruction
    parts.push(instruction);

    const finalPrompt = parts.join('\n');

    console.log(`[Agent:${this.name}] Contextual prompt`, {
      node: this.name,
      instruction,
      includeMemory:  !!options.includeMemory,
      includeHistory: !!options.includeHistory,
      memoryContext:  options.includeMemory ? state.metadata.memoryContext : undefined,
      history:        historyForLog.length > 0 ? historyForLog : undefined,
      prompt:         finalPrompt,
      length:         finalPrompt.length,
    });

    return finalPrompt;
  }
}
