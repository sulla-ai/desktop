// BaseNode - Abstract base class for all graph nodes
// Uses LangChain's ChatOllama for LLM interactions

import type { GraphNode, ThreadState, NodeResult } from '../types';
import { ChatOllama } from '@langchain/ollama';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

const OLLAMA_BASE = 'http://127.0.0.1:30114';

export interface LLMOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  format?: 'json' | undefined;
  timeout?: number;
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
  protected llm: ChatOllama | null = null;

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }

  abstract execute(state: ThreadState): Promise<{ state: ThreadState; next: NodeResult }>;

  async initialize(): Promise<void> {
    console.log(`[Agent:${this.name}] Initializing...`);
    await this.detectModel();
    console.log(`[Agent:${this.name}] Model: ${this.availableModel || 'none'}`);

    if (this.availableModel) {
      this.llm = new ChatOllama({
        baseUrl:     OLLAMA_BASE,
        model:       this.availableModel,
        temperature: 0.7,
      });
      console.log(`[Agent:${this.name}] ChatOllama initialized`);
    }
  }

  async destroy(): Promise<void> {
    this.llm = null;
  }

  /**
   * Detect available Ollama model
   */
  protected async detectModel(): Promise<string | null> {
    try {
      const res = await fetch(`${ OLLAMA_BASE }/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });

      if (res.ok) {
        const data = await res.json();

        if (data.models && data.models.length > 0) {
          this.availableModel = data.models[0].name;

          return this.availableModel;
        }
      }
    } catch {
      // Model detection failed
    }

    return null;
  }

  /**
   * Send a prompt to Ollama via LangChain ChatOllama
   */
  protected async prompt(prompt: string, options: LLMOptions = {}): Promise<LLMResponse | null> {
    const model = options.model || this.availableModel;

    if (!model) {
      await this.detectModel();
      if (!this.availableModel) {
        console.warn(`[Agent:${this.name}] No model available for prompt`);

        return null;
      }
    }

    console.log(`[Agent:${this.name}] Sending prompt (${prompt.length} chars) to ${model || this.availableModel}`);

    try {
      // Create or update LLM instance with options
      const llm = new ChatOllama({
        baseUrl:     OLLAMA_BASE,
        model:       model || this.availableModel!,
        temperature: options.temperature ?? 0.7,
        numPredict:  options.maxTokens,
        format:      options.format,
      });

      const response = await llm.invoke([new HumanMessage(prompt)]);

      const content = typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

      const result = {
        content,
        model:        model || this.availableModel || '',
        evalCount:    response.response_metadata?.eval_count as number | undefined,
        evalDuration: response.response_metadata?.eval_duration as number | undefined,
      };

      console.log(`[Agent:${this.name}] Response received (${result.content.length} chars, ${result.evalCount || 0} tokens)`);

      return result;
    } catch (err) {
      console.error(`[Agent:${this.name}] Prompt failed:`, err);

      return null;
    }
  }

  /**
   * Send a prompt and parse JSON response
   */
  protected async promptJSON<T = unknown>(prompt: string, options: LLMOptions = {}): Promise<T | null> {
    const response = await this.prompt(prompt, { ...options, format: 'json' });

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
