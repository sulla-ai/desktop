// BasePlugin - Abstract base class for all plugins

import type { AgentContext, Plugin, PluginConfig } from '../types';

export abstract class BasePlugin implements Plugin {
  config: PluginConfig;

  constructor(config: Partial<PluginConfig> & { id: string; name: string }) {
    this.config = {
      id:       config.id,
      name:     config.name,
      order:    config.order ?? 100,
      enabled:  config.enabled ?? true,
      settings: config.settings ?? {},
    };
  }

  async initialize(): Promise<void> {
    // Override in subclass if needed
  }

  async beforeProcess(context: AgentContext): Promise<AgentContext> {
    // Override in subclass if needed
    return context;
  }

  async process(context: AgentContext): Promise<AgentContext> {
    // Override in subclass if needed
    return context;
  }

  async afterProcess(context: AgentContext): Promise<AgentContext> {
    // Override in subclass if needed
    return context;
  }

  async destroy(): Promise<void> {
    // Override in subclass if needed
  }
}
