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

  getTacticalInstructionsBlock(): string {
    const tools = this.listUnique();
    if (tools.length === 0) {
      return '';
    }

    const lines = tools.map(t => `- ${t.getTacticalInstructions()}`);
    return `Available tools:\n${lines.join('\n')}`;
  }

  getCompactPlanningInstructionsBlock(options: { includeNames?: string[] } = {}): string {
    const all = this.listUnique();
    let tools = all;
    if (options.includeNames && options.includeNames.length > 0) {
      tools = tools.filter(t => options.includeNames!.includes(t.name));
    }

    if (tools.length === 0) {
      return '';
    }

    const header = [
      'Tool usage:',
      '- If a tool is needed, set requiresTools=true and include a step with action equal to the tool name.',
      '- Put tool parameters under step.args as JSON (only include args relevant to that tool).',
      '',
      'Available tools (compact):',
    ].join('\n');

    const blocks = tools
      .map(t => this.compactToolBlock(t))
      .filter(Boolean);

    return `${header}\n${blocks.join('\n')}`.trim();
  }

  private compactToolBlock(tool: BaseTool): string {
    const raw = tool.getPlanningInstructions();
    if (!raw) {
      return '';
    }

    const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      return '';
    }

    const titleLine = lines[0].replace(/^\d+\)\s*/, '');

    const args: string[] = [];
    const purpose: string[] = [];
    let inArgs = false;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];

      if (/^\-\s*args:?$/i.test(line) || /^args:?$/i.test(line) || /^\s*-\s*Args:?$/i.test(line)) {
        inArgs = true;
        continue;
      }

      if (/^\-\s*planning guidance:?/i.test(line) || /^planning guidance:?/i.test(line)) {
        inArgs = false;
        continue;
      }

      if (inArgs) {
        if (line.startsWith('-') || line.startsWith('•') || line.includes('(string') || line.includes('(number')) {
          args.push(line.replace(/^[-•]\s*/, '').trim());
        }
        continue;
      }

      if (line.toLowerCase().includes('purpose:')) {
        purpose.push(line.replace(/^\s*-\s*/,'').trim());
      }
    }

    const parts: string[] = [];
    parts.push(`- ${tool.name}: ${titleLine}`);
    if (purpose.length > 0) {
      parts.push(`  ${purpose[0]}`);
    }
    if (args.length > 0) {
      parts.push(`  args: ${args.join('; ')}`);
    }
    return parts.join('\n');
  }
}

let instance: ToolRegistry | null = null;

export function getToolRegistry(): ToolRegistry {
  if (!instance) {
    instance = new ToolRegistry();
  }
  return instance;
}
