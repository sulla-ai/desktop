// OllamaService - Centralized Ollama API client
// Handles all Ollama operations with consistent error handling
// Implements ILLMService for interchangeable use with RemoteModelService

import { getOllamaModel, getOllamaBase, getLocalConfig } from './ConfigService';
import type { ILLMService, ChatMessage } from './ILLMService';

interface GenerateResponse {
  response: string;
  model: string;
  done: boolean;
  total_duration?: number;
  eval_count?: number;
}

interface ChatResponse {
  message: ChatMessage;
  model: string;
  done: boolean;
  total_duration?: number;
  eval_count?: number;
}

interface ModelInfo {
  name: string;
  size: number;
  digest: string;
  modified_at: string;
}

function combineSignals(timeoutMs: number, external?: AbortSignal): AbortSignal {
  // If there is no external signal, keep existing timeout behavior.
  if (!external) {
    return AbortSignal.timeout(timeoutMs);
  }

  // Prefer native AbortSignal.any when available.
  const anyFn = (AbortSignal as any).any as ((signals: AbortSignal[]) => AbortSignal) | undefined;
  if (typeof anyFn === 'function') {
    return anyFn([AbortSignal.timeout(timeoutMs), external]);
  }

  // Fallback: manually compose.
  const controller = new AbortController();
  const onAbort = () => {
    try {
      controller.abort();
    } catch {
      // ignore
    }
  };

  const timer = setTimeout(onAbort, timeoutMs);
  external.addEventListener('abort', onAbort, { once: true });

  controller.signal.addEventListener('abort', () => {
    clearTimeout(timer);
  }, { once: true });

  return controller.signal;
}

class OllamaServiceClass implements ILLMService {
  private available = false;
  private initialized = false;
  private availableModels: string[] = [];

  /**
   * Get the base URL for Ollama API
   */
  getBaseUrl(): string {
    return getOllamaBase();
  }

  /**
   * Get the configured model name
   */
  getModel(): string {
    return getOllamaModel();
  }

  /**
   * Initialize and check Ollama availability
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) {
      return this.available;
    }

    try {
      const res = await fetch(`${this.getBaseUrl()}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });

      if (res.ok) {
        const data = await res.json();

        this.availableModels = data.models?.map((m: ModelInfo) => m.name) || [];
        this.available = true;
        console.log(`[OllamaService] Initialized with ${this.availableModels.length} models`);
      } else {
        this.available = false;
      }
    } catch (err) {
      console.warn('[OllamaService] Init failed:', err);
      this.available = false;
    }

    this.initialized = true;

    return this.available;
  }

  /**
   * Check if Ollama is available
   */
  isAvailable(): boolean {
    return this.available;
  }

  /**
   * Get list of available models
   */
  getAvailableModels(): string[] {
    return this.availableModels;
  }

  /**
   * Check if a specific model is available
   */
  hasModel(modelName: string): boolean {
    return this.availableModels.includes(modelName);
  }

  /**
   * Refresh the list of available models
   */
  async refreshModels(): Promise<string[]> {
    try {
      const res = await fetch(`${this.getBaseUrl()}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });

      if (res.ok) {
        const data = await res.json();

        this.availableModels = data.models?.map((m: ModelInfo) => m.name) || [];
        this.available = true;
      }
    } catch {
      // Keep existing list
    }

    return this.availableModels;
  }

  /**
   * Generate a completion (non-chat)
   */
  async generate(prompt: string, options?: { signal?: AbortSignal }): Promise<string | null> {
    return this.generateWithModel(prompt, this.getModel(), options);
  }

  /**
   * Generate a completion with a specific model
   */
  async generateWithModel(prompt: string, modelName: string, options?: { signal?: AbortSignal }): Promise<string | null> {
    try {
      const body: Record<string, unknown> = {
        model:  modelName,
        prompt,
        stream: false,
      };

      const { timeoutSeconds } = getLocalConfig();
      const res = await fetch(`${this.getBaseUrl()}/api/generate`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
        signal:  combineSignals(timeoutSeconds * 1000, options?.signal),
      });

      if (res.ok) {
        const data: GenerateResponse = await res.json();

        return data.response?.trim() || null;
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw err;
      }
      console.warn('[OllamaService] Generate failed:', err);
    }

    return null;
  }

  async chatWithModel(messages: ChatMessage[], modelName: string, options?: { signal?: AbortSignal }): Promise<string | null> {
    try {
      const body: Record<string, unknown> = {
        model: modelName,
        messages,
        stream: false,
      };

      const { timeoutSeconds } = getLocalConfig();
      const res = await fetch(`${this.getBaseUrl()}/api/chat`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
        signal:  combineSignals(timeoutSeconds * 1000, options?.signal),
      });

      if (res.ok) {
        const data: ChatResponse = await res.json();
        return data.message?.content?.trim() || null;
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw err;
      }
      console.warn('[OllamaService] Chat (model override) failed:', err);
    }

    return null;
  }

  /**
   * Chat completion
   */
  async chat(messages: ChatMessage[], options?: { signal?: AbortSignal }): Promise<string | null> {
    try {
      const body: Record<string, unknown> = {
        model: this.getModel(),
        messages,
        stream: false,
      };

      const { timeoutSeconds } = getLocalConfig();
      const res = await fetch(`${this.getBaseUrl()}/api/chat`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
        signal:  combineSignals(timeoutSeconds * 1000, options?.signal),
      });

      if (res.ok) {
        const data: ChatResponse = await res.json();

        return data.message?.content?.trim() || null;
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw err;
      }
      console.warn('[OllamaService] Chat failed:', err);
    }

    return null;
  }

  /**
   * Generate and parse JSON response
   */
  async generateJSON<T>(prompt: string, options?: { signal?: AbortSignal }): Promise<T | null> {
    const response = await this.generate(prompt, options);

    if (!response) {
      return null;
    }

    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as T;
      }
    } catch {
      console.warn('[OllamaService] JSON parse failed');
    }

    return null;
  }

  /**
   * Pull a model
   */
  async pullModel(modelName: string, onProgress?: (status: string) => void): Promise<boolean> {
    try {
      console.log(`[OllamaService] Pulling model: ${modelName}`);

      const res = await fetch(`${this.getBaseUrl()}/api/pull`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: modelName, stream: false }),
        signal:  AbortSignal.timeout(600000), // 10 minutes
      });

      if (res.ok) {
        console.log(`[OllamaService] Model ${modelName} pulled successfully`);
        await this.refreshModels();

        return true;
      }

      console.warn(`[OllamaService] Failed to pull model ${modelName}: ${res.status}`);
    } catch (err) {
      console.warn(`[OllamaService] Error pulling model ${modelName}:`, err);
    }

    return false;
  }

  /**
   * Check if Ollama is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.getBaseUrl()}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });

      this.available = res.ok;

      return res.ok;
    } catch {
      this.available = false;

      return false;
    }
  }
}

// Singleton instance
let instance: OllamaServiceClass | null = null;

export function getOllamaService(): OllamaServiceClass {
  if (!instance) {
    instance = new OllamaServiceClass();
  }

  return instance;
}

export { OllamaServiceClass };
