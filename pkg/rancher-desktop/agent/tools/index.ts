import { getToolRegistry } from './ToolRegistry';
import { KnowledgeBaseSearchTool } from './KnowledgeBaseSearchTool';
import { ChatSummariesSearchTool } from './ChatSummariesSearchTool';
import { ChatMessagesSearchTool } from './ChatMessagesSearchTool';
import { KnowledgeBaseCountTool } from './KnowledgeBaseCountTool';
import { ChatSummariesCountTool } from './ChatSummariesCountTool';
import { KnowledgeBaseUpdatePageTool } from './KnowledgeBaseUpdatePageTool';
import { KnowledgeBaseDeletePageTool } from './KnowledgeBaseDeletePageTool';
import { KnowledgeBaseListPagesTool } from './KnowledgeBaseListPagesTool';
import { KnowledgeBaseGetPageTool } from './KnowledgeBaseGetPageTool';
import { KubectlTool } from './KubectlTool';
import { LimaListInstancesTool } from './LimaListInstancesTool';
import { LimaInstanceStatusTool } from './LimaInstanceStatusTool';
import { LimaShellTool } from './LimaShellTool';
import { AgentGetSettingsTool } from './AgentGetSettingsTool';
import { AgentUpdateSettingsTool } from './AgentUpdateSettingsTool';
import { HostListDirTool } from './HostListDirTool';
import { HostReadFileTool } from './HostReadFileTool';
import { HostTailFileTool } from './HostTailFileTool';
import { HostStatTool } from './HostStatTool';
import { HostFindFilesTool } from './HostFindFilesTool';
import { HostGrepTool } from './HostGrepTool';
import { HostRunCommandTool } from './HostRunCommandTool';
import { HostImageMetadataTool } from './HostImageMetadataTool';
import { EmitChatMessageTool } from './EmitChatMessageTool';
import { EmitChatImageTool } from './EmitChatImageTool';
import { CalendarListEventsTool } from './CalendarListEventsTool';
import { CalendarGetNextEventTool } from './CalendarGetNextEventTool';
import { CalendarGetEventTool } from './CalendarGetEventTool';
import { CalendarCreateEventTool } from './CalendarCreateEventTool';
import { CalendarUpdateEventTool } from './CalendarUpdateEventTool';
import { CalendarDeleteEventTool } from './CalendarDeleteEventTool';
import { ToolListTool } from './ToolListTool';

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
  ensure(new ChatSummariesSearchTool());
  ensure(new ChatMessagesSearchTool());
  ensure(new KnowledgeBaseCountTool());
  ensure(new ChatSummariesCountTool());
  ensure(new KnowledgeBaseUpdatePageTool());
  ensure(new KnowledgeBaseDeletePageTool());
  ensure(new KnowledgeBaseListPagesTool());
  ensure(new KnowledgeBaseGetPageTool());
  ensure(new KubectlTool());
  ensure(new LimaListInstancesTool());
  ensure(new LimaInstanceStatusTool());
  ensure(new LimaShellTool());
  ensure(new AgentGetSettingsTool());
  ensure(new AgentUpdateSettingsTool());
  ensure(new HostListDirTool());
  ensure(new HostReadFileTool());
  ensure(new HostTailFileTool());
  ensure(new HostStatTool());
  ensure(new HostFindFilesTool());
  ensure(new HostGrepTool());
  ensure(new HostRunCommandTool());
  ensure(new HostImageMetadataTool());
  ensure(new ToolListTool());
  ensure(new EmitChatMessageTool());
  ensure(new EmitChatImageTool());
  ensure(new CalendarListEventsTool());
  ensure(new CalendarGetNextEventTool());
  ensure(new CalendarGetEventTool());
  ensure(new CalendarCreateEventTool());
  ensure(new CalendarUpdateEventTool());
  ensure(new CalendarDeleteEventTool());
  registered = true;
}

export { getToolRegistry } from './ToolRegistry';
export { BaseTool } from './BaseTool';
export { KnowledgeBaseSearchTool } from './KnowledgeBaseSearchTool';
export { ChatSummariesSearchTool } from './ChatSummariesSearchTool';
export { ChatMessagesSearchTool } from './ChatMessagesSearchTool';
export { KnowledgeBaseCountTool } from './KnowledgeBaseCountTool';
export { ChatSummariesCountTool } from './ChatSummariesCountTool';
export { KnowledgeBaseUpdatePageTool } from './KnowledgeBaseUpdatePageTool';
export { KnowledgeBaseDeletePageTool } from './KnowledgeBaseDeletePageTool';
export { KnowledgeBaseListPagesTool } from './KnowledgeBaseListPagesTool';
export { KnowledgeBaseGetPageTool } from './KnowledgeBaseGetPageTool';
export { KubectlTool } from './KubectlTool';
export { LimaListInstancesTool } from './LimaListInstancesTool';
export { LimaInstanceStatusTool } from './LimaInstanceStatusTool';
export { LimaShellTool } from './LimaShellTool';
export { AgentGetSettingsTool } from './AgentGetSettingsTool';
export { AgentUpdateSettingsTool } from './AgentUpdateSettingsTool';
export { HostListDirTool } from './HostListDirTool';
export { HostReadFileTool } from './HostReadFileTool';
export { HostTailFileTool } from './HostTailFileTool';
export { HostStatTool } from './HostStatTool';
export { HostFindFilesTool } from './HostFindFilesTool';
export { HostGrepTool } from './HostGrepTool';
export { HostRunCommandTool } from './HostRunCommandTool';
export { CalendarListEventsTool } from './CalendarListEventsTool';
export { CalendarGetNextEventTool } from './CalendarGetNextEventTool';
export { CalendarGetEventTool } from './CalendarGetEventTool';
export { CalendarCreateEventTool } from './CalendarCreateEventTool';
export { CalendarUpdateEventTool } from './CalendarUpdateEventTool';
export { CalendarDeleteEventTool } from './CalendarDeleteEventTool';
