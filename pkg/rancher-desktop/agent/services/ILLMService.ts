// ILLMService - Common interface for all LLM services (local and remote)
// This allows the agent to use either Ollama or remote APIs interchangeably

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * ILLMService - Common interface for LLM services
 * Implemented by OllamaService (local) and RemoteModelService (API)
 */
export interface ILLMService {
  /**
   * Initialize the service and check availability
   */
  initialize(): Promise<boolean>;

  /**
   * Check if the service is available
   */
  isAvailable(): boolean;

  /**
   * Get the current model name
   */
  getModel(): string;

  /**
   * Generate a completion from a prompt
   */
  generate(prompt: string, options?: { signal?: AbortSignal }): Promise<string | null>;

  /**
   * Chat completion with message history
   */
  chat(messages: ChatMessage[], options?: { signal?: AbortSignal }): Promise<string | null>;

  /**
   * Generate and parse JSON response
   */
  generateJSON<T>(prompt: string, options?: { signal?: AbortSignal }): Promise<T | null>;

  /**
   * Health check
   */
  healthCheck(): Promise<boolean>;
}

/**
 * Provider configuration for remote APIs
 */
export interface RemoteProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

/**
 * LLM configuration from settings
 */
export interface LLMConfig {
  mode: 'local' | 'remote';
  // Local (Ollama) settings
  localModel: string;
  ollamaBase: string;
  localTimeoutSeconds?: number;
  localRetryCount?: number;
  // Remote settings
  remoteProvider: string;
  remoteModel: string;
  remoteApiKey: string;
  remoteRetryCount?: number; // Number of retries before falling back to local LLM
  remoteTimeoutSeconds?: number;
}
