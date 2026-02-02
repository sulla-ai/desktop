# Sample KnowledgeBase Article (JSON Schema)

This file documents the full JSON schema for a raw Chroma `knowledgebase_articles` document.

```json
{
  "schemaversion": 1,
  "slug": "sample-article-slug",
  "title": "Sample Article Title",
  "tags": ["getting-started", "quick-start", "example"],
  "order": 10,
  "locked": false,
  "author": "Author Name",
  "created_at": "2026-01-15T14:30:00Z",
  "updated_at": "2026-02-01T18:00:00Z",
  "sections": [
    {
      "section_id": "intro",
      "title": "Introduction",
      "content": "One-paragraph description of the page (what this is, when to use it).",
      "order": 1
    },
    {
      "section_id": "purpose",
      "title": "Purpose",
      "content": "- What problem this solves\n- When you should use it",
      "order": 2
    },
    {
      "section_id": "prerequisites",
      "title": "Prerequisites",
      "content": "- Anything required before following this",
      "order": 3
    },
    {
      "section_id": "steps",
      "title": "Steps",
      "content": "1. Do the first thing\n2. Do the second thing\n3. Validate the result",
      "order": 4
    },
    {
      "section_id": "validation",
      "title": "Validation",
      "content": "- Expected output / checks",
      "order": 5
    },
    {
      "section_id": "troubleshooting",
      "title": "Troubleshooting",
      "content": "- Common failure modes and fixes",
      "order": 6
    }
  ],
  "related_slugs": ["related-article-one", "related-article-two"]
}
```

## Field Reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `schemaversion` | number | Yes | Always `1` |
| `slug` | string | Yes | URL-safe kebab-case identifier |
| `title` | string | Yes | Display title |
| `tags` | string[] | Yes | Categories/keywords (first tag = primary category in nav) |
| `order` | number | Yes | Display order (10, 20, 30...) |
| `locked` | boolean | No | Prevent edits if `true` |
| `author` | string | No | Author name |
| `created_at` | string | No | ISO 8601 timestamp |
| `updated_at` | string | No | ISO 8601 timestamp |
| `sections` | object[] | Yes | Array of section objects |
| `related_slugs` | string[] | No | Slugs of related articles |

### Section Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `section_id` | string | Yes | Unique kebab-case identifier within article |
| `title` | string | Yes | Section heading |
| `content` | string | Yes | Markdown content |
| `order` | number | Yes | Display order within article |
