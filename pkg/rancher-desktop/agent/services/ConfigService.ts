// ConfigService - Central configuration for agent services
// Reads settings from the main process via IPC

import type { LLMConfig } from './ILLMService';
import { updateLLMConfig } from './LLMServiceFactory';
import { getHeartbeatService } from './HeartbeatService';

const DEFAULT_MODEL = 'tinyllama:latest';
const OLLAMA_BASE = 'http://127.0.0.1:30114';

interface AgentConfig {
  ollamaModel: string;
  ollamaBase: string;
  soulPrompt: string;
  botName: string;
  primaryUserName: string;
  // LLM mode settings
  modelMode: 'local' | 'remote';
  // Local Ollama settings
  localTimeoutSeconds: number;
  localRetryCount: number;
  // Remote API settings
  remoteProvider: string;
  remoteModel: string;
  remoteApiKey: string;
  remoteRetryCount: number;
  remoteTimeoutSeconds: number;
  // Heartbeat settings
  heartbeatEnabled: boolean;
  heartbeatDelayMinutes: number;
  heartbeatPrompt: string;
  heartbeatModel: string;
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
        ollamaModel:      config.sullaModel || DEFAULT_MODEL,
        ollamaBase:       OLLAMA_BASE,
        soulPrompt:       config.soulPrompt || '',
        botName:          config.botName || 'Sulla',
        primaryUserName:  config.primaryUserName || '',
        modelMode:        config.modelMode || 'local',
        localTimeoutSeconds: config.localTimeoutSeconds ?? 120,
        localRetryCount: config.localRetryCount ?? 2,
        remoteProvider:   config.remoteProvider || 'grok',
        remoteModel:      config.remoteModel || 'grok-4-1-fast-reasoning',
        remoteApiKey:     config.remoteApiKey || '',
        remoteRetryCount: config.remoteRetryCount ?? 3,
        remoteTimeoutSeconds: config.remoteTimeoutSeconds ?? 60,
        heartbeatEnabled: config.heartbeatEnabled ?? true,
        heartbeatDelayMinutes: config.heartbeatDelayMinutes ?? 30,
        heartbeatPrompt: config.heartbeatPrompt || 'This is the time for you to accomplish your goals',
        heartbeatModel: config.heartbeatModel || 'default',
      };

      return cachedConfig;
    }
  } catch {
    // Settings not available
  }

  // Return defaults
  return {
    ollamaModel:      DEFAULT_MODEL,
    ollamaBase:       OLLAMA_BASE,
    soulPrompt:       '',
    botName:          'Sulla',
    primaryUserName:  '',
    modelMode:        'local',
    localTimeoutSeconds: 120,
    localRetryCount: 2,
    remoteProvider:   'grok',
    remoteModel:      'grok-4-1-fast-reasoning',
    remoteApiKey:     '',
    remoteRetryCount: 3,
    remoteTimeoutSeconds: 60,
    heartbeatEnabled: true,
    heartbeatDelayMinutes: 30,
    heartbeatPrompt: 'This is the time for you to accomplish your goals',
    heartbeatModel: 'default',
  };
}

/**
 * Update the cached configuration with full settings
 * Called when settings change
 */
export function updateAgentConfigFull(settings: {
  sullaModel?: string;
  soulPrompt?: string;
  botName?: string;
  primaryUserName?: string;
  modelMode?: 'local' | 'remote';
  localTimeoutSeconds?: number;
  localRetryCount?: number;
  remoteProvider?: string;
  remoteModel?: string;
  remoteApiKey?: string;
  remoteRetryCount?: number;
  remoteTimeoutSeconds?: number;
  heartbeatEnabled?: boolean;
  heartbeatDelayMinutes?: number;
  heartbeatPrompt?: string;
  heartbeatModel?: string;
}): void {
  cachedConfig = {
    ollamaModel:      settings.sullaModel || DEFAULT_MODEL,
    ollamaBase:       OLLAMA_BASE,
    soulPrompt:       settings.soulPrompt || '',
    botName:          settings.botName || 'Sulla',
    primaryUserName:  settings.primaryUserName || '',
    modelMode:        settings.modelMode || 'local',
    localTimeoutSeconds: settings.localTimeoutSeconds ?? 120,
    localRetryCount: settings.localRetryCount ?? 2,
    remoteProvider:   settings.remoteProvider || 'grok',
    remoteModel:      settings.remoteModel || 'grok-4-1-fast-reasoning',
    remoteApiKey:     settings.remoteApiKey || '',
    remoteRetryCount: settings.remoteRetryCount ?? 3,
    remoteTimeoutSeconds: settings.remoteTimeoutSeconds ?? 60,
    heartbeatEnabled: settings.heartbeatEnabled ?? true,
    heartbeatDelayMinutes: settings.heartbeatDelayMinutes ?? 30,
    heartbeatPrompt: settings.heartbeatPrompt || 'This is the time for you to accomplish your goals',
    heartbeatModel: settings.heartbeatModel || 'default',
  };

  // Update the LLM service factory
  const llmConfig: LLMConfig = {
    mode:             cachedConfig.modelMode,
    localModel:       cachedConfig.ollamaModel,
    ollamaBase:       cachedConfig.ollamaBase,
    localTimeoutSeconds: cachedConfig.localTimeoutSeconds,
    localRetryCount: cachedConfig.localRetryCount,
    remoteProvider:   cachedConfig.remoteProvider,
    remoteModel:      cachedConfig.remoteModel,
    remoteApiKey:     cachedConfig.remoteApiKey,
    remoteRetryCount: cachedConfig.remoteRetryCount,
    remoteTimeoutSeconds: cachedConfig.remoteTimeoutSeconds,
  };

  // updateLLMConfig is now async but we don't need to await it here
  // as it will complete before the next LLM call
  updateLLMConfig(llmConfig).catch(err => {
    console.warn('[ConfigService] Failed to update LLM config:', err);
  });

  // Update heartbeat service
  const heartbeatService = getHeartbeatService();
  heartbeatService.updateConfig({
    enabled: cachedConfig.heartbeatEnabled,
    delayMinutes: cachedConfig.heartbeatDelayMinutes,
    prompt: cachedConfig.heartbeatPrompt,
    model: cachedConfig.heartbeatModel,
  });

  console.log(`[ConfigService] Config updated: mode=${cachedConfig.modelMode}, model=${cachedConfig.modelMode === 'local' ? cachedConfig.ollamaModel : cachedConfig.remoteModel}, retries=${cachedConfig.remoteRetryCount}, timeoutSeconds=${cachedConfig.remoteTimeoutSeconds}, heartbeat=${cachedConfig.heartbeatEnabled ? `${cachedConfig.heartbeatDelayMinutes}min` : 'disabled'}`);
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

/**
 * Get local Ollama settings
 */
export function getLocalConfig(): { timeoutSeconds: number; retryCount: number } {
  const config = getAgentConfig();

  return {
    timeoutSeconds: config.localTimeoutSeconds,
    retryCount:     config.localRetryCount,
  };
}

export { DEFAULT_MODEL, OLLAMA_BASE };
