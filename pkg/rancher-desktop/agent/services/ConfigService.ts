// ConfigService - Central configuration for agent services
// Reads settings from the main process via IPC

const DEFAULT_MODEL = 'tinyllama:latest';
const OLLAMA_BASE = 'http://127.0.0.1:30114';

interface AgentConfig {
  ollamaModel: string;
  ollamaBase: string;
}

let cachedConfig: AgentConfig | null = null;

/**
 * Get the current agent configuration
 * In renderer process, this reads from window settings
 * In main process or when settings unavailable, uses defaults
 */
export function getAgentConfig(): AgentConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  // Try to read from global settings if available
  try {
    // Check if we're in a context where settings are available
    if (typeof window !== 'undefined' && (window as any).__SULLA_CONFIG__) {
      const config = (window as any).__SULLA_CONFIG__;

      cachedConfig = {
        ollamaModel: config.sullaModel || DEFAULT_MODEL,
        ollamaBase:  OLLAMA_BASE,
      };

      return cachedConfig;
    }
  } catch {
    // Settings not available
  }

  // Return defaults
  return {
    ollamaModel: DEFAULT_MODEL,
    ollamaBase:  OLLAMA_BASE,
  };
}

/**
 * Update the cached configuration
 * Called when settings change
 */
export function updateAgentConfig(model: string): void {
  cachedConfig = {
    ollamaModel: model || DEFAULT_MODEL,
    ollamaBase:  OLLAMA_BASE,
  };
  console.log(`[ConfigService] Model updated to: ${cachedConfig.ollamaModel}`);
}

/**
 * Get the configured Ollama model
 */
export function getOllamaModel(): string {
  return getAgentConfig().ollamaModel;
}

/**
 * Get the Ollama base URL
 */
export function getOllamaBase(): string {
  return getAgentConfig().ollamaBase;
}

export { DEFAULT_MODEL, OLLAMA_BASE };
