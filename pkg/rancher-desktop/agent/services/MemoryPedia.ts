// MemoryPedia - Long-term memory system using Chroma for semantic search
// Stores conversation summaries and wikipedia-style entity pages
// Uses LangGraph-style processing for extraction refinement

import { ChatOllama } from '@langchain/ollama';
import { HumanMessage } from '@langchain/core/messages';
import { MemoryGraph, MemoryProcessingState } from './MemoryGraph';

const CHROMA_BASE = 'http://127.0.0.1:30115';
const OLLAMA_BASE = 'http://127.0.0.1:30114';
const MODEL = 'tinyllama:latest';

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
  private llm: ChatOllama | null = null;
  private memoryGraph: MemoryGraph | null = null;
  private initialized = false;
  private chromaAvailable = false;
  private processingQueue: Array<{ threadId: string; messages: Array<{ role: string; content: string }> }> = [];
  private isProcessing = false;

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log('[MemoryPedia] Initializing...');

    // Initialize LLM
    try {
      this.llm = new ChatOllama({
        baseUrl: OLLAMA_BASE,
        model:   MODEL,
      });
      console.log('[MemoryPedia] LLM initialized');
    } catch (err) {
      console.warn('[MemoryPedia] LLM init failed:', err);
    }

    // Initialize MemoryGraph for LangGraph-style processing
    this.memoryGraph = new MemoryGraph();
    console.log('[MemoryPedia] MemoryGraph initialized');

    // Check Chroma availability and ensure collections exist
    await this.ensureCollections();

    this.initialized = true;
    console.log(`[MemoryPedia] Initialized (Chroma: ${this.chromaAvailable})`);
  }

  private async ensureCollections(): Promise<void> {
    try {
      const res = await fetch(`${CHROMA_BASE}/api/v2/tenants/default_tenant/databases/default_database/collections`, {
        signal: AbortSignal.timeout(2000),
      });

      if (!res.ok) {
        console.warn('[MemoryPedia] Chroma not available');

        return;
      }

      this.chromaAvailable = true;
      const existing = await res.json();
      const existingNames = existing.map((c: { name: string }) => c.name);

      // Create collections if they don't exist
      for (const collName of Object.values(COLLECTIONS)) {
        if (!existingNames.includes(collName)) {
          await this.createCollection(collName);
        }
      }

      console.log('[MemoryPedia] Collections ready');
    } catch (err) {
      console.warn('[MemoryPedia] Chroma check failed:', err);
    }
  }

  private async createCollection(name: string): Promise<void> {
    try {
      const res = await fetch(`${CHROMA_BASE}/api/v2/tenants/default_tenant/databases/default_database/collections`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          name,
          metadata: { 'hnsw:space': 'cosine' },
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (res.ok) {
        console.log(`[MemoryPedia] Created collection: ${name}`);
      }
    } catch (err) {
      console.warn(`[MemoryPedia] Failed to create collection ${name}:`, err);
    }
  }

  /**
   * Queue a conversation for async processing (summarization + entity extraction)
   * Called after conversation is stored to PostgreSQL
   */
  queueConversation(threadId: string, messages: Array<{ role: string; content: string }>): void {
    if (!this.chromaAvailable) {
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
    if (!this.chromaAvailable) {
      return [];
    }

    try {
      const res = await fetch(
        `${CHROMA_BASE}/api/v2/tenants/default_tenant/databases/default_database/collections/${COLLECTIONS.PAGES}/get`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ limit: 1000 }),
          signal:  AbortSignal.timeout(5000),
        },
      );

      if (!res.ok) {
        return [];
      }

      const data = await res.json();
      const pages: Array<{ pageId: string; title: string; type: string }> = [];

      if (data.ids) {
        for (let i = 0; i < data.ids.length; i++) {
          const metadata = data.metadatas?.[i] || {};

          pages.push({
            pageId: data.ids[i],
            title:  metadata.title || data.ids[i],
            type:   metadata.pageType || 'entity',
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
    if (!this.llm) {
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
      const response = await this.llm.invoke([new HumanMessage(prompt)]);
      const content = typeof response.content === 'string' ? response.content : '';

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
    if (!this.llm) {
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
      const response = await this.llm.invoke([new HumanMessage(prompt)]);
      const content = typeof response.content === 'string' ? response.content : '';

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
    try {
      const res = await fetch(
        `${CHROMA_BASE}/api/v2/tenants/default_tenant/databases/default_database/collections/${COLLECTIONS.SUMMARIES}/add`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            ids:       [summary.threadId],
            documents: [summary.summary],
            metadatas: [{
              threadId:  summary.threadId,
              topics:    summary.topics.join(','),
              entities:  summary.entities.join(','),
              timestamp: summary.timestamp,
            }],
          }),
          signal: AbortSignal.timeout(5000),
        },
      );

      if (res.ok) {
        console.log(`[MemoryPedia] Stored summary for: ${summary.threadId}`);
      }
    } catch (err) {
      console.warn('[MemoryPedia] Failed to store summary:', err);
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
      const res = await fetch(
        `${CHROMA_BASE}/api/v2/tenants/default_tenant/databases/default_database/collections/${COLLECTIONS.PAGES}/get`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ ids: [pageId] }),
          signal:  AbortSignal.timeout(5000),
        },
      );

      if (!res.ok) {
        return null;
      }

      const data = await res.json();

      if (!data.ids || data.ids.length === 0) {
        return null;
      }

      const metadata = data.metadatas?.[0] || {};

      return {
        pageId,
        title:          metadata.title || pageId,
        pageType:       metadata.pageType || 'entity',
        content:        data.documents?.[0] || '',
        relatedThreads: (metadata.relatedThreads || '').split(',').filter(Boolean),
        lastUpdated:    metadata.lastUpdated || Date.now(),
      };
    } catch {
      return null;
    }
  }

  private async createPage(page: MemoryPage): Promise<void> {
    try {
      const res = await fetch(
        `${CHROMA_BASE}/api/v2/tenants/default_tenant/databases/default_database/collections/${COLLECTIONS.PAGES}/add`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            ids:       [page.pageId],
            documents: [page.content],
            metadatas: [{
              title:          page.title,
              pageType:       page.pageType,
              relatedThreads: page.relatedThreads.join(','),
              lastUpdated:    page.lastUpdated,
            }],
          }),
          signal: AbortSignal.timeout(5000),
        },
      );

      if (res.ok) {
        console.log(`[MemoryPedia] Created page: ${page.title}`);
      }
    } catch (err) {
      console.warn(`[MemoryPedia] Failed to create page ${page.pageId}:`, err);
    }
  }

  private async updatePage(existing: MemoryPage, newInfo: string, threadId: string): Promise<void> {
    // Merge new info with existing content
    const updatedContent = await this.mergePageContent(existing.content, newInfo);
    const relatedThreads = [...new Set([...existing.relatedThreads, threadId])];

    try {
      // Delete old entry
      await fetch(
        `${CHROMA_BASE}/api/v2/tenants/default_tenant/databases/default_database/collections/${COLLECTIONS.PAGES}/delete`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ ids: [existing.pageId] }),
          signal:  AbortSignal.timeout(5000),
        },
      );

      // Add updated entry
      await fetch(
        `${CHROMA_BASE}/api/v2/tenants/default_tenant/databases/default_database/collections/${COLLECTIONS.PAGES}/add`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            ids:       [existing.pageId],
            documents: [updatedContent],
            metadatas: [{
              title:          existing.title,
              pageType:       existing.pageType,
              relatedThreads: relatedThreads.join(','),
              lastUpdated:    Date.now(),
            }],
          }),
          signal: AbortSignal.timeout(5000),
        },
      );

      console.log(`[MemoryPedia] Updated page: ${existing.title}`);
    } catch (err) {
      console.warn(`[MemoryPedia] Failed to update page ${existing.pageId}:`, err);
    }
  }

  private async mergePageContent(existing: string, newInfo: string): Promise<string> {
    if (!this.llm) {
      return `${existing}\n\nUpdate: ${newInfo}`;
    }

    const prompt = `Merge this new information into the existing page content. Keep it concise and well-organized.

Existing content:
${existing}

New information:
${newInfo}

Respond with the merged content only (no JSON, no explanation):`;

    try {
      const response = await this.llm.invoke([new HumanMessage(prompt)]);

      return typeof response.content === 'string' ? response.content : existing;
    } catch {
      return `${existing}\n\nUpdate: ${newInfo}`;
    }
  }

  // ============ PUBLIC SEARCH METHODS ============

  /**
   * Search conversation summaries by semantic query
   */
  async searchSummaries(query: string, limit = 5): Promise<Array<{ threadId: string; summary: string; score: number }>> {
    if (!this.chromaAvailable) {
      return [];
    }

    try {
      const res = await fetch(
        `${CHROMA_BASE}/api/v2/tenants/default_tenant/databases/default_database/collections/${COLLECTIONS.SUMMARIES}/query`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            query_texts: [query],
            n_results:   limit,
          }),
          signal: AbortSignal.timeout(5000),
        },
      );

      if (!res.ok) {
        return [];
      }

      const data = await res.json();
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
    if (!this.chromaAvailable) {
      return [];
    }

    try {
      const res = await fetch(
        `${CHROMA_BASE}/api/v2/tenants/default_tenant/databases/default_database/collections/${COLLECTIONS.PAGES}/query`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            query_texts: [query],
            n_results:   limit,
          }),
          signal: AbortSignal.timeout(5000),
        },
      );

      if (!res.ok) {
        return [];
      }

      const data = await res.json();
      const results: Array<{ pageId: string; title: string; content: string; pageType: string }> = [];

      if (data.ids?.[0]) {
        for (let i = 0; i < data.ids[0].length; i++) {
          const metadata = data.metadatas?.[0]?.[i] || {};

          results.push({
            pageId:   data.ids[0][i],
            title:    metadata.title || data.ids[0][i],
            content:  data.documents?.[0]?.[i] || '',
            pageType: metadata.pageType || 'entity',
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
