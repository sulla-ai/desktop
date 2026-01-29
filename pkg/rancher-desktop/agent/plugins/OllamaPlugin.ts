// OllamaPlugin - Calls Ollama LLM to generate responses

import type { AgentContext } from '../types';
import { BasePlugin } from './BasePlugin';

export interface OllamaPluginSettings {
  baseUrl: string;
  model: string;
  stream: boolean;
}

export class OllamaPlugin extends BasePlugin {
  private availableModel: string | null = null;

  constructor(settings?: Partial<OllamaPluginSettings>) {
    super({
      id:       'ollama',
      name:     'Ollama LLM',
      order:    50, // Middle of the pipeline - after prompt preparation, before response processing
      settings: {
        baseUrl: settings?.baseUrl ?? 'http://127.0.0.1:30114',
        model:   settings?.model ?? '', // Empty means auto-detect
        stream:  settings?.stream ?? false,
      },
    });
  }

  get settings(): OllamaPluginSettings {
    return this.config.settings as OllamaPluginSettings;
  }

  async initialize(): Promise<void> {
    // Try to detect available model on init
    await this.detectModel();
  }

  private async detectModel(): Promise<string | null> {
    try {
      const res = await fetch(`${ this.settings.baseUrl }/api/tags`);

      if (res.ok) {
        const data = await res.json();

        if (data.models && data.models.length > 0) {
          this.availableModel = data.models[0].name;

          return this.availableModel;
        }
      }
    } catch {
      // Model detection failed
    }

    return null;
  }

  async process(context: AgentContext): Promise<AgentContext> {
    // Determine which model to use
    let model = this.settings.model;

    if (!model) {
      // Auto-detect if not specified
      if (!this.availableModel) {
        await this.detectModel();
      }
      model = this.availableModel || '';
    }

    if (!model) {
      context.errors.push('[ollama] No model available. Ollama may still be downloading.');

      return context;
    }

    try {
      const res = await fetch(`${ this.settings.baseUrl }/api/generate`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          model,
          prompt: context.prompt,
          stream: this.settings.stream,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));

        throw new Error(errData.error || `HTTP ${ res.status }: ${ res.statusText }`);
      }

      const data = await res.json();

      context.response = data.response || '';
      context.metadata.ollamaModel = model;
      context.metadata.ollamaEvalCount = data.eval_count;
      context.metadata.ollamaEvalDuration = data.eval_duration;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      context.errors.push(`[ollama] Failed to generate response: ${ message }`);
    }

    return context;
  }
}
