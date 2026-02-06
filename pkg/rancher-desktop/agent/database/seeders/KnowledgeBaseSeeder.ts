// KnowledgeBaseSeeder.ts
// Uses Article model for schema enforcement + upsert
// Called once by DatabaseManager

import { Article } from '../models/Article';
import { seedPedia } from '../../seed_pedia';
import yaml from 'js-yaml';

async function initialize(): Promise<void> {
  console.log('[KB Seeder] Starting...');

  const now = new Date().toISOString();
  const articles: Article[] = [];

  for (const [slug, rawContent] of Object.entries(seedPedia)) {
    if (typeof rawContent !== 'string') continue;

    const fmMatch = rawContent.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
    if (!fmMatch) {
      console.warn(`[KB] No frontmatter in ${slug}`);
      continue;
    }

    let meta: Partial<Record<string, any>>;
    try {
      meta = yaml.load(fmMatch[1]) as any;
    } catch (err) {
      console.warn(`[KB] YAML error in ${slug}: ${err}`);
      continue;
    }

    if (!meta.slug || !meta.title) {
      console.warn(`[KB] Missing slug/title in ${slug}`);
      continue;
    }

    const article = new Article({
      schemaversion: Number(meta.schemaversion) || 1,
      slug: String(meta.slug).trim(),
      title: String(meta.title).trim(),
      tags: Array.isArray(meta.tags) ? meta.tags.map(String).filter(Boolean) : [],
      order: meta.order ?? '0',
      locked: !!meta.locked,
      author: typeof meta.author === 'string' ? meta.author.trim() : 'seed',
      created_at: typeof meta.created_at === 'string' ? meta.created_at : now,
      updated_at: typeof meta.updated_at === 'string' ? meta.updated_at : now,
    });

    articles.push(article);
  }

  if (articles.length === 0) {
    console.log('[KB] No valid articles');
    return;
  }

  for (const article of articles) {
    try {
      await article.save(seedPedia[article.slug as keyof typeof seedPedia] as string);
      console.log(`[KB] Upserted: ${article.slug}`);
    } catch (err) {
      console.error(`[KB] Failed to save ${article.slug}:`, err);
    }
  }

  console.log(`[KB] Seeded ${articles.length} articles`);
}

export { initialize };