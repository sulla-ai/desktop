// PgTool.ts
// Exec-form tool for PostgreSQL operations via PostgresClient
// Mirrors ChromaTool structure

import type { ThreadState, ToolResult } from '../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import { postgresClient } from '../database/PostgresClient'; // adjust path

export class PgTool extends BaseTool {
  override readonly name = 'pg';
  override readonly aliases = ['postgres', 'sql', 'db'];

  override getPlanningInstructions(): string {
    return `["pg", "query", "SELECT * FROM users LIMIT 5"] - PostgreSQL database access

Examples:
["pg", "query", "SELECT id, title FROM enabled_skills ORDER BY enabled_at DESC LIMIT 10"]
["pg", "queryOne", "SELECT value FROM settings WHERE key = $1", "app_version"]
["pg", "queryAll", "SELECT * FROM conversations WHERE thread_id = $1", "thread_abc123"]
["pg", "execute", "INSERT INTO logs (message) VALUES ($1)", "Agent started"]
["pg", "count", "SELECT COUNT(*) FROM enabled_skills"]
["pg", "transaction", "BEGIN; INSERT INTO test (val) VALUES (42); COMMIT;"]

Subcommands:
- query <sql> [param1] [param2]...
- queryOne <sql> [param1]...
- queryAll <sql> [param1]...
- execute <sql> [param1]...   (returns affected rows / last insert id)
- count <sql> [param1]...     (returns single count number)
- transaction <sql statements separated by ;>
`.trim();
  }

  override async execute(state: ThreadState, context: ToolContext): Promise<ToolResult> {
    const helpResult = await this.handleHelpRequest(context);
    if (helpResult) {
      return helpResult;
    }
    
    const subcommand = this.getFirstArg(context);
    const rest = this.getArgsArray(context, 1); // everything after subcommand

    if (!subcommand) {
      return { toolName: this.name, success: false, error: 'Missing subcommand' };
    }

    try {
      switch (subcommand) {
        case 'query':
        case 'queryone':
        case 'queryall': {
          const sql = rest[0];
          const params = rest.slice(1).map(p => {
            // Try to parse numbers/booleans
            if (/^\d+$/.test(p)) return parseInt(p, 10);
            if (/^\d+\.\d+$/.test(p)) return parseFloat(p);
            if (p === 'true' || p === 'false') return p === 'true';
            return p;
          });

          if (!sql) throw new Error('Missing SQL query');

          let result;
          if (subcommand === 'queryone') {
            result = await postgresClient.queryOne(sql, params);
          } else if (subcommand === 'queryall') {
            result = await postgresClient.queryAll(sql, params);
          } else {
            result = await postgresClient.query(sql, params);
          }

          return { toolName: this.name, success: true, result };
        }

        case 'execute': {
          const sql = rest[0];
          const params = rest.slice(1);
          if (!sql) throw new Error('Missing SQL');

          const res = await postgresClient.query(sql, params);
          return {
            toolName: this.name,
            success: true,
            result: {
              rowCount: res.rowCount,
              command: res.command,
              oid: res.oid, // last insert id if applicable
            },
          };
        }

        case 'count': {
          const sql = rest[0];
          const params = rest.slice(1);
          if (!sql) throw new Error('Missing SQL');

          const res = await postgresClient.queryOne<{ count: string }>(sql, params);
          const count = res ? parseInt(res.count, 10) : 0;
          return { toolName: this.name, success: true, result: { count } };
        }

        case 'transaction': {
          const sqlStatements = rest.join(' ').split(';').map(s => s.trim()).filter(Boolean);
          if (!sqlStatements.length) throw new Error('No statements');

          const result = await postgresClient.transaction(async (tx) => {
            const results: any[] = [];
            for (const stmt of sqlStatements) {
              if (!stmt) continue;
              const res = await tx.query(stmt);
              results.push({
                command: res.command,
                rowCount: res.rowCount,
              });
            }
            return results;
          });

          return { toolName: this.name, success: true, result };
        }

        default:
          return { toolName: this.name, success: false, error: `Unknown subcommand: ${subcommand}` };
      }
    } catch (err: any) {
      // Handle common database errors gracefully
      let errorMessage = err.message || String(err);
      
      // Check for common PostgreSQL error codes
      if (err.code === '42P01') {
        // Undefined table
        errorMessage = `Table does not exist. Available tables can be listed with: ["pg", "query", "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"]`;
      } else if (err.code === '42703') {
        // Undefined column
        errorMessage = `Column does not exist. Check table schema with: ["pg", "query", "SELECT column_name FROM information_schema.columns WHERE table_name = 'your_table'"]`;
      } else if (err.code === '08006' || err.code === '08001') {
        // Connection failure
        errorMessage = 'Database connection failed. Please check if PostgreSQL is running and accessible.';
      } else if (err.code === '28000') {
        // Authorization issue
        errorMessage = 'Database authorization failed. Please check database credentials and permissions.';
      }
      
      return { toolName: this.name, success: false, error: errorMessage };
    }
  }
}