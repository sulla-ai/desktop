// CriticNode - Reviews output and decides approve/reject/revise

import type { ThreadState, NodeResult } from '../types';
import { BaseNode } from './BaseNode';

export type CriticDecision = 'approve' | 'revise' | 'reject';

export class CriticNode extends BaseNode {
  private maxRevisions = 2;

  constructor() {
    super('critic', 'Critic');
  }

  async execute(state: ThreadState): Promise<{ state: ThreadState; next: NodeResult }> {
    console.log(`[Agent:Critic] Executing...`);
    const response = state.metadata.response as string | undefined;

    if (!response) {
      console.log(`[Agent:Critic] No response to critique, ending`);

      return { state, next: 'end' };
    }

    const revisionCount = (state.metadata.revisionCount as number) || 0;

    if (revisionCount >= this.maxRevisions) {
      console.log(`[Agent:Critic] Max revisions (${this.maxRevisions}) reached, auto-approving`);
      state.metadata.criticDecision = 'approve';
      state.metadata.criticReason = 'Max revisions reached';

      return { state, next: 'end' };
    }

    const decision = await this.evaluate(state, response);
    console.log(`[Agent:Critic] Decision: ${decision.decision} - ${decision.reason}`);

    state.metadata.criticDecision = decision.decision;
    state.metadata.criticReason = decision.reason;

    if (decision.decision === 'approve') {
      return { state, next: 'end' };
    }

    if (decision.decision === 'revise') {
      state.metadata.revisionCount = revisionCount + 1;
      state.metadata.revisionFeedback = decision.reason;
      console.log(`[Agent:Critic] Requesting revision ${revisionCount + 1}/${this.maxRevisions}`);

      return { state, next: 'planner' };
    }

    console.error(`[Agent:Critic] Response rejected: ${decision.reason}`);
    state.metadata.error = `Response rejected: ${ decision.reason }`;

    return { state, next: 'end' };
  }

  private async evaluate(
    state: ThreadState,
    response: string,
  ): Promise<{ decision: CriticDecision; reason: string }> {
    // Get the original query
    const lastUserMessage = state.messages.filter(m => m.role === 'user').pop();
    const query = lastUserMessage?.content || '';

    // Simple heuristic checks first
    if (response.length < 10) {
      return { decision: 'revise', reason: 'Response too short' };
    }

    if (response.toLowerCase().includes('i cannot') && response.length < 50) {
      return { decision: 'revise', reason: 'Response appears to be a refusal without explanation' };
    }

    // Check for obvious errors
    if (response.includes('error') && response.includes('undefined')) {
      return { decision: 'revise', reason: 'Response contains error indicators' };
    }

    // For more sophisticated critique, use LLM
    // But keep it fast - only do this if we have concerns
    const needsDeepReview = this.needsDeepReview(query, response);

    if (needsDeepReview) {
      return this.llmEvaluate(query, response);
    }

    // Default: approve
    return { decision: 'approve', reason: 'Response passes basic checks' };
  }

  private needsDeepReview(query: string, response: string): boolean {
    // Trigger deep review for certain types of queries
    const criticalKeywords = ['important', 'critical', 'must', 'accurate', 'correct', 'exact'];
    const queryLower = query.toLowerCase();

    return criticalKeywords.some(kw => queryLower.includes(kw));
  }

  private async llmEvaluate(
    query: string,
    response: string,
  ): Promise<{ decision: CriticDecision; reason: string }> {
    const promptText = `You are a response quality critic. Evaluate if this response adequately answers the query.

Query: "${ query.substring(0, 200) }"
Response: "${ response.substring(0, 500) }"

Reply with exactly one word: APPROVE, REVISE, or REJECT`;

    const result = await this.prompt(promptText);

    if (result) {
      const verdict = result.content.toUpperCase().trim();

      if (verdict.includes('APPROVE')) {
        return { decision: 'approve', reason: 'LLM approved' };
      }

      if (verdict.includes('REVISE')) {
        return { decision: 'revise', reason: 'LLM suggests revision' };
      }

      if (verdict.includes('REJECT')) {
        return { decision: 'reject', reason: 'LLM rejected response' };
      }
    }

    return { decision: 'approve', reason: 'Default approval (LLM unavailable)' };
  }
}
