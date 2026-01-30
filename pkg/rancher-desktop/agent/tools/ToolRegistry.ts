import type { BaseTool } from './BaseTool';

export class ToolRegistry {
  private toolsByName: Map<string, BaseTool> = new Map();

  register(tool: BaseTool): void {
    this.toolsByName.set(tool.name, tool);
    for (const a of (tool.aliases || [])) {
      this.toolsByName.set(a, tool);
    }
  }

  get(name: string): BaseTool | undefined {
    return this.toolsByName.get(name);
  }

  listUnique(): BaseTool[] {
    const unique = new Map<string, BaseTool>();
    for (const tool of this.toolsByName.values()) {
      unique.set(tool.name, tool);
    }
    return Array.from(unique.values());
  }

  getPlanningInstructionsBlock(): string {
    const tools = this.listUnique();
    if (tools.length === 0) {
      return '';
    }

    const parts: string[] = [];
    parts.push('Available tools:');
    for (const tool of tools) {
      parts.push(tool.getPlanningInstructions());
      parts.push('');
    }

    return parts.join('\n').trim();
  }
}

let instance: ToolRegistry | null = null;

export function getToolRegistry(): ToolRegistry {
  if (!instance) {
    instance = new ToolRegistry();
  }
  return instance;
}
