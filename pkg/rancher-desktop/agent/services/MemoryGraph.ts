// MemoryGraph - LangGraph-style processing for MemoryPedia
// Nodes: Planner → Extractor → Critic → Refiner → Consolidator

import type { ILLMService } from './ILLMService';
import { getLLMService, getCurrentMode } from './LLMServiceFactory';

// Processing state that flows through the graph
export interface MemoryProcessingState {
  threadId: string;
  conversationText: string;
  
  // Planner output
  plan: {
    shouldSummarize: boolean;
    shouldExtractEntities: boolean;
    expectedEntityTypes: string[];
    focusAreas: string[];
  } | null;
  
  // Extractor output
  extraction: {
    summary: string;
    topics: string[];
    entities: Array<{
      name: string;
      type: string;
      description: string;
      confidence: number;
    }>;
  } | null;
  
  // Critic output
  critique: {
    summaryQuality: 'good' | 'needs_improvement' | 'poor';
    summaryFeedback: string;
    entityIssues: Array<{
      entityName: string;
      issue: 'duplicate' | 'too_generic' | 'missing_context' | 'wrong_type' | 'low_value';
      suggestion: string;
    }>;
    missingEntities: string[];
    overallScore: number; // 0-100
    needsRefinement: boolean;
  } | null;
  
  // Refiner output (improved extraction)
  refinedExtraction: {
    summary: string;
    topics: string[];
    entities: Array<{
      name: string;
      type: string;
      description: string;
      confidence: number;
    }>;
  } | null;
  
  // Consolidator output
  consolidation: {
    mergedEntities: Array<{
      pageId: string;
      name: string;
      type: string;
      description: string;
      isNew: boolean;
      mergedWith: string | null;
    }>;
    associations: Array<{
      entity1: string;
      entity2: string;
      relationship: string;
    }>;
  } | null;
  
  // Processing metadata
  iterations: number;
  maxIterations: number;
  errors: string[];
}

type NodeResult = 'continue' | 'refine' | 'end';

interface NodeOutput {
  state: MemoryProcessingState;
  next: NodeResult;
}

// Base class for memory graph nodes
abstract class MemoryGraphNode {
  protected llmService: ILLMService;
  protected name: string;

  constructor(name: string) {
    this.name = name;
    this.llmService = getLLMService();
  }

  abstract execute(state: MemoryProcessingState): Promise<NodeOutput>;

  protected async promptJSON<T>(prompt: string): Promise<T | null> {
    try {
      const content = await this.llmService.generate(prompt) || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        return null;
      }

      return JSON.parse(jsonMatch[0]);
    } catch (err) {
      console.warn(`[MemoryGraph:${this.name}] JSON parse failed:`, err);

      return null;
    }
  }

  protected log(message: string): void {
    console.log(`[MemoryGraph:${this.name}] ${message}`);
  }
}

// Planner Node - Analyzes conversation and plans extraction strategy
class PlannerNode extends MemoryGraphNode {
  constructor() {
    super('Planner');
  }

  async execute(state: MemoryProcessingState): Promise<NodeOutput> {
    this.log('Planning extraction strategy...');

    const prompt = `Analyze this conversation and plan what should be extracted for long-term memory.

Conversation:
${state.conversationText.substring(0, 2000)}

Respond in JSON:
{
  "shouldSummarize": true/false (is this conversation worth summarizing?),
  "shouldExtractEntities": true/false (are there notable entities to extract?),
  "expectedEntityTypes": ["type1", "type2"] (what types of entities might be present?),
  "focusAreas": ["area1", "area2"] (what topics/areas should extraction focus on?)
}`;

    const plan = await this.promptJSON<MemoryProcessingState['plan']>(prompt);

    if (plan) {
      state.plan = plan;
      this.log(`Plan: summarize=${plan.shouldSummarize}, entities=${plan.shouldExtractEntities}, types=${plan.expectedEntityTypes.join(',')}`);
    } else {
      // Default plan
      state.plan = {
        shouldSummarize:      true,
        shouldExtractEntities: true,
        expectedEntityTypes:  ['project', 'technology', 'concept'],
        focusAreas:           ['main topic'],
      };
    }

    return { state, next: 'continue' };
  }
}

// Extractor Node - Extracts summary and entities based on plan
class ExtractorNode extends MemoryGraphNode {
  constructor() {
    super('Extractor');
  }

  async execute(state: MemoryProcessingState): Promise<NodeOutput> {
    this.log('Extracting summary and entities...');

    if (!state.plan) {
      state.errors.push('No plan available for extraction');

      return { state, next: 'end' };
    }

    const entityTypesHint = state.plan.expectedEntityTypes.length > 0
      ? `Focus on these entity types: ${state.plan.expectedEntityTypes.join(', ')}`
      : '';

    const focusHint = state.plan.focusAreas.length > 0
      ? `Pay attention to: ${state.plan.focusAreas.join(', ')}`
      : '';

    const prompt = `Extract a summary and entities from this conversation.

${entityTypesHint}
${focusHint}

Conversation:
${state.conversationText}

Respond in JSON:
{
  "summary": "2-3 sentence summary of what was discussed and accomplished",
  "topics": ["topic1", "topic2"],
  "entities": [
    {
      "name": "Entity Name",
      "type": "appropriate_type (project, person, technology, concept, workflow, configuration, api, database, infrastructure, file, command, error, solution, preference, etc.)",
      "description": "What this is and why it matters",
      "confidence": 0.0-1.0 (how confident you are this should be remembered)
    }
  ]
}`;

    const extraction = await this.promptJSON<MemoryProcessingState['extraction']>(prompt);

    if (extraction) {
      state.extraction = extraction;
      this.log(`Extracted: ${extraction.entities.length} entities, ${extraction.topics.length} topics`);
    } else {
      state.extraction = {
        summary:  'Conversation processed but extraction failed.',
        topics:   [],
        entities: [],
      };
      state.errors.push('Extraction failed, using fallback');
    }

    return { state, next: 'continue' };
  }
}

// Critic Node - Evaluates extraction quality and identifies issues
class CriticNode extends MemoryGraphNode {
  constructor() {
    super('Critic');
  }

  async execute(state: MemoryProcessingState): Promise<NodeOutput> {
    this.log('Critiquing extraction quality...');

    if (!state.extraction) {
      state.errors.push('No extraction to critique');

      return { state, next: 'end' };
    }

    const prompt = `Evaluate the quality of this memory extraction.

Original conversation (first 1000 chars):
${state.conversationText.substring(0, 1000)}

Extracted summary:
${state.extraction.summary}

Extracted entities:
${JSON.stringify(state.extraction.entities, null, 2)}

Evaluate and respond in JSON:
{
  "summaryQuality": "good" | "needs_improvement" | "poor",
  "summaryFeedback": "specific feedback on the summary",
  "entityIssues": [
    {
      "entityName": "name of problematic entity",
      "issue": "duplicate" | "too_generic" | "missing_context" | "wrong_type" | "low_value",
      "suggestion": "how to fix it"
    }
  ],
  "missingEntities": ["entities that should have been extracted but weren't"],
  "overallScore": 0-100,
  "needsRefinement": true/false (should this go through refinement?)
}`;

    const critique = await this.promptJSON<MemoryProcessingState['critique']>(prompt);

    if (critique) {
      state.critique = critique;
      this.log(`Critique: score=${critique.overallScore}, issues=${critique.entityIssues.length}, needsRefinement=${critique.needsRefinement}`);

      // Decide if we need refinement
      if (critique.needsRefinement && state.iterations < state.maxIterations) {
        return { state, next: 'refine' };
      }
    } else {
      // Default: accept extraction as-is
      state.critique = {
        summaryQuality:   'good',
        summaryFeedback:  'Critique unavailable',
        entityIssues:     [],
        missingEntities:  [],
        overallScore:     70,
        needsRefinement:  false,
      };
    }

    return { state, next: 'continue' };
  }
}

// Refiner Node - Improves extraction based on critique
class RefinerNode extends MemoryGraphNode {
  constructor() {
    super('Refiner');
  }

  async execute(state: MemoryProcessingState): Promise<NodeOutput> {
    this.log(`Refining extraction (iteration ${state.iterations + 1})...`);
    state.iterations++;

    if (!state.extraction || !state.critique) {
      state.errors.push('Missing extraction or critique for refinement');

      return { state, next: 'continue' };
    }

    const prompt = `Improve this memory extraction based on the critique.

Original conversation:
${state.conversationText}

Current extraction:
Summary: ${state.extraction.summary}
Entities: ${JSON.stringify(state.extraction.entities, null, 2)}

Critique feedback:
- Summary quality: ${state.critique.summaryQuality}
- Summary feedback: ${state.critique.summaryFeedback}
- Entity issues: ${JSON.stringify(state.critique.entityIssues, null, 2)}
- Missing entities: ${state.critique.missingEntities.join(', ')}

Provide an improved extraction in JSON:
{
  "summary": "improved summary addressing the feedback",
  "topics": ["topic1", "topic2"],
  "entities": [
    {
      "name": "Entity Name",
      "type": "appropriate_type",
      "description": "improved description",
      "confidence": 0.0-1.0
    }
  ]
}`;

    const refined = await this.promptJSON<MemoryProcessingState['refinedExtraction']>(prompt);

    if (refined) {
      state.refinedExtraction = refined;
      // Replace extraction with refined version for next iteration
      state.extraction = refined;
      this.log(`Refined: ${refined.entities.length} entities`);
    }

    // Go back to critic for another evaluation
    return { state, next: 'continue' };
  }
}

// Consolidator Node - Merges with existing knowledge, finds associations
class ConsolidatorNode extends MemoryGraphNode {
  private existingPages: Array<{ pageId: string; title: string; type: string }> = [];

  constructor() {
    super('Consolidator');
  }

  setExistingPages(pages: Array<{ pageId: string; title: string; type: string }>): void {
    this.existingPages = pages;
  }

  async execute(state: MemoryProcessingState): Promise<NodeOutput> {
    this.log('Consolidating with existing knowledge...');

    const extraction = state.refinedExtraction || state.extraction;

    if (!extraction) {
      state.errors.push('No extraction to consolidate');

      return { state, next: 'end' };
    }

    // If we have existing pages, check for merges
    if (this.existingPages.length > 0) {
      const prompt = `Analyze these new entities against existing knowledge pages.

New entities to add:
${JSON.stringify(extraction.entities, null, 2)}

Existing pages in knowledge base:
${JSON.stringify(this.existingPages, null, 2)}

For each new entity, determine:
1. Is it truly new, or should it merge with an existing page?
2. What associations/relationships exist between entities?

Respond in JSON:
{
  "mergedEntities": [
    {
      "pageId": "normalized_page_id",
      "name": "Entity Name",
      "type": "type",
      "description": "description",
      "isNew": true/false,
      "mergedWith": "existing_page_id or null"
    }
  ],
  "associations": [
    {
      "entity1": "page_id_1",
      "entity2": "page_id_2",
      "relationship": "description of relationship"
    }
  ]
}`;

      const consolidation = await this.promptJSON<MemoryProcessingState['consolidation']>(prompt);

      if (consolidation) {
        state.consolidation = consolidation;
        this.log(`Consolidated: ${consolidation.mergedEntities.length} entities, ${consolidation.associations.length} associations`);

        return { state, next: 'end' };
      }
    }

    // No existing pages or consolidation failed - just convert extraction to consolidation format
    state.consolidation = {
      mergedEntities: extraction.entities.map(e => ({
        pageId:      this.normalizePageId(e.name),
        name:        e.name,
        type:        e.type,
        description: e.description,
        isNew:       true,
        mergedWith:  null,
      })),
      associations: [],
    };

    this.log(`Created ${state.consolidation.mergedEntities.length} new entities`);

    return { state, next: 'end' };
  }

  private normalizePageId(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  }
}

// The Memory Graph - orchestrates the nodes
export class MemoryGraph {
  private planner: PlannerNode;
  private extractor: ExtractorNode;
  private critic: CriticNode;
  private refiner: RefinerNode;
  private consolidator: ConsolidatorNode;

  constructor() {
    this.planner = new PlannerNode();
    this.extractor = new ExtractorNode();
    this.critic = new CriticNode();
    this.refiner = new RefinerNode();
    this.consolidator = new ConsolidatorNode();
  }

  setExistingPages(pages: Array<{ pageId: string; title: string; type: string }>): void {
    this.consolidator.setExistingPages(pages);
  }

  async process(threadId: string, conversationText: string): Promise<MemoryProcessingState> {
    console.log(`[MemoryGraph] Starting processing for thread: ${threadId}`);

    // Initialize state
    let state: MemoryProcessingState = {
      threadId,
      conversationText,
      plan:              null,
      extraction:        null,
      critique:          null,
      refinedExtraction: null,
      consolidation:     null,
      iterations:        0,
      maxIterations:     2, // Max refinement loops
      errors:            [],
    };

    // Execute graph: Planner → Extractor → Critic → (Refiner → Critic)* → Consolidator
    try {
      // Step 1: Plan
      const planResult = await this.planner.execute(state);

      state = planResult.state;

      if (!state.plan?.shouldSummarize && !state.plan?.shouldExtractEntities) {
        console.log('[MemoryGraph] Nothing to extract, skipping');

        return state;
      }

      // Step 2: Extract
      const extractResult = await this.extractor.execute(state);

      state = extractResult.state;

      // Step 3: Critique (with potential refinement loop)
      let critiqueResult = await this.critic.execute(state);

      state = critiqueResult.state;

      while (critiqueResult.next === 'refine' && state.iterations < state.maxIterations) {
        // Refine
        const refineResult = await this.refiner.execute(state);

        state = refineResult.state;

        // Re-critique
        critiqueResult = await this.critic.execute(state);
        state = critiqueResult.state;
      }

      // Step 4: Consolidate
      const consolidateResult = await this.consolidator.execute(state);

      state = consolidateResult.state;

      console.log(`[MemoryGraph] Completed processing for thread: ${threadId} (${state.iterations} refinements)`);
    } catch (err) {
      console.error('[MemoryGraph] Processing failed:', err);
      state.errors.push(`Processing error: ${err}`);
    }

    return state;
  }
}
