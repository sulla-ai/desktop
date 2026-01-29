// Sensory - Handles input from various sources (text, audio, etc.)

import type { SensoryInput } from './types';
import { getAgentApplication } from './AgentApplication';
import type { AgentResponse } from './types';

export class Sensory {
  /**
   * Process text input and trigger the agent application
   */
  async processText(text: string, metadata?: Record<string, unknown>): Promise<AgentResponse> {
    const input: SensoryInput = {
      type: 'text',
      data: text.trim(),
      metadata,
    };

    const agent = getAgentApplication();

    return agent.process(input);
  }

  /**
   * Process audio input (placeholder for future implementation)
   * Will convert audio to text via Whisper STT, then process
   */
  async processAudio(audioData: string, metadata?: Record<string, unknown>): Promise<AgentResponse> {
    // TODO: Integrate with Whisper STT service
    // For now, throw not implemented
    throw new Error('Audio input not yet implemented. Use processText() instead.');
  }
}

// Singleton instance
let sensoryInstance: Sensory | null = null;

export function getSensory(): Sensory {
  if (!sensoryInstance) {
    sensoryInstance = new Sensory();
  }

  return sensoryInstance;
}
