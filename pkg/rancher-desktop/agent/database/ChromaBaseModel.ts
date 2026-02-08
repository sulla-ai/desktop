// src/database/ChromaBaseModel.ts
import { chromaClient } from './ChromaClient'; // adjust path

interface ChromaDocument {
  id: string;
  document: string;
  metadata: Record<string, any>;
}

export abstract class ChromaBaseModel {
  protected abstract collectionName: string;
  protected abstract idField: string; // e.g. 'slug'

  // To be defined by child classes
  protected abstract fillable: string[];        // allowed fields
  protected abstract required: string[];        // must exist
  protected abstract defaults: Record<string, any>; // default values

  public attributes: Record<string, any> = {};

  constructor() {
  }

  public fill(data: Record<string, any>) {
    for (const [key, value] of Object.entries(data)) {
      if (this.fillable.includes(key)) {
        this.attributes[key] = value;
        // Only set as property if there's no getter defined
        const descriptor = Object.getOwnPropertyDescriptor(this.constructor.prototype, key);
        if (!descriptor || descriptor.get === undefined) {
          (this as any)[key] = value;
        }
      }
    }
  }

  // Static factory + save in one call
  static async create<T extends ChromaBaseModel>(
    this: new (data?: Record<string, any>) => T,
    attributes: Record<string, any>
  ): Promise<T> {
    const instance = new this();
    instance.fill(attributes);
    await instance.save();

    return instance;
  }

  protected validateAndApplyDefaults(): void {
    // Apply defaults for missing optional fields
    for (const [key, value] of Object.entries(this.defaults)) {
      if (!(key in this.attributes)) {
        this.attributes[key] = value;
        // Also set as property for TypeScript access
        (this as any)[key] = value;
      }
    }

    // Check required fields
    for (const field of this.required) {
      if (!(field in this.attributes) || this.attributes[field] === undefined) {
        throw new Error(`Missing required field '${field}' for ${this.constructor.name}`);
      }
    }
  }

  // ────────────────────────────────────────────────
  // Core persistence
  // ────────────────────────────────────────────────

  async save(): Promise<void> {
    this.validateAndApplyDefaults();

    const id = this.attributes[this.idField];
    if (!id) {
      throw new Error(`Missing '${this.idField}' for save operation`);
    }

    const document = this.attributes.document;
    
    // Guard against undefined/null document
    if (document == null) {
      console.warn(`[ChromaBaseModel] Skipping save - no document content for ${this.constructor.name} with id ${id}`);
      return;
    }

    // Create safe metadata by flattening arrays to strings
    const safeMetadata = { ...this.attributes };
    delete safeMetadata.document;

    // Convert arrays to comma-separated strings for Chroma compatibility
    for (const [key, value] of Object.entries(safeMetadata)) {
      if (Array.isArray(value)) {
        safeMetadata[key] = value.join(', ');
      } else if (typeof value === 'object' && value !== null) {
        // Convert objects to JSON strings if needed
        safeMetadata[key] = JSON.stringify(value);
      } else if (value === undefined) {
        // Convert undefined to explicit null for Chroma
        safeMetadata[key] = null;
      } else if (typeof value === 'number') {
        // Force ALL numbers → strings to avoid enum variant mismatches
        safeMetadata[key] = String(value);
      }
      // Keep strings and booleans as-is, null stays as null
    }

    // Debug log to verify safe metadata
    console.log(`[ChromaBaseModel] Saving to ${this.collectionName} with metadata:`, JSON.stringify(safeMetadata, null, 2));

    await chromaClient.addDocuments(
      this.collectionName,
      Array.isArray(document) ? document : [document],  // Handle both string and array
      [safeMetadata],  // Use safeMetadata with flattened arrays
      [id]
    );
  }

  // ────────────────────────────────────────────────
  // Static helpers
  // ────────────────────────────────────────────────

  static async find<T extends ChromaBaseModel>(
    this: new (data?: Record<string, any>) => T,
    id: string
  ): Promise<T | null> {
    const instance = new this();
    const res = await chromaClient.getDocuments(instance.collectionName, [id]);

    if (!res?.ids?.[0]?.length) return null;

    const doc = {
      id: res.ids[0][0],
      document: res.documents?.[0]?.[0] ?? '',
      metadata: res.metadatas?.[0]?.[0] ?? {},
    };

    const model = new this(doc.metadata);
    // document is separate — model only carries metadata
    return model;
  }

  static async search<T extends ChromaBaseModel>(
    this: new (data?: Record<string, any>) => T,
    query: string,
    limit = 5,
    filter?: Record<string, any>
  ): Promise<T[]> {
    const instance = new this();
    const res = await chromaClient.queryDocuments(
      instance.collectionName,
      [query],
      limit,
      filter
    );

    if (!res?.ids?.[0]?.length) return [];

    return res.ids[0].map((id: string, idx: number) => {
      const metadata = res.metadatas?.[0]?.[idx] ?? {};
      return new this(metadata);
    });
  }

  static async upsertMany<T extends ChromaBaseModel>(
    this: new () => T,
    items: Array<{ document: string; metadata: Record<string, any> }>
  ): Promise<void> {
    const instance = new this();

    const documents = items.map(i => i.document);
    const metadatas = items.map(i => i.metadata);
    const ids = items.map(i => i.metadata[instance.idField]);

    if (ids.some(id => !id)) {
      throw new Error('All items must have idField set');
    }

    await chromaClient.addDocuments(
      instance.collectionName,
      documents,
      metadatas,
      ids
    );
  }

  // ────────────────────────────────────────────────
  // Convenience
  // ────────────────────────────────────────────────

  async delete(): Promise<void> {
    const id = this.attributes[this.idField];
    if (!id) return;

    await chromaClient.deleteDocuments(this.collectionName, [id]);
  }

  get attributesSnapshot(): Readonly<Record<string, any>> {
    return { ...this.attributes };
  }
}