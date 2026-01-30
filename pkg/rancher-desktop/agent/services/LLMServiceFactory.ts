// LLMServiceFactory - Factory to get the appropriate LLM service based on settings
// Returns either OllamaService (local) or RemoteModelService (API) based on config

import type { ILLMService, LLMConfig } from './ILLMService';
import { getOllamaService } from './OllamaService';
import { getRemoteModelService } from './RemoteModelService';

// Cached config
let currentConfig: LLMConfig | null = null;

/**
 * Update the LLM configuration
 * Call this when settings change
 */
export function updateLLMConfig(config: LLMConfig): void {
  currentConfig = config;

  // Always apply remote service configuration knobs when in remote mode.
  // Availability is still determined by whether an API key is present.
  if (config.mode === 'remote') {
    const remoteService = getRemoteModelService();

    remoteService.configure({
      id:     config.remoteProvider,
      name:   config.remoteProvider,
      baseUrl: getProviderBaseUrl(config.remoteProvider),
      apiKey: config.remoteApiKey,
      model:  config.remoteModel,
    });

    if (config.remoteRetryCount !== undefined) {
      remoteService.setRetryCount(config.remoteRetryCount);
    }

    if (config.remoteTimeoutSeconds !== undefined) {
      remoteService.setDefaultTimeoutMs(config.remoteTimeoutSeconds * 1000);
    }
  }

  console.log(`[LLMServiceFactory] Config updated: mode=${config.mode}, model=${config.mode === 'local' ? config.localModel : config.remoteModel}`);
}

/**
 * Get the base URL for a provider
 */
function getProviderBaseUrl(providerId: string): string {
  const urls: Record<string, string> = {
    grok:      'https://api.x.ai/v1',
    openai:    'https://api.openai.com/v1',
    anthropic: 'https://api.anthropic.com/v1',
    google:    'https://generativelanguage.googleapis.com/v1beta',
  };

  return urls[providerId] || urls.openai;
}

/**
 * Get the current LLM configuration
 */
export function getLLMConfig(): LLMConfig | null {
  return currentConfig;
}

/**
 * Get the appropriate LLM service based on current config
 * Returns OllamaService for local mode, RemoteModelService for remote mode
 */
export function getLLMService(): ILLMService {
  // Default to Ollama if no config
  if (!currentConfig || currentConfig.mode === 'local') {
    return getOllamaService();
  }

  // Check if remote is properly configured
  if (currentConfig.remoteApiKey) {
    return getRemoteModelService();
  }

  // Fall back to Ollama if remote not configured
  console.warn('[LLMServiceFactory] Remote mode selected but no API key, falling back to Ollama');

  return getOllamaService();
}

/**
 * Initialize the current LLM service
 */
export async function initializeLLMService(): Promise<boolean> {
  const service = getLLMService();

  return service.initialize();
}

/**
 * Check if the current LLM service is available
 */
export function isLLMServiceAvailable(): boolean {
  const service = getLLMService();

  return service.isAvailable();
}

/**
 * Get the current model name (from either local or remote)
 */
export function getCurrentModel(): string {
  const service = getLLMService();

  return service.getModel();
}

/**
 * Get the current mode (local or remote)
 */
export function getCurrentMode(): 'local' | 'remote' {
  return currentConfig?.mode || 'local';
}
