import { getToolRegistry } from './ToolRegistry';
import { MemorySearchTool } from './MemorySearchTool';
import { CountMemoryArticlesTool } from './CountMemoryArticlesTool';

let registered = false;

export function registerDefaultTools(): void {
  if (registered) {
    return;
  }

  const registry = getToolRegistry();
  registry.register(new MemorySearchTool());
  registry.register(new CountMemoryArticlesTool());
  registered = true;
}

export { getToolRegistry } from './ToolRegistry';
export { BaseTool } from './BaseTool';
export { MemorySearchTool } from './MemorySearchTool';
export { CountMemoryArticlesTool } from './CountMemoryArticlesTool';
