// src/models/Summary.ts
// Chroma model for conversation_summaries collection
// Links thread_id to conversation table, searchable by topics/entities

import { ChromaBaseModel } from '../ChromaBaseModel';

export class Summary extends ChromaBaseModel {
  protected collectionName = 'conversation_summaries';
  protected idField = 'threadId';

  protected fillable = [
    'threadId',
    'summary',
    'topics',
    'entities',
    'timestamp',
    'conversationId', // optional foreign key to conversations.id
  ];

  protected required = [
    'threadId',
    'summary',
    'topics',
    'timestamp',
  ];

  protected defaults = {
    topics: [],
    entities: [],
    conversationId: null,
  };

  // Convenience methods

  /** Search summaries by topic/entity */
  static async searchByTopicOrEntity(
    query: string, 
    limit = 5
  ): Promise<Summary[]> {
    const filter = {
      $or: [
        { topics: { $contains: query } },
        { entities: { $contains: query } }
      ]
    };
    return this.search(query, limit, filter);
  }

  /** Get summary for specific thread */
  static async findByThread(threadId: string): Promise<Summary | null> {
    return this.find(threadId);
  }

  /** Create summary from conversation data */
  static async createFromConversation(
    threadId: string,
    summaryText: string,
    topics: string[],
    entities: string[],
    conversationId?: number
  ): Promise<Summary> {
    const summaryDoc = `${summaryText}\n\nTopics: ${topics.join(', ')}\nEntities: ${entities.join(', ')}`;
    
    const summary = new Summary();
    summary.fill({
      threadId,
      summary: summaryDoc,
      topics,
      entities,
      timestamp: Date.now(),
      conversationId,
    });

    await summary.save();
    return summary;
  }

  // Getters
  get summary(): string | undefined { return this.attributes.summary; }
  get topics(): string[] { return this.attributes.topics ?? []; }
  get entities(): string[] { return this.attributes.entities ?? []; }
  get timestamp(): number | undefined { return this.attributes.timestamp; }
}