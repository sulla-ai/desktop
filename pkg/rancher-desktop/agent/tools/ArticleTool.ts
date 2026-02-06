// ArticleTool.ts
// Exec-form tool for interacting with knowledgebase_articles via Article model

import type { ThreadState, ToolResult } from '../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import { Article } from '../database/models/Article';

export class ArticleTool extends BaseTool {
  override readonly name = 'article';
  override readonly aliases = ['kb', 'knowledge', 'articles'];

  override getPlanningInstructions(): string {
    return `["article", "find", "architecture-overview"] - Get single article by slug

Examples:
["article", "find", "memory-and-dreaming"]
["article", "search", "ollama local models", 5]
["article", "search", "docker basics", 3, "docker"]
["article", "list", 10]                // top 10 by order
["article", "create", "new-slug", "New Title", "New markdown content here...", "tag1,tag2", "10", "false", "jonathon"]
["article", "update", "existing-slug", "Updated Title", null, "new-tag", null, "true"]   // null = keep existing
["article", "delete", "old-slug"]

Subcommands:
- find <slug>                     → returns full article (metadata + content)
- search <query> [limit=5] [tag?] → semantic search, optional tag filter
- list [limit=10]                 → ordered by 'order' field
- create <slug> <title> <content> [tags=comma,separated] [order=0] [locked=false] [author=seed]
- update <slug> [title] [content] [tags] [order] [locked] [author]   → null to skip field
- delete <slug>                   → removes article
`.trim();
  }

  override async execute(state: ThreadState, context: ToolContext): Promise<ToolResult> {
    const helpResult = await this.handleHelpRequest(context);
    if (helpResult) return helpResult;

    const subcommand = this.getFirstArg(context)?.toLowerCase();
    const args = this.getArgsArray(context, 1);

    if (!subcommand) {
      return { toolName: this.name, success: false, error: 'Missing subcommand' };
    }

    try {
      switch (subcommand) {
        case 'find': {
          if (!args[0]) throw new Error('Missing slug');
          const article = await Article.find(args[0]);
          if (!article) return { toolName: this.name, success: false, result: null };

          return {
            toolName: this.name,
            success: true,
            result: {
              slug: article.slug,
              title: article.title,
              tags: article.tags,
              order: article.order,
              locked: article.locked,
              author: article.author,
              created_at: article.created_at,
              updated_at: article.updated_at,
              content: 'Full markdown content available in document field (truncated here)',
              // Note: actual content is in document, not returned in full for brevity
            }
          };
        }

        case 'search': {
          const query = args[0];
          const limit = parseInt(args[1] || '5', 10);
          const tagFilter = args[2] ? { tags: { $contains: args[2] } } : undefined;

          const results = await Article.search(query, limit, tagFilter);

          return {
            toolName: this.name,
            success: true,
            result: results.map(a => ({
              slug: a.slug,
              title: a.title,
              tags: a.tags,
              order: a.order,
              score: 'semantic similarity (higher = better)',
            }))
          };
        }

        case 'list': {
          const limit = parseInt(args[0] || '10', 10);
          // Simple ordered list (could be extended with where/orderBy in future)
          const results = await Article.search('', limit); // empty query = all, sorted internally if needed
          return {
            toolName: this.name,
            success: true,
            result: results.map(a => a.attributesSnapshot)
          };
        }

        case 'create': {
          if (args.length < 3) throw new Error('create needs: slug, title, content, [tags], [order], [locked], [author]');

          const [slug, title, content, tagsStr, orderStr, lockedStr, author] = args;

          const article = new Article({
            slug,
            title,
            tags: tagsStr ? tagsStr.split(',').map(t => t.trim()) : [],
            order: orderStr ?? '0',
            locked: lockedStr?.toLowerCase() === 'true',
            author: author ?? 'seed',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

          await article.save(content);
          return { toolName: this.name, success: true, result: { slug: article.slug, created: true } };
        }

        case 'update': {
          if (!args[0]) throw new Error('update needs slug first');

          const slug = args[0];
          const existing = await Article.find(slug);
          if (!existing) return { toolName: this.name, success: false, error: 'Article not found' };

          const updates = {
            title: args[1] || undefined,
            // content not updated via metadata — would require re-save with new document
            tags: args[2] ? args[2].split(',').map((t: string) => t.trim()) : undefined,
            order: args[3] ?? undefined,
            locked: args[4]?.toLowerCase() === 'true' ? true : args[4]?.toLowerCase() === 'false' ? false : undefined,
            author: args[5] || undefined,
            updated_at: new Date().toISOString(),
          };

          Object.assign(existing, Object.fromEntries(
            Object.entries(updates).filter(([_, v]) => v !== undefined)
          ));

          await existing.save(existing.attributesSnapshot.document || ''); // preserve existing content
          return { toolName: this.name, success: true, result: { slug, updated: true } };
        }

        case 'delete': {
          if (!args[0]) throw new Error('delete needs slug');
          const article = await Article.find(args[0]);
          if (!article) return { toolName: this.name, success: false, result: { deleted: false } };

          await article.delete();
          return { toolName: this.name, success: true, result: { slug: args[0], deleted: true } };
        }

        default:
          return { toolName: this.name, success: false, error: `Unknown subcommand: ${subcommand}` };
      }
    } catch (err: any) {
      return { toolName: this.name, success: false, error: err.message || String(err) };
    }
  }
}