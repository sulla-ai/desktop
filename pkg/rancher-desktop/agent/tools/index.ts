import { getToolRegistry } from './ToolRegistry';
import { ChromaTool } from './ChromaTool';
import { KubectlTool } from './KubectlTool';
import { RdctlTool } from './RdctlTool';
import { LimactlTool } from './LimactlTool';
import { ExecTool } from './ExecTool';
import { PgTool } from './PgTool';
import { RedisTool } from './RedisTool';
import { CalendarTool } from './CalendarTool';
import { SettingsTool } from './SettingsTool';
import { ToolListTool } from './ToolListTool';
import { EmitChatMessageTool } from './EmitChatMessageTool';
import { EmitChatImageTool } from './EmitChatImageTool';
import { SlackTool } from '../integrations/slack/SlackTool';

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

  ensure(new ChromaTool());
  ensure(new KubectlTool());
  ensure(new RdctlTool());
  ensure(new LimactlTool());
  ensure(new ExecTool());
  ensure(new PgTool());
  ensure(new RedisTool());
  ensure(new CalendarTool());
  ensure(new SettingsTool());
  ensure(new ToolListTool());
  ensure(new EmitChatMessageTool());
  ensure(new EmitChatImageTool());
  ensure(new SlackTool());
  registered = true;
}

export { getToolRegistry } from './ToolRegistry';
export { BaseTool } from './BaseTool';
export { ChromaTool } from './ChromaTool';
export { KubectlTool } from './KubectlTool';
export { LimactlTool } from './LimactlTool';
export { ExecTool } from './ExecTool';
export { PgTool } from './PgTool';
export { RedisTool } from './RedisTool';
export { CalendarTool } from './CalendarTool';
export { SettingsTool } from './SettingsTool';
export { RdctlTool } from './RdctlTool';
export { ToolListTool } from './ToolListTool';
export { EmitChatMessageTool } from './EmitChatMessageTool';
export { EmitChatImageTool } from './EmitChatImageTool';
export { SlackTool } from '../integrations/slack/SlackTool';
