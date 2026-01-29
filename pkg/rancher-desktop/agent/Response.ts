// Response - Handles output formatting (text, audio, etc.)

import type { AgentResponse } from './types';

export class Response {
  /**
   * Format response as text
   */
  formatText(agentResponse: AgentResponse): string {
    return agentResponse.data;
  }

  /**
   * Format response as audio (placeholder for future implementation)
   * Will convert text to audio via Coqui TTS
   */
  async formatAudio(agentResponse: AgentResponse): Promise<string> {
    // TODO: Integrate with Coqui TTS service
    // For now, throw not implemented
    throw new Error('Audio output not yet implemented. Use formatText() instead.');
  }

  /**
   * Get errors from the agent context
   */
  getErrors(agentResponse: AgentResponse): string[] {
    return agentResponse.context.errors;
  }

  /**
   * Check if response has errors
   */
  hasErrors(agentResponse: AgentResponse): boolean {
    return agentResponse.context.errors.length > 0;
  }

  /**
   * Get full context for debugging
   */
  getContext(agentResponse: AgentResponse): AgentResponse['context'] {
    return agentResponse.context;
  }
}

// Singleton instance
let responseInstance: Response | null = null;

export function getResponse(): Response {
  if (!responseInstance) {
    responseInstance = new Response();
  }

  return responseInstance;
}
