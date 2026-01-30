import type { ThreadState, ToolResult } from '../types';

export interface ToolContext {
  threadId: string;
  plannedAction: string;
  memorySearchQueries?: string[];
}

export abstract class BaseTool {
  abstract readonly name: string;
  readonly aliases: string[] = [];

  abstract getPlanningInstructions(): string;

  abstract execute(state: ThreadState, context: ToolContext): Promise<ToolResult>;
}
