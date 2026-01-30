// ChromaService - Centralized ChromaDB API client
// Handles collection UUID caching and all Chroma operations

const CHROMA_BASE = 'http://127.0.0.1:30115';
const API_PREFIX = `${CHROMA_BASE}/api/v2/tenants/default_tenant/databases/default_database`;

interface ChromaCollection {
  id: string;
  name: string;
}

interface QueryResult {
  ids: string[][];
  documents: string[][];
  metadatas: Array<Array<Record<string, unknown>>>;
  distances: number[][];
}

interface GetResult {
  ids: string[];
  documents: string[];
  metadatas: Array<Record<string, unknown>>;
}

class ChromaServiceClass {
  private collectionIds: Map<string, string> = new Map();
  private initialized = false;
  private available = false;

  private simpleEmbed(text: string, dim = 64): number[] {
    const vec = new Array(dim).fill(0);

    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      const idx = (code + i) % dim;
      vec[idx] += 1;
    }

    // L2 normalize
    let sumSq = 0;
    for (const v of vec) {
      sumSq += v * v;
    }
    const norm = Math.sqrt(sumSq) || 1;

    return vec.map(v => v / norm);
  }

  /**
   * Initialize the service and cache collection IDs
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) {
      return this.available;
    }

    try {
      const res = await fetch(`${API_PREFIX}/collections`, {
        signal: AbortSignal.timeout(3000),
      });

      if (!res.ok) {
        console.warn('[ChromaService] Chroma not available');
        this.initialized = true;
        this.available = false;

        return false;
      }

      const collections: ChromaCollection[] = await res.json();

      for (const coll of collections) {
        this.collectionIds.set(coll.name, coll.id);
      }

      console.log(`[ChromaService] Initialized with ${collections.length} collections`);
      this.initialized = true;
      this.available = true;

      return true;
    } catch (err) {
      console.warn('[ChromaService] Init failed:', err);
      this.initialized = true;
      this.available = false;

      return false;
    }
  }

  /**
   * Check if ChromaDB is available
   */
  isAvailable(): boolean {
    return this.available;
  }

  /**
   * Refresh collection cache
   */
  async refreshCollections(): Promise<string[]> {
    try {
      const res = await fetch(`${API_PREFIX}/collections`, {
        signal: AbortSignal.timeout(2000),
      });

      if (res.ok) {
        const collections: ChromaCollection[] = await res.json();

        this.collectionIds.clear();
        for (const coll of collections) {
          this.collectionIds.set(coll.name, coll.id);
        }
        this.available = true;

        return collections.map(c => c.name);
      }
    } catch {
      // Keep existing cache
    }

    return Array.from(this.collectionIds.keys());
  }

  /**
   * Get collection names
   */
  getCollectionNames(): string[] {
    return Array.from(this.collectionIds.keys());
  }

  /**
   * Get collection UUID by name
   */
  getCollectionId(name: string): string | null {
    return this.collectionIds.get(name) || null;
  }

  /**
   * Create a collection if it doesn't exist
   */
  async ensureCollection(name: string): Promise<string | null> {
    // Check if already cached
    if (this.collectionIds.has(name)) {
      return this.collectionIds.get(name)!;
    }

    try {
      const res = await fetch(`${API_PREFIX}/collections`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          name,
          metadata: { 'hnsw:space': 'cosine' },
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (res.ok) {
        const data = await res.json();

        if (data.id) {
          this.collectionIds.set(name, data.id);
          console.log(`[ChromaService] Created collection: ${name}`);

          return data.id;
        }
      }
    } catch (err) {
      console.warn(`[ChromaService] Failed to create collection ${name}:`, err);
    }

    return null;
  }

  /**
   * Get document count in a collection
   */
  async count(collectionName: string): Promise<number> {
    const collId = this.collectionIds.get(collectionName);

    if (!collId) {
      return 0;
    }

    try {
      const res = await fetch(`${API_PREFIX}/collections/${collId}/count`, {
        signal: AbortSignal.timeout(3000),
      });

      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Return 0 on error
    }

    return 0;
  }

  /**
   * Add documents to a collection
   */
  async add(
    collectionName: string,
    ids: string[],
    documents: string[],
    metadatas: Array<Record<string, unknown>>,
  ): Promise<boolean> {
    const collId = this.collectionIds.get(collectionName);

    if (!collId) {
      console.warn(`[ChromaService] Collection not found: ${collectionName}`);

      return false;
    }

    try {
      if (ids.length !== documents.length || ids.length !== metadatas.length) {
        console.warn(
          `[ChromaService] Add payload length mismatch for ${collectionName}: ids=${ids.length}, documents=${documents.length}, metadatas=${metadatas.length}`,
        );

        return false;
      }

      const embeddings = documents.map(d => this.simpleEmbed(d));

      const res = await fetch(`${API_PREFIX}/collections/${collId}/add`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ids, documents, metadatas, embeddings }),
        signal:  AbortSignal.timeout(5000),
      });

      if (!res.ok) {
        let errorText = '';

        try {
          errorText = await res.text();
        } catch {
          // ignore
        }

        console.warn(`[ChromaService] Add failed (${res.status}) for ${collectionName}:`, errorText);

        return false;
      }

      return true;
    } catch (err) {
      console.warn(`[ChromaService] Add failed:`, err);

      return false;
    }
  }

  /**
   * Get documents by IDs
   */
  async get(
    collectionName: string,
    ids?: string[],
    options?: { limit?: number; include?: string[] },
  ): Promise<GetResult | null> {
    const collId = this.collectionIds.get(collectionName);

    if (!collId) {
      return null;
    }

    try {
      const body: Record<string, unknown> = {};

      if (ids) {
        body.ids = ids;
      }
      if (options?.limit) {
        body.limit = options.limit;
      }
      if (options?.include) {
        body.include = options.include;
      }

      const res = await fetch(`${API_PREFIX}/collections/${collId}/get`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
        signal:  AbortSignal.timeout(5000),
      });

      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Return null on error
    }

    return null;
  }

  /**
   * Query documents by semantic similarity
   */
  async query(
    collectionName: string,
    queryTexts: string[],
    nResults = 5,
    whereClause?: Record<string, unknown>,
  ): Promise<QueryResult | null> {
    const collId = this.collectionIds.get(collectionName);

    if (!collId) {
      console.warn(`[ChromaService] Collection not found for query: ${collectionName}`);

      return null;
    }

    // Check if collection has documents first
    const docCount = await this.count(collectionName);

    if (docCount === 0) {
      return null;
    }

    try {
      const queryEmbeddings = queryTexts.map(t => this.simpleEmbed(t));
      const body: Record<string, unknown> = {
        query_embeddings: queryEmbeddings,
        n_results:        nResults,
      };

      if (whereClause && Object.keys(whereClause).length > 0) {
        body.where = whereClause;
      }

      const res = await fetch(`${API_PREFIX}/collections/${collId}/query`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
        signal:  AbortSignal.timeout(5000),
      });

      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn(`[ChromaService] Query failed:`, err);
    }

    return null;
  }

  /**
   * Delete documents by IDs
   */
  async delete(collectionName: string, ids: string[]): Promise<boolean> {
    const collId = this.collectionIds.get(collectionName);

    if (!collId) {
      return false;
    }

    try {
      const res = await fetch(`${API_PREFIX}/collections/${collId}/delete`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ids }),
        signal:  AbortSignal.timeout(5000),
      });

      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Update documents (delete + add)
   */
  async upsert(
    collectionName: string,
    ids: string[],
    documents: string[],
    metadatas: Array<Record<string, unknown>>,
  ): Promise<boolean> {
    // Delete existing
    await this.delete(collectionName, ids);

    // Add new
    return this.add(collectionName, ids, documents, metadatas);
  }
}

// Singleton instance
let instance: ChromaServiceClass | null = null;

export function getChromaService(): ChromaServiceClass {
  if (!instance) {
    instance = new ChromaServiceClass();
  }

  return instance;
}

export { ChromaServiceClass };
