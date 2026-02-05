import { getToolRegistry } from './ToolRegistry';
import { KnowledgeBaseSearchTool } from './KnowledgeBaseSearchTool';
import { ChromaTool } from './ChromaTool';
import { KnowledgeBaseCountTool } from './KnowledgeBaseCountTool';
import { KnowledgeBaseDeletePageTool } from './KnowledgeBaseDeletePageTool';
import { KnowledgeBaseListPagesTool } from './KnowledgeBaseListPagesTool';
import { KnowledgeBaseGetPageTool } from './KnowledgeBaseGetPageTool';
import { KubectlTool } from './KubectlTool';
import { RdctlTool } from './RdctlTool';
import { LimactlTool } from './LimactlTool';
import { ExecTool } from './ExecTool';
import { PgTool } from './PgTool';
import { RedisTool } from './RedisTool';
import { CalendarTool } from './CalendarTool';
import { AgentSettingsTool } from './SettingsTool';
import { ToolListTool } from './ToolListTool';
import { EmitChatMessageTool } from './EmitChatMessageTool';
import { EmitChatImageTool } from './EmitChatImageTool';

let registered = false;

export function registerDefaultTools(): void {
  const registry = getToolRegistry();

  const ensure = (tool: any) => {
    const name = String(tool?.name || '');
    if (!name) {
      return;
    }
    if (!registry.get(name)) {
      registry.register(tool);
    }
  };

  ensure(new KnowledgeBaseSearchTool());
  ensure(new ChromaTool());
  ensure(new KnowledgeBaseCountTool());
  ensure(new KnowledgeBaseDeletePageTool());
  ensure(new KnowledgeBaseListPagesTool());
  ensure(new KnowledgeBaseGetPageTool());
  ensure(new KubectlTool());
  ensure(new RdctlTool());
  ensure(new LimactlTool());
  ensure(new ExecTool());
  ensure(new PgTool());
  ensure(new RedisTool());
  ensure(new CalendarTool());
  ensure(new AgentSettingsTool());
  ensure(new ToolListTool());
  ensure(new EmitChatMessageTool());
  ensure(new EmitChatImageTool());
  registered = true;
}

export { getToolRegistry } from './ToolRegistry';
export { BaseTool } from './BaseTool';
export { KnowledgeBaseSearchTool } from './KnowledgeBaseSearchTool';
export { ChromaTool } from './ChromaTool';
export { KnowledgeBaseCountTool } from './KnowledgeBaseCountTool';
export { KnowledgeBaseDeletePageTool } from './KnowledgeBaseDeletePageTool';
export { KnowledgeBaseListPagesTool } from './KnowledgeBaseListPagesTool';
export { KnowledgeBaseGetPageTool } from './KnowledgeBaseGetPageTool';
export { KubectlTool } from './KubectlTool';
export { LimactlTool } from './LimactlTool';
export { ExecTool } from './ExecTool';
export { PgTool } from './PgTool';
export { RedisTool } from './RedisTool';
export { CalendarTool } from './CalendarTool';
export { AgentSettingsTool } from './SettingsTool';
export { RdctlTool } from './RdctlTool';
export { ToolListTool } from './ToolListTool';
export { EmitChatMessageTool } from './EmitChatMessageTool';
export { EmitChatImageTool } from './EmitChatImageTool';
