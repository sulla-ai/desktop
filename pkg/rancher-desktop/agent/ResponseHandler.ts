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
    const content = typeof response.content === 'string' ? response.content : String(response.content || '');
    const trimmed = content.trim();

    if (!trimmed) {
      return '';
    }

    // If the model returned a JSON blob, unwrap it into readable text.
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed) as any;
        const payload = parsed && typeof parsed === 'object' && parsed.response && typeof parsed.response === 'object'
          ? parsed.response
          : parsed;

        if (payload && typeof payload === 'object') {
          const out: string[] = [];

          if (typeof payload.greeting === 'string' && payload.greeting.trim()) {
            out.push(payload.greeting.trim());
          }

          if (typeof payload.updateSummary === 'string' && payload.updateSummary.trim()) {
            out.push(payload.updateSummary.trim());
          }

          if (payload.details && typeof payload.details === 'object') {
            const d = payload.details;
            if (typeof d.whatWasDone === 'string' && d.whatWasDone.trim()) {
              out.push(`What was done: ${d.whatWasDone.trim()}`);
            }
            if (typeof d.whatRemains === 'string' && d.whatRemains.trim()) {
              out.push(`What remains: ${d.whatRemains.trim()}`);
            }
          }

          if (Array.isArray(payload.nextSteps) && payload.nextSteps.length > 0) {
            const steps = payload.nextSteps.map((s: any) => String(s || '').trim()).filter(Boolean);
            if (steps.length > 0) {
              out.push(['Next steps:', ...steps.map((s: string) => `- ${s}`)].join('\n'));
            }
          }

          if (typeof payload.closing === 'string' && payload.closing.trim()) {
            out.push(payload.closing.trim());
          }

          const joined = out.join('\n\n').trim();
          if (joined) {
            return joined;
          }
        }
      } catch {
        // If parsing fails, fall through and display raw content.
      }
    }

    return content;
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
