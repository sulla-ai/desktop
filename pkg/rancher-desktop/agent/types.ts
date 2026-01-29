// Agent Application Types

export interface AgentContext {
  // Original input
  rawInput: string;
  inputType: 'text' | 'audio';

  // Processed prompt (can be modified by plugins)
  prompt: string;

  // Response from LLM (set by LLM plugin, can be modified by other plugins)
  response: string;

  // Metadata that plugins can read/write
  metadata: Record<string, unknown>;

  // Function calls that plugins can add/modify
  functionCalls: FunctionCall[];

  // Errors collected during processing
  errors: string[];

  // Timestamp
  timestamp: number;
}

export interface FunctionCall {
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
}

export interface PluginConfig {
  // Plugin identifier
  id: string;

  // Display name
  name: string;

  // Execution order (lower = earlier)
  order: number;

  // Whether plugin is enabled
  enabled: boolean;

  // Plugin-specific settings
  settings: Record<string, unknown>;
}

export interface Plugin {
  // Plugin configuration
  config: PluginConfig;

  // Called once when plugin is registered
  initialize?(): Promise<void>;

  // Called before the main processing loop
  beforeProcess?(context: AgentContext): Promise<AgentContext>;

  // Main processing hook - this is where LLM calls happen
  process?(context: AgentContext): Promise<AgentContext>;

  // Called after the main processing loop
  afterProcess?(context: AgentContext): Promise<AgentContext>;

  // Called to clean up resources
  destroy?(): Promise<void>;
}

export interface SensoryInput {
  type: 'text' | 'audio';
  data: string; // For text, the actual text. For audio, base64 or path.
  metadata?: Record<string, unknown>;
}

export interface AgentResponse {
  type: 'text' | 'audio';
  data: string;
  metadata?: Record<string, unknown>;
  context: AgentContext; // Full context for debugging/inspection
}
