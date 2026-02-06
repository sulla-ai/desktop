// src/models/Article.ts

import { ChromaBaseModel } from '../ChromaBaseModel';

export class Article extends ChromaBaseModel {
  protected collectionName = 'knowledgebase_articles';
  protected idField = 'slug';

  // Explicit property definitions for TypeScript
  public schemaversion?: number;
  public slug?: string;
  public title?: string;
  public tags?: string[];
  public order?: string;
  public locked?: boolean;
  public author?: string;
  public created_at?: string;
  public updated_at?: string;

  protected fillable = [
    'schemaversion',
    'slug',
    'title',
    'tags',
    'order',
    'locked',
    'author',
    'created_at',
    'updated_at',
  ];

  protected required = [
    'schemaversion',
    'slug',
    'title',
    'created_at',
    'updated_at',
  ];

  protected defaults = {
    schemaversion: 1,
    tags: [],
    order: '0',
    locked: false,
    author: 'seed',
  };
}