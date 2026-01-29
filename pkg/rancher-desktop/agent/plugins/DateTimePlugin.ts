// DateTimePlugin - Test plugin that instructs the model to include date/time in response

import type { AgentContext } from '../types';
import { BasePlugin } from './BasePlugin';

export class DateTimePlugin extends BasePlugin {
  constructor() {
    super({
      id:    'datetime',
      name:  'Date/Time Plugin',
      order: 25, // Runs before OllamaPlugin (order: 50) to modify the prompt
    });
  }

  async beforeProcess(context: AgentContext): Promise<AgentContext> {
    // Get current date/time
    const now = new Date();
    const dateTimeStr = now.toLocaleString();

    // Modify the prompt to instruct the model to include date/time
    context.prompt = `${ context.prompt }

[System instruction: At the end of your response, include the current date and time on a new line in the format "— ${ dateTimeStr }"]`;

    // Store the datetime in metadata for reference
    context.metadata.currentDateTime = dateTimeStr;

    return context;
  }
}
