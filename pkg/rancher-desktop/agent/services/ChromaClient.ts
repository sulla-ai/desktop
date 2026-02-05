import { ChromaClient as BaseChromaClient, Metadata, Where } from 'chromadb';

// Use same connection details as ChromaService
const CHROMA_BASE = 'http://127.0.0.1:30115';

class ChromaClient {
  private client: BaseChromaClient;

  constructor() {
    this.client = new BaseChromaClient({
      path: CHROMA_BASE
    });
  }

  /**
   * Get the underlying Chroma client instance
   */
  getClient(): BaseChromaClient {
    return this.client;
  }

  /**
   * Initialize the client connection
   */
  async initialize(): Promise<boolean> {
    try {
      // Test connection by getting version
      await this.client.heartbeat();
      return true;
    } catch (error) {
      console.error('Failed to connect to Chroma:', error);
      return false;
    }
  }

  /**
   * Get a collection by name
   */
  async getCollection(name: string) {
    try {
      return await this.client.getCollection({ name });
    } catch (error) {
      console.error(`Failed to get collection ${name}:`, error);
      throw error;
    }
  }

  /**
   * Create or get a collection
   */
  async getOrCreateCollection(name: string) {
    try {
      return await this.client.getOrCreateCollection({ name });
    } catch (error) {
      console.error(`Failed to get or create collection ${name}:`, error);
      throw error;
    }
  }

  /**
   * List all collections
   */
  async listCollections() {
    try {
      return await this.client.listCollections();
    } catch (error) {
      console.error('Failed to list collections:', error);
      throw error;
    }
  }

  /**
   * Delete a collection
   */
  async deleteCollection(name: string) {
    try {
      return await this.client.deleteCollection({ name });
    } catch (error) {
      console.error(`Failed to delete collection ${name}:`, error);
      throw error;
    }
  }

  /**
   * Add documents to a collection
   */
  async addDocuments(collectionName: string, documents: string[], metadatas?: Metadata[], ids?: string[]) {
    try {
      const collection = await this.getOrCreateCollection(collectionName);
      return await collection.add({
        ids: ids || documents.map((_, i) => `doc_${Date.now()}_${i}`),
        documents,
        metadatas
      });
    } catch (error) {
      console.error(`Failed to add documents to ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Query documents in a collection
   */
  async queryDocuments(collectionName: string, queryTexts: string[], nResults = 5, where?: Where) {
    try {
      const collection = await this.getCollection(collectionName);
      return await collection.query({
        queryTexts,
        nResults,
        where
      });
    } catch (error) {
      console.error(`Failed to query collection ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Get documents by IDs from a collection
   */
  async getDocuments(collectionName: string, ids: string[], where?: Where) {
    try {
      const collection = await this.getCollection(collectionName);
      return await collection.get({
        ids,
        where
      });
    } catch (error) {
      console.error(`Failed to get documents from ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Update documents in a collection
   */
  async updateDocuments(collectionName: string, ids: string[], documents?: string[], metadatas?: Metadata[]) {
    try {
      const collection = await this.getCollection(collectionName);
      return await collection.update({
        ids,
        documents,
        metadatas
      });
    } catch (error) {
      console.error(`Failed to update documents in ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Delete documents from a collection
   */
  async deleteDocuments(collectionName: string, ids?: string[], where?: Where) {
    try {
      const collection = await this.getCollection(collectionName);
      return await collection.delete({
        ids,
        where
      });
    } catch (error) {
      console.error(`Failed to delete documents from ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Count documents in a collection
   */
  async countDocuments(collectionName: string, where?: Where) {
    try {
      const collection = await this.getCollection(collectionName);
      if (where) {
        // If where clause is provided, get filtered results and count them
        const results = await collection.get({ where });
        return results.ids.length;
      } else {
        // If no filter, use count() method
        return await collection.count();
      }
    } catch (error) {
      console.error(`Failed to count documents in ${collectionName}:`, error);
      throw error;
    }
  }
}

// Export singleton instance
export const chromaClient = new ChromaClient();
export { ChromaClient };
