// Agent Application - Core orchestrator for the multi-agent reasoning loop

import type { AgentContext, Plugin, PluginConfig, SensoryInput, AgentResponse } from './types';

export class AgentApplication {
  private plugins: Plugin[] = [];
  private initialized = false;

  constructor() {}

  /**
   * Register a plugin with the agent application
   */
  registerPlugin(plugin: Plugin): void {
    this.plugins.push(plugin);
    // Sort by order after each registration
    this.plugins.sort((a, b) => a.config.order - b.config.order);
  }

  /**
   * Unregister a plugin by ID
   */
  unregisterPlugin(pluginId: string): void {
    const index = this.plugins.findIndex(p => p.config.id === pluginId);

    if (index !== -1) {
      this.plugins.splice(index, 1);
    }
  }

  /**
   * Get all registered plugins
   */
  getPlugins(): Plugin[] {
    return [...this.plugins];
  }

  /**
   * Get a plugin by ID
   */
  getPlugin(pluginId: string): Plugin | undefined {
    return this.plugins.find(p => p.config.id === pluginId);
  }

  /**
   * Update plugin configuration
   */
  updatePluginConfig(pluginId: string, config: Partial<PluginConfig>): void {
    const plugin = this.getPlugin(pluginId);

    if (plugin) {
      Object.assign(plugin.config, config);
      // Re-sort if order changed
      this.plugins.sort((a, b) => a.config.order - b.config.order);
    }
  }

  /**
   * Initialize all plugins
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    for (const plugin of this.plugins) {
      if (plugin.config.enabled && plugin.initialize) {
        try {
          await plugin.initialize();
        } catch (err) {
          console.error(`Failed to initialize plugin ${ plugin.config.id }:`, err);
        }
      }
    }

    this.initialized = true;
  }

  /**
   * Process a sensory input through the agent pipeline
   */
  async process(input: SensoryInput): Promise<AgentResponse> {
    // Create initial context
    let context: AgentContext = {
      rawInput:      input.data,
      inputType:     input.type,
      prompt:        input.data, // Start with raw input as prompt
      response:      '',
      metadata:      { ...input.metadata },
      functionCalls: [],
      errors:        [],
      timestamp:     Date.now(),
    };

    const enabledPlugins = this.plugins.filter(p => p.config.enabled);

    // Phase 1: beforeProcess hooks
    for (const plugin of enabledPlugins) {
      if (plugin.beforeProcess) {
        try {
          context = await plugin.beforeProcess(context);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);

          context.errors.push(`[${ plugin.config.id }] beforeProcess error: ${ message }`);
          console.error(`Plugin ${ plugin.config.id } beforeProcess error:`, err);
        }
      }
    }

    // Phase 2: process hooks (main processing, LLM calls happen here)
    for (const plugin of enabledPlugins) {
      if (plugin.process) {
        try {
          context = await plugin.process(context);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);

          context.errors.push(`[${ plugin.config.id }] process error: ${ message }`);
          console.error(`Plugin ${ plugin.config.id } process error:`, err);
        }
      }
    }

    // Phase 3: afterProcess hooks
    for (const plugin of enabledPlugins) {
      if (plugin.afterProcess) {
        try {
          context = await plugin.afterProcess(context);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);

          context.errors.push(`[${ plugin.config.id }] afterProcess error: ${ message }`);
          console.error(`Plugin ${ plugin.config.id } afterProcess error:`, err);
        }
      }
    }

    // Build response
    const response: AgentResponse = {
      type:    'text', // For now, always text
      data:    context.response,
      context,
    };

    return response;
  }

  /**
   * Destroy all plugins and clean up
   */
  async destroy(): Promise<void> {
    for (const plugin of this.plugins) {
      if (plugin.destroy) {
        try {
          await plugin.destroy();
        } catch (err) {
          console.error(`Failed to destroy plugin ${ plugin.config.id }:`, err);
        }
      }
    }

    this.plugins = [];
    this.initialized = false;
  }
}

// Singleton instance
let agentInstance: AgentApplication | null = null;

export function getAgentApplication(): AgentApplication {
  if (!agentInstance) {
    agentInstance = new AgentApplication();
  }

  return agentInstance;
}

export function resetAgentApplication(): void {
  if (agentInstance) {
    agentInstance.destroy();
    agentInstance = null;
  }
}
