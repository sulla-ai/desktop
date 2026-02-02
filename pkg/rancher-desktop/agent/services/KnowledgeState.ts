// KnowledgeGraph Types - Shared types for KnowledgeGraph processing
// The KnowledgeGraph uses ThreadState.metadata for state, not a separate class

export interface KnowledgePageSection {
  section_id: string;
  title: string;
  content: string;
  order: number;
}

export interface KnowledgeFinalPage {
  schemaversion: 1;
  slug: string;
  title: string;
  tags: string[];
  order: number;
  locked?: boolean;
  author?: string;
  created_at?: string;
  updated_at?: string;
  sections: KnowledgePageSection[];
  related_slugs?: string[];
}

export interface KnowledgeGoal {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'done';
}
