import { ChromaClient as BaseChromaClient, Metadata, Where, EmbeddingFunction } from 'chromadb';

// Use same connection details as ChromaService
const CHROMA_BASE = 'http://127.0.0.1:30115';

// Simple embedding function similar to ChromaService
class SimpleEmbeddingFunction implements EmbeddingFunction {
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

  async generate(texts: string[]): Promise<number[][]> {
    return texts.map(text => this.simpleEmbed(text));
  }
}

class ChromaClient {
  private client: BaseChromaClient;
  private embeddingFunction: SimpleEmbeddingFunction;

  constructor() {
    this.client = new BaseChromaClient({
      path: CHROMA_BASE
    });
    
    // Initialize simple embedding function
    this.embeddingFunction = new SimpleEmbeddingFunction();
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
      return await this.client.getOrCreateCollection({ 
        name,
        embeddingFunction: this.embeddingFunction
      });
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
        metadatas,
        embeddings: await this.embeddingFunction.generate(documents)
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
      const collection = await this.getOrCreateCollection(collectionName);
      return await collection.query({
        queryTexts,
        queryEmbeddings: await this.embeddingFunction.generate(queryTexts),
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
      const collection = await this.getOrCreateCollection(collectionName);
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
      const collection = await this.getOrCreateCollection(collectionName);
      const updateData: any = { ids };
      
      if (documents) {
        updateData.documents = documents;
        updateData.embeddings = await this.embeddingFunction.generate(documents);
      }
      
      if (metadatas) {
        updateData.metadatas = metadatas;
      }
      
      return await collection.update(updateData);
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
