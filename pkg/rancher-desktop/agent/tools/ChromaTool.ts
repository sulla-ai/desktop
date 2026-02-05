import type { ThreadState, ToolResult } from '../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import { chromaClient } from '../services/ChromaClient'; // adjust path if needed

export class ChromaTool extends BaseTool {
  override readonly name = 'chroma';
  override readonly aliases = ['knowledgebase', 'memory', 'storage'];

  override getPlanningInstructions(): string {
    return `["chroma", "listCollections"] - Chroma vector DB (memories, knowledgebase, storage)

Examples:
["chroma", "listCollections"]
["chroma", "getOrCreateCollection", "new_collection"]
["chroma", "add", "knowledge", "--documents", "Best CRM is HubSpot", "--metadata", "{\"source\":\"marketing\",\"priority\":10}"]
["chroma", "query", "knowledge", "best crm software", "8"]
["chroma", "get", "knowledge", "--ids", "doc_123_0", "doc_123_1"]
["chroma", "update", "knowledge", "--ids", "doc_123_0", "--documents", "Updated text here"]
["chroma", "delete", "knowledge", "--ids", "doc_123_0"]
["chroma", "count", "knowledge"]
["chroma", "deleteCollection", "tmp_collection"]

Subcommands:
- listCollections
- getOrCreateCollection <name>
- add <collection> --documents "text1" "text2" [--ids "id1" "id2"] [--metadata "{...}"]
- query <collection> <queryText> [nResults=5]
- get <collection> --ids "id1" "id2"
- update <collection> --ids "id1" "id2" [--documents "..."] [--metadata "{...}"]
- delete <collection> [--ids "..."] [--where "{...}"]
- count <collection> [--where "{...}"]
- deleteCollection <name>
`.trim();
  }

  override async execute(state: ThreadState, context: ToolContext): Promise<ToolResult> {
    const subcommand = this.getFirstArg(context);
    const rest = this.getArgsArray(context, 1); // everything after subcommand

    if (!subcommand) {
      return { toolName: this.name, success: false, error: 'Missing subcommand' };
    }

    try {
      switch (subcommand) {
        case 'listCollections': {
          const collections = await chromaClient.listCollections();
          return { toolName: this.name, success: true, result: collections.map(c => c.name) };
        }

        case 'getOrCreateCollection': {
          const name = rest[0];
          if (!name) throw new Error('Missing collection name');
          await chromaClient.getOrCreateCollection(name);
          return { toolName: this.name, success: true, result: { name } };
        }

        case 'add': {
          const params = this.argsToObject(rest);
          const name = params.name || rest[0]; // fallback if name not flagged
          const { documents, ids, metadata, metadatas } = params;

          if (!name || !documents?.length) throw new Error('Missing name or documents');

          const finalMetadatas = metadatas ?? (metadata ? Array(documents.length).fill(metadata) : undefined);

          const result = await chromaClient.addDocuments(name, documents, finalMetadatas, ids);
          return { toolName: this.name, success: true, result };
        }

        case 'query': {
          const name = rest[0];
          const queryText = rest[1];
          const nResults = rest[2] ? parseInt(rest[2], 10) : 5;

          if (!name || !queryText) throw new Error('Missing name or query text');

          const result = await chromaClient.queryDocuments(name, [queryText], nResults);
          return { toolName: this.name, success: true, result };
        }

        case 'get': {
          const params = this.argsToObject(rest);
          const name = params.name || rest[0];
          const ids = params.ids;

          if (!name || !ids?.length) throw new Error('Missing name or ids');

          const result = await chromaClient.getDocuments(name, ids);
          return { toolName: this.name, success: true, result };
        }

        case 'update': {
          const params = this.argsToObject(rest);
          const name = params.name || rest[0];
          const ids = params.ids;
          const documents = params.documents;
          const metadatas = params.metadatas ?? (params.metadata ? Array(ids?.length || 0).fill(params.metadata) : undefined);

          if (!name || !ids?.length) throw new Error('Missing name or ids');

          const result = await chromaClient.updateDocuments(name, ids, documents, metadatas);
          return { toolName: this.name, success: true, result };
        }

        case 'delete': {
          const params = this.argsToObject(rest);
          const name = params.name || rest[0];
          const ids = params.ids;
          const where = params.where;

          if (!name) throw new Error('Missing collection name');

          const result = await chromaClient.deleteDocuments(name, ids, where);
          return {toolName: this.name, success: true, result };
        }

        case 'count': {
          const params = this.argsToObject(rest);
          const name = params.name || rest[0];
          const where = params.where;

          if (!name) throw new Error('Missing collection name');

          const count = await chromaClient.countDocuments(name, where);
          return { toolName: this.name, success: true, result: { name, count } };
        }

        case 'deleteCollection': {
          const name = rest[0];
          if (!name) throw new Error('Missing collection name');

          await chromaClient.deleteCollection(name);
          return { toolName: this.name, success: true, result: { deleted: name } };
        }

        default:
          return { toolName: this.name, success: false, error: `Unknown subcommand: ${subcommand}` };
      }
    } catch (err: any) {
      return { toolName: this.name, success: false, error: err.message || String(err) };
    }
  }
}