// RemoteModelService - Handles remote LLM API calls (Grok, OpenAI, Anthropic, Google)
// Implements ILLMService for interchangeable use with OllamaService

import type { ILLMService, ChatMessage, GenerateOptions, ChatOptions, RemoteProviderConfig } from './ILLMService';

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
};

class RemoteModelServiceClass implements ILLMService {
  private config: RemoteProviderConfig | null = null;
  private available = false;
  private initialized = false;

  /**
   * Configure the service with provider details
   */
  configure(config: RemoteProviderConfig): void {
    this.config = config;
    this.initialized = false;
    this.available = false;
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
  async generate(prompt: string, options: GenerateOptions = {}): Promise<string | null> {
    const messages: ChatMessage[] = [];

    if (options.system) {
      messages.push({ role: 'system', content: options.system });
    }
    messages.push({ role: 'user', content: prompt });

    return this.chat(messages, options);
  }

  /**
   * Chat completion - main method
   */
  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<string | null> {
    if (!this.config || !this.config.apiKey) {
      console.warn('[RemoteModelService] Not configured');

      return null;
    }

    const providerConfig = this.getProviderConfig();

    if (!providerConfig) {
      return null;
    }

    const { timeout = 60000, temperature } = options;

    try {
      // Route to provider-specific handler
      switch (this.config.id) {
        case 'anthropic':
          return await this.chatAnthropic(messages, temperature, timeout);
        case 'google':
          return await this.chatGoogle(messages, temperature, timeout);
        default:
          // OpenAI-compatible (Grok, OpenAI)
          return await this.chatOpenAI(messages, temperature, timeout);
      }
    } catch (err) {
      console.error('[RemoteModelService] Chat failed:', err);

      return null;
    }
  }

  /**
   * OpenAI-compatible chat (works for Grok, OpenAI)
   */
  private async chatOpenAI(
    messages: ChatMessage[],
    temperature?: number,
    timeout = 60000,
  ): Promise<string | null> {
    const providerConfig = this.getProviderConfig()!;
    const url = `${providerConfig.baseUrl}${providerConfig.chatEndpoint}`;

    const body: Record<string, unknown> = {
      model:    this.config!.model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    };

    if (temperature !== undefined) {
      body.temperature = temperature;
    }

    const res = await fetch(url, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${this.config!.apiKey}`,
      },
      body:   JSON.stringify(body),
      signal: AbortSignal.timeout(timeout),
    });

    if (!res.ok) {
      const errorText = await res.text();

      console.error(`[RemoteModelService] OpenAI API error: ${res.status}`, errorText);

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
    temperature?: number,
    timeout = 60000,
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

    if (temperature !== undefined) {
      body.temperature = temperature;
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
    temperature?: number,
    timeout = 60000,
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

    if (temperature !== undefined) {
      body.generationConfig = { temperature };
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

      return null;
    }

    const data = await res.json();

    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
  }

  /**
   * Generate and parse JSON response
   */
  async generateJSON<T>(prompt: string, options: GenerateOptions = {}): Promise<T | null> {
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
