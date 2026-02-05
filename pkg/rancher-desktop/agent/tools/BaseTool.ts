import type { ThreadState, ToolResult } from '../types';

export interface ToolContext {
  toolName: string;
  args?: Record<string, unknown> | string[];
}

export abstract class BaseTool {
  abstract readonly name: string;
  readonly aliases: string[] = [];

  /** Detailed instructions for the executor on how to use this tool (args, output format, etc.) */
  abstract getPlanningInstructions(): string;

  /** Brief description for the tactical planner to decide if this tool is needed for a milestone */
  getTacticalInstructions(): string {
    // Return the first two lines of planning instructions
    const planning = this.getPlanningInstructions();
    const lines = planning.split('\n').filter(l => l.trim());
    return lines.slice(0, 2).join('\n') || this.name;
  }

  /** Extract args array from ToolContext, handling both exec form and object form */
  protected getArgsArray(context: ToolContext, offset: number = 0): string[] {
    const argsArray = Array.isArray(context.args) ? context.args : context.args?.args;
    const args = (argsArray as string[] | undefined) || [];
    return offset > 0 ? args.slice(offset) : args;
  }

  /** Get first argument from ToolContext, handling both exec form and object form */
  protected getFirstArg(context: ToolContext): string {
    const args = this.getArgsArray(context);
    return args[0] || '';
  }

  /** Get tool name from ToolContext, handling both exec form and object form */
  protected getToolName(context: ToolContext): string {
    // Check if toolName is explicitly set in context
    if (context.toolName) {
      return context.toolName;
    }
    
    // Fall back to extracting from args array
    const argsArray = Array.isArray(context.args) ? context.args : context.args?.args;
    const args = (argsArray as string[] | undefined) || [];
    return args[0] || this.constructor.name;
  }

  /**
   * Parse CLI-style args (--flag value1 value2 ...) into object
   * Supports repeatable flags (collects arrays), JSON values, falls back to empty arrays/objects
   * Dynamic: flag name → camelCase property (strip --, --documents → documents)
   */
  public argsToObject(args: string[]): Record<string, any> {
    const result: Record<string, any> = {};
    let i = 0;

    while (i < args.length) {
      const arg = args[i];

      if (!arg.startsWith('--')) {
        i++;
        continue;
      }

      // --flag → flag
      let key = arg.slice(2);
      // kebab-case → camelCase
      key = key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());

      i++;

      // Collect values until next flag or end
      const values: string[] = [];
      while (i < args.length && !args[i].startsWith('--')) {
        values.push(args[i]);
        i++;
      }

      // Single value or array?
      let value: any = values.length === 1 ? values[0] : values;

      // Try parsing as JSON if looks like object/array
      if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
        try {
          value = JSON.parse(value);
        } catch {
          // keep as string if invalid JSON
        }
      }

      // Store (overwrite if same flag appears multiple times, or use array push if needed)
      result[key] = value;
    }

    return result;
  }

  abstract execute(state: ThreadState, context: ToolContext): Promise<ToolResult>;
}
