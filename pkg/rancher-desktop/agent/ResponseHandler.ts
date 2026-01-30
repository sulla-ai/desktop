// ResponseHandler - Handles output formatting and modality routing
// Routes to TTS for voice input, text display otherwise
// Includes critique step for coherence refinement

import type { AgentResponse } from './types';
import { getLLMService } from './services/LLMServiceFactory';

export class ResponseHandler {
  /**
   * Format response as text
   */
  formatText(response: AgentResponse): string {
    return response.content;
  }

  /**
   * Format response as audio (via Coqui TTS)
   * Returns audio data URL or path
   */
  async formatAudio(response: AgentResponse): Promise<string> {
    // TODO: Integrate with Coqui TTS service at port 30091
    throw new Error('Audio output not yet implemented. Use formatText() instead.');
  }

  /**
   * Apply critique step to refine response for coherence
   * Uses a quick LLM call to improve the response
   */
  async refine(response: AgentResponse): Promise<AgentResponse> {
    if (response.refined) {
      return response; // Already refined
    }

    try {
      const llm = getLLMService();
      const refined = await llm.generate(
        `Refine this response for clarity and coherence. Keep it concise. Only output the refined response, nothing else:\n\n${ response.content }`,
      );

      if (refined && refined.length > 0) {
        return {
          ...response,
          content: refined,
          refined: true,
        };
      }
    } catch {
      // Refinement failed, return original
    }

    return response;
  }

  /**
   * Check if response has errors
   */
  hasErrors(response: AgentResponse): boolean {
    return !!response.metadata.error;
  }

  /**
   * Get error message if any
   */
  getError(response: AgentResponse): string | null {
    return (response.metadata.error as string) || null;
  }

  /**
   * Route response based on input modality
   */
  async route(response: AgentResponse, inputSource: string): Promise<{ type: 'text' | 'audio'; data: string }> {
    if (inputSource === 'microphone') {
      // Voice input → TTS output
      try {
        const audioData = await this.formatAudio(response);

        return { type: 'audio', data: audioData };
      } catch {
        // Fall back to text
      }
    }

    return { type: 'text', data: this.formatText(response) };
  }
}

// Singleton instance
let handlerInstance: ResponseHandler | null = null;

export function getResponseHandler(): ResponseHandler {
  if (!handlerInstance) {
    handlerInstance = new ResponseHandler();
  }

  return handlerInstance;
}
