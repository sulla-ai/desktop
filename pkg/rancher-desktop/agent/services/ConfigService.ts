// ConfigService - Central configuration for agent services
// Reads settings from the main process via IPC

import type { LLMConfig } from './ILLMService';
import { updateLLMConfig } from './LLMServiceFactory';

const DEFAULT_MODEL = 'tinyllama:latest';
const OLLAMA_BASE = 'http://127.0.0.1:30114';

interface AgentConfig {
  ollamaModel: string;
  ollamaBase: string;
  // LLM mode settings
  modelMode: 'local' | 'remote';
  remoteProvider: string;
  remoteModel: string;
  remoteApiKey: string;
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
        ollamaModel:    config.sullaModel || DEFAULT_MODEL,
        ollamaBase:     OLLAMA_BASE,
        modelMode:      config.modelMode || 'local',
        remoteProvider: config.remoteProvider || 'grok',
        remoteModel:    config.remoteModel || 'grok-4-1-fast-reasoning',
        remoteApiKey:   config.remoteApiKey || '',
      };

      return cachedConfig;
    }
  } catch {
    // Settings not available
  }

  // Return defaults
  return {
    ollamaModel:    DEFAULT_MODEL,
    ollamaBase:     OLLAMA_BASE,
    modelMode:      'local',
    remoteProvider: 'grok',
    remoteModel:    'grok-4-1-fast-reasoning',
    remoteApiKey:   '',
  };
}

/**
 * Update the cached configuration with full settings
 * Called when settings change
 */
export function updateAgentConfigFull(settings: {
  sullaModel?: string;
  modelMode?: 'local' | 'remote';
  remoteProvider?: string;
  remoteModel?: string;
  remoteApiKey?: string;
}): void {
  cachedConfig = {
    ollamaModel:    settings.sullaModel || DEFAULT_MODEL,
    ollamaBase:     OLLAMA_BASE,
    modelMode:      settings.modelMode || 'local',
    remoteProvider: settings.remoteProvider || 'grok',
    remoteModel:    settings.remoteModel || 'grok-4-1-fast-reasoning',
    remoteApiKey:   settings.remoteApiKey || '',
  };

  // Update the LLM service factory
  const llmConfig: LLMConfig = {
    mode:           cachedConfig.modelMode,
    localModel:     cachedConfig.ollamaModel,
    ollamaBase:     cachedConfig.ollamaBase,
    remoteProvider: cachedConfig.remoteProvider,
    remoteModel:    cachedConfig.remoteModel,
    remoteApiKey:   cachedConfig.remoteApiKey,
  };

  updateLLMConfig(llmConfig);
  console.log(`[ConfigService] Config updated: mode=${cachedConfig.modelMode}, model=${cachedConfig.modelMode === 'local' ? cachedConfig.ollamaModel : cachedConfig.remoteModel}`);
}

/**
 * Update the cached configuration (legacy - just model)
 * Called when settings change
 */
export function updateAgentConfig(model: string): void {
  const current = getAgentConfig();

  cachedConfig = {
    ...current,
    ollamaModel: model || DEFAULT_MODEL,
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

/**
 * Get the current model mode
 */
export function getModelMode(): 'local' | 'remote' {
  return getAgentConfig().modelMode;
}

/**
 * Get remote provider settings
 */
export function getRemoteConfig(): { provider: string; model: string; apiKey: string } {
  const config = getAgentConfig();

  return {
    provider: config.remoteProvider,
    model:    config.remoteModel,
    apiKey:   config.remoteApiKey,
  };
}

export { DEFAULT_MODEL, OLLAMA_BASE };
