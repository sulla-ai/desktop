import type { ThreadState, ToolResult } from '../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import { getToolRegistry } from './ToolRegistry';

export class ToolListTool extends BaseTool {
  override readonly name = 'tool_list';
  override readonly category = 'tools';

  override getPlanningInstructions(): string {
    return [
      '37) tool_list (Tools)',
      '   - Purpose: List all available tools with their tactical descriptions.',
      '   - Args: none',
      '   - Output: Array of tools with name and description.',
      '   - Use this to discover what tools are available for execution.',
    ].join('\n');
  }

  override async execute(_state: ThreadState, _context: ToolContext): Promise<ToolResult> {
    try {
      const registry = getToolRegistry();
      const tools = registry.listUnique();

      const toolList = tools.map(t => ({
        name: t.name,
        description: t.getTacticalInstructions(),
      }));

      return {
        toolName: this.name,
        success: true,
        result: toolList,
      };
    } catch (err) {
      return {
        toolName: this.name,
        success: false,
        error: `Failed to list tools: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
}
