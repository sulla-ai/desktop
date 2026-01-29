// MemoryPedia - Long-term memory system using Chroma for semantic search
// Stores conversation summaries and wikipedia-style entity pages
// Uses LangGraph-style processing for extraction refinement

import { MemoryGraph, MemoryProcessingState } from './MemoryGraph';
import { getChromaService } from './ChromaService';
import type { ILLMService } from './ILLMService';
import { getLLMService, getCurrentMode } from './LLMServiceFactory';

// Collection names
const COLLECTIONS = {
  SUMMARIES: 'conversation_summaries',
  PAGES: 'memorypedia_pages',
};

interface ConversationSummary {
  threadId: string;
  summary: string;
  topics: string[];
  entities: string[];
  timestamp: number;
}

interface MemoryPage {
  pageId: string;
  title: string;
  pageType: string; // Dynamic - LLM decides the type
  content: string;
  relatedThreads: string[];
  lastUpdated: number;
}

interface ExtractedEntities {
  entities: Array<{
    name: string;
    type: string; // Dynamic - LLM decides (e.g., project, person, concept, tool, technology, company, location, event, workflow, pattern, etc.)
    description: string;
  }>;
  topics: string[];
}

let instance: MemoryPedia | null = null;

export function getMemoryPedia(): MemoryPedia {
  if (!instance) {
    instance = new MemoryPedia();
  }

  return instance;
}

export class MemoryPedia {
  private llmService: ILLMService | null = null;
  private memoryGraph: MemoryGraph | null = null;
  private initialized = false;
  private processingQueue: Array<{ threadId: string; messages: Array<{ role: string; content: string }> }> = [];
  private isProcessing = false;
  private chroma = getChromaService();

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log('[MemoryPedia] Initializing...');

    // Initialize LLM service (local or remote)
    try {
      this.llmService = getLLMService();
      await this.llmService.initialize();
      const mode = getCurrentMode();

      console.log(`[MemoryPedia] LLM initialized: mode=${mode}, model=${this.llmService.getModel()}`);
    } catch (err) {
      console.warn('[MemoryPedia] LLM init failed:', err);
    }

    // Initialize MemoryGraph for LangGraph-style processing
    this.memoryGraph = new MemoryGraph();
    console.log('[MemoryPedia] MemoryGraph initialized');

    // Initialize ChromaService and ensure collections exist
    await this.chroma.initialize();

    // Ensure our collections exist
    for (const collName of Object.values(COLLECTIONS)) {
      await this.chroma.ensureCollection(collName);
    }

    this.initialized = true;
    console.log(`[MemoryPedia] Initialized (Chroma: ${this.chroma.isAvailable()})`);
  }

  /**
   * Queue a conversation for async processing (summarization + entity extraction)
   * Called after conversation is stored to PostgreSQL
   */
  queueConversation(threadId: string, messages: Array<{ role: string; content: string }>): void {
    if (!this.chroma.isAvailable()) {
      return;
    }

    console.log(`[MemoryPedia] Queued thread for processing: ${threadId}`);
    this.processingQueue.push({ threadId, messages });
    this.processQueue();
  }

  /**
   * Process queued conversations in background
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.processingQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.processingQueue.length > 0) {
      const item = this.processingQueue.shift();

      if (item) {
        try {
          await this.processConversation(item.threadId, item.messages);
        } catch (err) {
          console.warn(`[MemoryPedia] Failed to process ${item.threadId}:`, err);
        }
      }
    }

    this.isProcessing = false;
  }

  /**
   * Process a single conversation using LangGraph-style pipeline
   * Flow: Planner → Extractor → Critic → (Refiner → Critic)* → Consolidator
   */
  private async processConversation(
    threadId: string,
    messages: Array<{ role: string; content: string }>,
  ): Promise<void> {
    console.log(`[MemoryPedia] Processing thread: ${threadId}`);

    // Format conversation for LLM
    const conversationText = messages
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n');

    // Use MemoryGraph for LangGraph-style processing
    if (this.memoryGraph) {
      // Get existing pages for consolidation
      const existingPages = await this.getAllPages();

      this.memoryGraph.setExistingPages(existingPages);

      // Process through the graph
      const result = await this.memoryGraph.process(threadId, conversationText);

      // Store results from graph processing
      await this.storeGraphResults(result);

      console.log(`[MemoryPedia] Graph processing complete: ${threadId} (${result.iterations} refinements, ${result.errors.length} errors)`);
    } else {
      // Fallback to simple processing if graph not available
      await this.processConversationSimple(threadId, conversationText);
    }
  }

  /**
   * Store results from MemoryGraph processing
   */
  private async storeGraphResults(result: MemoryProcessingState): Promise<void> {
    const extraction = result.refinedExtraction || result.extraction;

    if (!extraction) {
      return;
    }

    // Store summary
    const summary: ConversationSummary = {
      threadId:  result.threadId,
      summary:   extraction.summary,
      topics:    extraction.topics,
      entities:  extraction.entities.map(e => e.name),
      timestamp: Date.now(),
    };

    await this.storeSummary(summary);

    // Store entities from consolidation (or extraction if consolidation failed)
    if (result.consolidation) {
      for (const entity of result.consolidation.mergedEntities) {
        if (entity.mergedWith) {
          // Update existing page
          const existing = await this.getPage(entity.mergedWith);

          if (existing) {
            await this.updatePage(existing, entity.description, result.threadId);
          }
        } else {
          // Create new page
          await this.createPage({
            pageId:         entity.pageId,
            title:          entity.name,
            pageType:       entity.type,
            content:        entity.description,
            relatedThreads: [result.threadId],
            lastUpdated:    Date.now(),
          });
        }
      }

      // Store associations (future: could create relationship pages)
      if (result.consolidation.associations.length > 0) {
        console.log(`[MemoryPedia] Found ${result.consolidation.associations.length} entity associations`);
      }
    } else {
      // Fallback: store entities directly from extraction
      for (const entity of extraction.entities) {
        await this.upsertPage(
          { name: entity.name, type: entity.type, description: entity.description },
          result.threadId,
        );
      }
    }
  }

  /**
   * Fallback simple processing (no graph)
   */
  private async processConversationSimple(threadId: string, conversationText: string): Promise<void> {
    // Generate summary
    const summary = await this.summarizeConversation(conversationText, threadId);

    if (summary) {
      await this.storeSummary(summary);
    }

    // Extract and store entities
    const extracted = await this.extractEntities(conversationText);

    if (extracted) {
      for (const entity of extracted.entities) {
        await this.upsertPage(entity, threadId);
      }
    }

    console.log(`[MemoryPedia] Simple processing complete: ${threadId}`);
  }

  /**
   * Get all existing pages for consolidation
   */
  private async getAllPages(): Promise<Array<{ pageId: string; title: string; type: string }>> {
    if (!this.chroma.isAvailable()) {
      return [];
    }

    try {
      const data = await this.chroma.get(COLLECTIONS.PAGES, undefined, {
        limit:   1000,
        include: ['metadatas', 'documents'],
      });

      if (!data) {
        return [];
      }

      const pages: Array<{ pageId: string; title: string; type: string }> = [];

      if (data.ids) {
        for (let i = 0; i < data.ids.length; i++) {
          const metadata = data.metadatas?.[i] || {};

          pages.push({
            pageId: data.ids[i],
            title:  String(metadata.title || data.ids[i]),
            type:   String(metadata.pageType || 'entity'),
          });
        }
      }

      return pages;
    } catch {
      return [];
    }
  }

  /**
   * Use LLM to summarize a conversation
   */
  private async summarizeConversation(
    conversationText: string,
    threadId: string,
  ): Promise<ConversationSummary | null> {
    if (!this.llmService) {
      return null;
    }

    const prompt = `Summarize this conversation concisely. Extract the main topics and any named entities (people, projects, technologies, etc).

Conversation:
${conversationText}

Respond in JSON only:
{
  "summary": "2-3 sentence summary of what was discussed and accomplished",
  "topics": ["topic1", "topic2"],
  "entities": ["entity1", "entity2"]
}`;

    try {
      const content = await this.llmService.generate(prompt) || '';

      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        return null;
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        threadId,
        summary:   parsed.summary || '',
        topics:    parsed.topics || [],
        entities:  parsed.entities || [],
        timestamp: Date.now(),
      };
    } catch (err) {
      console.warn('[MemoryPedia] Summarization failed:', err);

      return null;
    }
  }

  /**
   * Use LLM to extract entities that should become pages
   */
  private async extractEntities(conversationText: string): Promise<ExtractedEntities | null> {
    if (!this.llmService) {
      return null;
    }

    const prompt = `Analyze this conversation and extract important entities that should be remembered long-term.

Choose the most appropriate type for each entity. Common types include (but are not limited to):
- project: Named projects, repositories, applications
- person: People mentioned by name
- company: Companies, organizations, teams
- technology: Programming languages, frameworks, libraries, tools
- concept: Technical concepts, design patterns, architectures
- workflow: Processes, procedures, pipelines
- configuration: Settings, configs, environment setups
- api: APIs, endpoints, services
- database: Databases, schemas, data stores
- infrastructure: Servers, clusters, deployments
- file: Important files, configs, scripts
- command: CLI commands, scripts, shortcuts
- error: Known errors, bugs, issues
- solution: Fixes, workarounds, solutions
- preference: User preferences, coding styles
- location: Paths, directories, URLs
- event: Meetings, deadlines, milestones
- resource: Documentation, links, references

You may use any type that best describes the entity - you are not limited to this list.

Conversation:
${conversationText}

Respond in JSON only. Only include entities worth remembering (not generic terms):
{
  "entities": [
    { "name": "Entity Name", "type": "appropriate_type", "description": "Brief description of what this is and why it matters" }
  ],
  "topics": ["general topic tags"]
}

If nothing notable to extract, respond: { "entities": [], "topics": [] }`;

    try {
      const content = await this.llmService.generate(prompt) || '';

      const jsonMatch = content.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        return null;
      }

      return JSON.parse(jsonMatch[0]);
    } catch (err) {
      console.warn('[MemoryPedia] Entity extraction failed:', err);

      return null;
    }
  }

  /**
   * Store a conversation summary in Chroma
   */
  private async storeSummary(summary: ConversationSummary): Promise<void> {
    const success = await this.chroma.add(
      COLLECTIONS.SUMMARIES,
      [summary.threadId],
      [summary.summary],
      [{
        threadId:  summary.threadId,
        topics:    summary.topics.join(','),
        entities:  summary.entities.join(','),
        timestamp: summary.timestamp,
      }],
    );

    if (success) {
      console.log(`[MemoryPedia] Stored summary for: ${summary.threadId}`);
    }
  }

  /**
   * Create or update a MemoryPedia page for an entity
   */
  private async upsertPage(
    entity: { name: string; type: string; description: string },
    threadId: string,
  ): Promise<void> {
    const pageId = this.normalizePageId(entity.name);

    // Check if page exists
    const existing = await this.getPage(pageId);

    if (existing) {
      // Update existing page with new info
      await this.updatePage(existing, entity.description, threadId);
    } else {
      // Create new page
      await this.createPage({
        pageId,
        title:          entity.name,
        pageType:       entity.type,
        content:        entity.description,
        relatedThreads: [threadId],
        lastUpdated:    Date.now(),
      });
    }
  }

  private normalizePageId(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  }

  private async getPage(pageId: string): Promise<MemoryPage | null> {
    try {
      const data = await this.chroma.get(COLLECTIONS.PAGES, [pageId]);

      if (!data || !data.ids || data.ids.length === 0) {
        return null;
      }

      const metadata = data.metadatas?.[0] || {};

      return {
        pageId,
        title:          String(metadata.title || pageId),
        pageType:       String(metadata.pageType || 'entity'),
        content:        data.documents?.[0] || '',
        relatedThreads: String(metadata.relatedThreads || '').split(',').filter(Boolean),
        lastUpdated:    Number(metadata.lastUpdated) || Date.now(),
      };
    } catch {
      return null;
    }
  }

  private async createPage(page: MemoryPage): Promise<void> {
    const success = await this.chroma.add(
      COLLECTIONS.PAGES,
      [page.pageId],
      [page.content],
      [{
        title:          page.title,
        pageType:       page.pageType,
        relatedThreads: page.relatedThreads.join(','),
        lastUpdated:    page.lastUpdated,
      }],
    );

    if (success) {
      console.log(`[MemoryPedia] Created page: ${page.title}`);
    }
  }

  private async updatePage(existing: MemoryPage, newInfo: string, threadId: string): Promise<void> {
    // Merge new info with existing content
    const updatedContent = await this.mergePageContent(existing.content, newInfo);
    const relatedThreads = [...new Set([...existing.relatedThreads, threadId])];

    const success = await this.chroma.upsert(
      COLLECTIONS.PAGES,
      [existing.pageId],
      [updatedContent],
      [{
        title:          existing.title,
        pageType:       existing.pageType,
        relatedThreads: relatedThreads.join(','),
        lastUpdated:    Date.now(),
      }],
    );

    if (success) {
      console.log(`[MemoryPedia] Updated page: ${existing.title}`);
    }
  }

  private async mergePageContent(existing: string, newInfo: string): Promise<string> {
    if (!this.llmService) {
      return `${existing}\n\nUpdate: ${newInfo}`;
    }

    const prompt = `Merge this new information into the existing page content. Keep it concise and well-organized.

Existing content:
${existing}

New information:
${newInfo}

Respond with the merged content only (no JSON, no explanation):`;

    try {
      const content = await this.llmService.generate(prompt);

      return content || existing;
    } catch {
      return `${existing}\n\nUpdate: ${newInfo}`;
    }
  }

  // ============ PUBLIC SEARCH METHODS ============

  /**
   * Search conversation summaries by semantic query
   */
  async searchSummaries(query: string, limit = 5): Promise<Array<{ threadId: string; summary: string; score: number }>> {
    if (!this.chroma.isAvailable()) {
      return [];
    }

    try {
      const data = await this.chroma.query(COLLECTIONS.SUMMARIES, [query], limit);

      if (!data) {
        return [];
      }

      const results: Array<{ threadId: string; summary: string; score: number }> = [];

      if (data.ids?.[0]) {
        for (let i = 0; i < data.ids[0].length; i++) {
          results.push({
            threadId: data.ids[0][i],
            summary:  data.documents?.[0]?.[i] || '',
            score:    data.distances?.[0]?.[i] || 0,
          });
        }
      }

      return results;
    } catch {
      return [];
    }
  }

  /**
   * Search MemoryPedia pages by semantic query
   */
  async searchPages(query: string, limit = 5): Promise<Array<{ pageId: string; title: string; content: string; pageType: string }>> {
    if (!this.chroma.isAvailable()) {
      return [];
    }

    try {
      const data = await this.chroma.query(COLLECTIONS.PAGES, [query], limit);

      if (!data) {
        return [];
      }

      const results: Array<{ pageId: string; title: string; content: string; pageType: string }> = [];

      if (data.ids?.[0]) {
        for (let i = 0; i < data.ids[0].length; i++) {
          const metadata = data.metadatas?.[0]?.[i] || {};

          results.push({
            pageId:   data.ids[0][i],
            title:    String(metadata.title || data.ids[0][i]),
            content:  data.documents?.[0]?.[i] || '',
            pageType: String(metadata.pageType || 'entity'),
          });
        }
      }

      return results;
    } catch {
      return [];
    }
  }

  /**
   * Get thread IDs related to a topic or entity
   */
  async findRelatedThreads(query: string, limit = 10): Promise<string[]> {
    const summaries = await this.searchSummaries(query, limit);

    return summaries.map(s => s.threadId);
  }

  /**
   * Get a specific page by ID
   */
  async getPageById(pageId: string): Promise<MemoryPage | null> {
    return this.getPage(pageId);
  }

  /**
   * Get context for a new conversation based on query
   */
  async getContextForQuery(query: string): Promise<string> {
    const [summaries, pages] = await Promise.all([
      this.searchSummaries(query, 3),
      this.searchPages(query, 3),
    ]);

    const contextParts: string[] = [];

    if (pages.length > 0) {
      contextParts.push('Relevant knowledge:');
      for (const page of pages) {
        contextParts.push(`- ${page.title}: ${page.content}`);
      }
    }

    if (summaries.length > 0) {
      contextParts.push('\nRelated past conversations:');
      for (const summary of summaries) {
        contextParts.push(`- [${summary.threadId}]: ${summary.summary}`);
      }
    }

    return contextParts.join('\n');
  }
}
