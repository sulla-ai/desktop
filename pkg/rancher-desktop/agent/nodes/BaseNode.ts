// BaseNode - Abstract base class for all graph nodes
// Uses LLMServiceFactory for LLM interactions (supports both local Ollama and remote APIs)

import type { GraphNode, ThreadState, NodeResult } from '../types';
import type { ILLMService } from '../services/ILLMService';
import { getLLMService, getCurrentMode } from '../services/LLMServiceFactory';
import { getOllamaService } from '../services/OllamaService';

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
   */
  protected async prompt(prompt: string): Promise<LLMResponse | null> {
    if (!this.llmService) {
      this.llmService = getLLMService();
      await this.llmService.initialize();
      this.availableModel = this.llmService.getModel();
    }

    if (!this.llmService.isAvailable()) {
      console.warn(`[Agent:${this.name}] LLM service not available`);

      return null;
    }

    const model = this.availableModel || this.llmService.getModel();

    console.log(`[Agent:${this.name}] Sending prompt (${prompt.length} chars) to ${model}`);

    try {
      const content = await this.llmService.generate(prompt);

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

    // Add memory context if available and requested
    if (options.includeMemory && state.metadata.memoryContext) {
      parts.push('Relevant context from memory:');
      parts.push(state.metadata.memoryContext as string);
      parts.push('');
    }

    // Add conversation history if requested
    if (options.includeHistory && state.shortTermMemory.length > 0) {
      const maxItems = options.maxHistoryItems || 6;

      parts.push('Recent conversation:');
      state.shortTermMemory.slice(-maxItems).forEach(m => {
        parts.push(`${ m.role === 'user' ? 'User' : 'Assistant' }: ${ m.content }`);
      });
      parts.push('');
    }

    // Add the main instruction
    parts.push(instruction);

    return parts.join('\n');
  }
}
