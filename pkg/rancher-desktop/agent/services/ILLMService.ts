// ILLMService - Common interface for all LLM services (local and remote)
// This allows the agent to use either Ollama or remote APIs interchangeably

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GenerateOptions {
  stream?: boolean;
  timeout?: number;
  temperature?: number;
  system?: string;
}

export interface ChatOptions {
  stream?: boolean;
  timeout?: number;
  temperature?: number;
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
  generate(prompt: string, options?: GenerateOptions): Promise<string | null>;

  /**
   * Chat completion with message history
   */
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<string | null>;

  /**
   * Generate and parse JSON response
   */
  generateJSON<T>(prompt: string, options?: GenerateOptions): Promise<T | null>;

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
  // Remote settings
  remoteProvider: string;
  remoteModel: string;
  remoteApiKey: string;
}
