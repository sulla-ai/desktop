// RemoteModelService - Handles remote LLM API calls (Grok, OpenAI, Anthropic, Google)
// Implements ILLMService for interchangeable use with OllamaService

import type { ILLMService, ChatMessage, RemoteProviderConfig } from './ILLMService';

function combineSignals(timeoutMs: number, external?: AbortSignal): AbortSignal {
  if (!external) {
    return AbortSignal.timeout(timeoutMs);
  }

  const anyFn = (AbortSignal as any).any as ((signals: AbortSignal[]) => AbortSignal) | undefined;
  if (typeof anyFn === 'function') {
    return anyFn([AbortSignal.timeout(timeoutMs), external]);
  }

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
  controller.signal.addEventListener('abort', () => clearTimeout(timer), { once: true });
  return controller.signal;
}

// Provider-specific API configurations
const PROVIDER_CONFIGS: Record<string, { baseUrl: string; chatEndpoint: string; authHeader: string }> = {
  grok: {
    baseUrl:      'https://api.x.ai/v1',
    chatEndpoint: '/chat/completions',
    authHeader:   'Bearer',
  },
  openai: {
    baseUrl:      'https://api.openai.com/v1',
    chatEndpoint: '/chat/completions',
    authHeader:   'Bearer',
  },
  anthropic: {
    baseUrl:      'https://api.anthropic.com/v1',
    chatEndpoint: '/messages',
    authHeader:   'x-api-key',
  },
  google: {
    baseUrl:      'https://generativelanguage.googleapis.com/v1beta',
    chatEndpoint: '/models/{model}:generateContent',
    authHeader:   'Bearer',
  },
  kimi: {
    baseUrl:      'https://api.moonshot.cn/v1',
    chatEndpoint: '/chat/completions',
    authHeader:   'Bearer',
  },
  nvidia: {
    baseUrl:      'https://integrate.api.nvidia.com/v1',
    chatEndpoint: '/chat/completions',
    authHeader:   'Bearer',
  },
};

class RemoteModelServiceClass implements ILLMService {
  private config: RemoteProviderConfig | null = null;
  private available = false;
  private initialized = false;
  private retryCount = 3; // Default retry count before fallback
  private defaultTimeoutMs = 60000;

  /**
   * Configure the service with provider details
   */
  configure(config: RemoteProviderConfig): void {
    this.config = config;
    this.initialized = false;
    this.available = false;
  }

  /**
   * Set the retry count for API calls before falling back to local LLM
   */
  setRetryCount(count: number): void {
    this.retryCount = Math.max(0, Math.min(10, count)); // Clamp between 0-10
    console.log(`[RemoteModelService] Retry count set to: ${this.retryCount}`);
  }

  /**
   * Get current retry count
   */
  getRetryCount(): number {
    return this.retryCount;
  }

  setDefaultTimeoutMs(timeoutMs: number): void {
    this.defaultTimeoutMs = Math.max(1000, Math.min(300000, timeoutMs));
    console.log(`[RemoteModelService] Default timeout set to: ${this.defaultTimeoutMs}ms`);
  }

  getDefaultTimeoutMs(): number {
    return this.defaultTimeoutMs;
  }

  /**
   * Get provider config
   */
  private getProviderConfig() {
    if (!this.config) {
      return null;
    }

    return PROVIDER_CONFIGS[this.config.id] || PROVIDER_CONFIGS.openai;
  }

  /**
   * Initialize and validate API key
   */
  async initialize(): Promise<boolean> {
    if (!this.config || !this.config.apiKey) {
      console.warn('[RemoteModelService] No config or API key set');
      this.available = false;
      this.initialized = true;

      return false;
    }

    // For now, just mark as available if we have an API key
    // A real validation would make a test API call
    this.available = true;
    this.initialized = true;
    console.log(`[RemoteModelService] Initialized with ${this.config.id}/${this.config.model}`);

    return true;
  }

  isAvailable(): boolean {
    return this.available;
  }

  getModel(): string {
    return this.config?.model || 'unknown';
  }

  /**
   * Generate completion (converts to chat format for API compatibility)
   */
  async generate(prompt: string, options?: { signal?: AbortSignal }): Promise<string | null> {
    const messages: ChatMessage[] = [];
    messages.push({ role: 'user', content: prompt });

    return this.chat(messages, options);
  }

  /**
   * Generate completion with a specific provider and model override
   * Used for heartbeat model override
   */
  async generateWithModel(
    prompt: string,
    providerId: string,
    modelName: string,
    options?: { signal?: AbortSignal },
  ): Promise<string | null> {
    if (!this.config?.apiKey) {
      console.warn('[RemoteModelService] No API key configured for model override');
      return null;
    }

    const providerConfig = PROVIDER_CONFIGS[providerId] || PROVIDER_CONFIGS.openai;
    const messages: ChatMessage[] = [{ role: 'user', content: prompt }];
    const timeout = this.defaultTimeoutMs;

    try {
      // Use OpenAI-compatible endpoint for most providers
      const url = `${providerConfig.baseUrl}${providerConfig.chatEndpoint}`;
      
      const body: Record<string, unknown> = {
        model:    modelName,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      };

      const res = await fetch(url, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body:   JSON.stringify(body),
        signal: combineSignals(timeout, options?.signal),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error(`[RemoteModelService] API error with model override: ${res.status}`, errorText);
        return null;
      }

      const data = await res.json();
      return data.choices?.[0]?.message?.content?.trim() || null;
    } catch (err) {
      console.error('[RemoteModelService] generateWithModel failed:', err);
      return null;
    }
  }

  /**
   * Check if an error is retryable (network errors, rate limiting)
   * Note: 503 errors should NOT be retried - they indicate service unavailability
   * and should fall back to local immediately
   */
  private isRetryableError(err: unknown): boolean {
    if (err instanceof TypeError && err.message === 'Failed to fetch') {
      return true;
    }
    if (err instanceof Error) {
      const msg = err.message.toLowerCase();

      // Network errors
      if (msg.includes('network') ||
          msg.includes('internet') ||
          msg.includes('disconnected') ||
          msg.includes('failed to fetch') ||
          msg.includes('timeout') ||
          msg.includes('aborted')) {
        return true;
      }
      
      // Rate limiting is retryable
      if (msg.includes('429') || msg.includes('rate limit')) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if an error should trigger immediate fallback (no retry)
   * 503 Service Unavailable means the service is at capacity - don't waste time retrying
   */
  private shouldImmediateFallback(err: unknown): boolean {
    if (err instanceof Error) {
      const msg = err.message.toLowerCase();

      // 503 Service Unavailable - immediate fallback, no retry
      if (msg.includes('503') || msg.includes('service unavailable') || msg.includes('at capacity')) {
        return true;
      }
    }

    return false;
  }
  
  /**
   * Check if an error is a network error specifically (for fallback decision)
   */
  private isNetworkError(err: unknown): boolean {
    if (err instanceof TypeError && err.message === 'Failed to fetch') {
      return true;
    }
    if (err instanceof Error) {
      const msg = err.message.toLowerCase();

      return msg.includes('network') ||
             msg.includes('internet') ||
             msg.includes('disconnected') ||
             msg.includes('failed to fetch');
    }

    return false;
  }

  /**
   * Chat completion - main method
   * Retries on failure, then falls back to local Ollama
   */
  async chat(messages: ChatMessage[], options?: { signal?: AbortSignal }): Promise<string | null> {
    if (!this.config || !this.config.apiKey) {
      console.warn('[RemoteModelService] Not configured');

      return null;
    }

    const providerConfig = this.getProviderConfig();

    if (!providerConfig) {
      return null;
    }

    const timeout = this.defaultTimeoutMs;
    let lastError: unknown = null;

    // Retry loop
    for (let attempt = 0; attempt <= this.retryCount; attempt++) {
      try {
        if (options?.signal?.aborted) {
          const err = new Error('Aborted');
          (err as any).name = 'AbortError';
          throw err;
        }
        if (attempt > 0) {
          console.log(`[RemoteModelService] Retry attempt ${attempt}/${this.retryCount}`);
          // Exponential backoff: 1s, 2s, 4s, etc.
          const backoffMs = Math.pow(2, attempt - 1) * 1000;
          await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(() => resolve(), backoffMs);
            if (options?.signal) {
              options.signal.addEventListener('abort', () => {
                clearTimeout(timer);
                const err = new Error('Aborted');
                (err as any).name = 'AbortError';
                reject(err);
              }, { once: true });
            }
          });
        }

        // Route to provider-specific handler
        switch (this.config.id) {
          case 'anthropic':
            return await this.chatAnthropic(messages, timeout, options?.signal);
          case 'google':
            return await this.chatGoogle(messages, timeout, options?.signal);
          default:
            // OpenAI-compatible (Grok, OpenAI)
            return await this.chatOpenAI(messages, timeout, options?.signal);
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          throw err;
        }
        lastError = err;
        console.error(`[RemoteModelService] Chat failed (attempt ${attempt + 1}/${this.retryCount + 1}):`, err);

        // 503 errors should immediately fallback without retry
        if (this.shouldImmediateFallback(err)) {
          console.warn(`[RemoteModelService] Service unavailable (503), immediately falling back to local Ollama`);
          break;
        }

        // Only retry on retryable errors (network, rate limiting)
        if (!this.isRetryableError(err)) {
          console.warn(`[RemoteModelService] Non-retryable error, not retrying`);
          break; // Don't retry on non-retryable errors (e.g., auth errors)
        }
      }
    }

    // Fall back to local Ollama for retryable errors or immediate fallback errors
    if (this.isRetryableError(lastError) || this.shouldImmediateFallback(lastError)) {
      console.warn(`[RemoteModelService] Falling back to local Ollama`);
      try {
        const { getOllamaService } = await import('./OllamaService');
        const ollama = getOllamaService();

        await ollama.initialize();
        if (ollama.isAvailable()) {
          return await ollama.chat(messages, { signal: options?.signal });
        }
      } catch (fallbackErr) {
        console.error('[RemoteModelService] Fallback to Ollama also failed:', fallbackErr);
      }
    }

    return null;
  }

  /**
   * OpenAI-compatible chat (works for Grok, OpenAI)
   */
  private async chatOpenAI(
    messages: ChatMessage[],
    timeout = 60000,
    signal?: AbortSignal,
  ): Promise<string | null> {
    const providerConfig = this.getProviderConfig()!;
    const url = `${providerConfig.baseUrl}${providerConfig.chatEndpoint}`;

    const body: Record<string, unknown> = {
      model:    this.config!.model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    };

    const res = await fetch(url, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${this.config!.apiKey}`,
      },
      body:   JSON.stringify(body),
      signal: combineSignals(timeout, signal),
    });

    if (!res.ok) {
      const errorText = await res.text();

      console.error(`[RemoteModelService] OpenAI API error: ${res.status}`, errorText);

      // Throw error for server errors (5xx) so retry/fallback logic can handle them
      if (res.status >= 500 && res.status < 600) {
        throw new Error(`Server error ${res.status}: ${errorText}`);
      }

      return null;
    }

    const data = await res.json();

    return data.choices?.[0]?.message?.content?.trim() || null;
  }

  /**
   * Anthropic Claude chat
   */
  private async chatAnthropic(
    messages: ChatMessage[],
    timeout = 60000,
    signal?: AbortSignal,
  ): Promise<string | null> {
    const url = 'https://api.anthropic.com/v1/messages';

    // Anthropic requires system message separately
    const systemMessage = messages.find(m => m.role === 'system');
    const chatMessages = messages.filter(m => m.role !== 'system');

    const body: Record<string, unknown> = {
      model:      this.config!.model,
      max_tokens: 4096,
      messages:   chatMessages.map(m => ({ role: m.role, content: m.content })),
    };

    if (systemMessage) {
      body.system = systemMessage.content;
    }

    const res = await fetch(url, {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         this.config!.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body:   JSON.stringify(body),
      signal: AbortSignal.timeout(timeout),
    });

    if (!res.ok) {
      const errorText = await res.text();

      console.error(`[RemoteModelService] Anthropic API error: ${res.status}`, errorText);

      // Throw error for server errors (5xx) so retry/fallback logic can handle them
      if (res.status >= 500 && res.status < 600) {
        throw new Error(`Server error ${res.status}: ${errorText}`);
      }

      return null;
    }

    const data = await res.json();

    return data.content?.[0]?.text?.trim() || null;
  }

  /**
   * Google Gemini chat
   */
  private async chatGoogle(
    messages: ChatMessage[],
    timeout = 60000,
    signal?: AbortSignal,
  ): Promise<string | null> {
    const model = this.config!.model;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.config!.apiKey}`;

    // Convert messages to Gemini format
    const contents = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role:  m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const systemInstruction = messages.find(m => m.role === 'system');

    const body: Record<string, unknown> = { contents };

    if (systemInstruction) {
      body.systemInstruction = { parts: [{ text: systemInstruction.content }] };
    }

    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
      signal:  AbortSignal.timeout(timeout),
    });

    if (!res.ok) {
      const errorText = await res.text();

      console.error(`[RemoteModelService] Google API error: ${res.status}`, errorText);

      // Throw error for server errors (5xx) so retry/fallback logic can handle them
      if (res.status >= 500 && res.status < 600) {
        throw new Error(`Server error ${res.status}: ${errorText}`);
      }

      return null;
    }

    const data = await res.json();

    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
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
      const jsonMatch = response.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as T;
      }
    } catch {
      console.warn('[RemoteModelService] JSON parse failed');
    }

    return null;
  }

  /**
   * Health check - verify API is reachable
   */
  async healthCheck(): Promise<boolean> {
    if (!this.config || !this.config.apiKey) {
      return false;
    }

    // Simple check - just verify we have config
    // A real check would make a lightweight API call
    return true;
  }
}

// Singleton instance
let instance: RemoteModelServiceClass | null = null;

export function getRemoteModelService(): RemoteModelServiceClass {
  if (!instance) {
    instance = new RemoteModelServiceClass();
  }

  return instance;
}

export { RemoteModelServiceClass };
