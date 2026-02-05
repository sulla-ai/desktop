import type { ThreadState, ToolResult } from '../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import { getToolRegistry } from './ToolRegistry';

export class ToolListTool extends BaseTool {
  override readonly name = 'tool_list';
  override readonly aliases = ['tools', 'list_tools'];

  override getPlanningInstructions(): string {
    return `["tool_list"] - List all available tools

Examples:
["tool_list"]
["tool_list", "help"] → shows this help text

Output format:
Array of objects:
  - name: tool name
  - description: short tactical use case
  - aliases: [] (if any)

Use when you need to discover or remind yourself of available tools.
`.trim();
  }

  override async execute(_state: ThreadState, context: ToolContext): Promise<ToolResult> {
    const helpResult = await this.handleHelpRequest(context);
    if (helpResult) return helpResult;

    try {
      const registry = getToolRegistry();
      const tools = registry.listUnique();

      const toolList = tools.map(t => ({
        name: t.name,
        description: t.getTacticalInstructions().trim(),
        aliases: t.aliases.length ? t.aliases : undefined,
      }));

      return {
        toolName: this.name,
        success: true,
        result: toolList,
      };
    } catch (err: any) {
      return {
        toolName: this.name,
        success: false,
        error: err.message || String(err),
      };
    }
  }
}