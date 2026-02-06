// RedisTool.ts
// Exec-form tool for Redis operations via RedisClient

import type { ThreadState, ToolResult } from '../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import { redisClient } from '../database/RedisClient'; // adjust path

export class RedisTool extends BaseTool {
  override readonly name = 'redis';
  override readonly aliases = ['cache', 'kv', 'red'];

  override getPlanningInstructions(): string {
    return `["redis", "get", "session:123"] - Fast key-value cache (Redis)

Examples:
["redis", "get", "user:session:abc123"]
["redis", "set", "temp:flag", "active", "3600"]
["redis", "del", "old:cache:key"]
["redis", "incr", "counter:visits"]
["redis", "hgetall", "user:profile:456"]
["redis", "hset", "user:profile:456", "plan", "pro"]
["redis", "rpush", "queue:jobs", "process-lead-789"]
["redis", "lpop", "queue:jobs"]
["redis", "ttl", "session:abc123"]

Subcommands:
- get      <key>
- set      <key> <value> [ttlSeconds]
- del      <key1> [key2...]
- incr     <key>
- decr     <key>
- expire   <key> <seconds>
- ttl      <key>
- hget     <key> <field>
- hset     <key> <field> <value>
- hgetall  <key>
- rpush    <key> <value1> [value2...]
- lpop     <key>
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
        case 'get': {
          const key = rest[0];
          if (!key) throw new Error('Missing key');
          const value = await redisClient.get(key);
          return { toolName: this.name, success: true, result: value };
        }

        case 'set': {
          const key = rest[0];
          const value = rest[1];
          const ttl = rest[2] ? parseInt(rest[2], 10) : undefined;
          if (!key || value === undefined) throw new Error('Missing key or value');
          await redisClient.set(key, value, ttl);
          return { toolName: this.name, success: true, result: 'OK' };
        }

        case 'del': {
          const keys = rest;
          if (!keys.length) throw new Error('Missing key(s)');
          const count = await redisClient.del(keys);
          return { toolName: this.name, success: true, result: { deleted: count } };
        }

        case 'incr': {
          const key = rest[0];
          if (!key) throw new Error('Missing key');
          const newValue = await redisClient.incr(key);
          return { toolName: this.name, success: true, result: newValue };
        }

        case 'decr': {
          const key = rest[0];
          if (!key) throw new Error('Missing key');
          const newValue = await redisClient.decr(key);
          return { toolName: this.name, success: true, result: newValue };
        }

        case 'expire': {
          const key = rest[0];
          const seconds = parseInt(rest[1], 10);
          if (!key || isNaN(seconds)) throw new Error('Missing key or invalid seconds');
          const result = await redisClient.expire(key, seconds);
          return { toolName: this.name, success: true, result: result === 1 };
        }

        case 'ttl': {
          const key = rest[0];
          if (!key) throw new Error('Missing key');
          const seconds = await redisClient.ttl(key);
          return { toolName: this.name, success: true, result: seconds };
        }

        case 'hget': {
          const key = rest[0];
          const field = rest[1];
          if (!key || !field) throw new Error('Missing key or field');
          const value = await redisClient.hget(key, field);
          return { toolName: this.name, success: true, result: value };
        }

        case 'hset': {
          const key = rest[0];
          const field = rest[1];
          const value = rest[2];
          if (!key || !field || value === undefined) throw new Error('Missing key, field or value');
          const count = await redisClient.hset(key, field, value);
          return { toolName: this.name, success: true, result: count };
        }

        case 'hgetall': {
          const key = rest[0];
          if (!key) throw new Error('Missing key');
          const obj = await redisClient.hgetall(key);
          return { toolName: this.name, success: true, result: obj };
        }

        case 'rpush': {
          const key = rest[0];
          const values = rest.slice(1);
          if (!key || !values.length) throw new Error('Missing key or values');
          const length = await redisClient.rpush(key, ...values);
          return { toolName: this.name, success: true, result: length };
        }

        case 'lpop': {
          const key = rest[0];
          if (!key) throw new Error('Missing key');
          const value = await redisClient.lpop(key);
          return { toolName: this.name, success: true, result: value };
        }

        default:
          return { toolName: this.name, success: false, error: `Unknown subcommand: ${subcommand}` };
      }
    } catch (err: any) {
      return { toolName: this.name, success: false, error: err.message || String(err) };
    }
  }
}