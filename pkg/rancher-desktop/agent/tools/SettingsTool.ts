import type { ThreadState, ToolResult } from '../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import { getAgentConfig, updateAgentConfigFull } from '../services/ConfigService';
import { getLLMConfig } from '../services/LLMServiceFactory';
import { getRemoteModelService } from '../services/RemoteModelService';
import { ipcRenderer } from '@pkg/utils/ipcRenderer';

export class SettingsTool extends BaseTool {
  override readonly name = 'settings';
  override readonly aliases = ['settings', 'config', 'agent_config'];

  override getPlanningInstructions(): string {
    return `["settings", "get"] - View or update agent LLM/runtime settings

Examples:
["settings", "get"]
["settings", "update", "--modelMode", "remote", "--remoteProvider", "openai", "--remoteModel", "gpt-4o-mini", "--remoteRetryCount", "5", "--remoteTimeoutSeconds", "90"]

Subcommands:
- get                  → returns current full config snapshot
- update               → patch settings (allowlisted keys only)

Allowed update flags:
--sullaModel           local model name
--modelMode            "local" | "remote"
--remoteProvider       e.g. "openai", "anthropic", "groq"
--remoteModel          model name/id
--remoteApiKey         API key (careful in logs)
--remoteRetryCount     number
--remoteTimeoutSeconds number
`.trim();
  }

  override async execute(_state: ThreadState, context: ToolContext): Promise<ToolResult> {
    const helpResult = await this.handleHelpRequest(context);
    if (helpResult) {
      return helpResult;
    }
    
    const subcommand = this.getFirstArg(context);
    const args = this.getArgsArray(context, 1);
    if (!args.length) {
      return { toolName: this.name, success: false, error: 'Missing subcommand: get or update' };
    }

    try {
      if (subcommand === 'get') {
        const agentConfig = getAgentConfig();
        const llmConfig = getLLMConfig();
        const remote = getRemoteModelService();

        const snapshot = {
          agentConfig,
          llmConfig,
          remoteRuntime: {
            retryCount: remote.getRetryCount(),
            defaultTimeoutMs: remote.getDefaultTimeoutMs(),
            model: remote.getModel(),
            isAvailable: remote.isAvailable(),
          }
        };

        return { toolName: this.name, success: true, result: snapshot };
      }

      if (subcommand === 'update') {
        const params = this.argsToObject(args);

        const patch: Record<string, any> = {};

        if ('sullaModel'        in params) patch.sullaModel         = String(params.sullaModel);
        if ('modelMode'         in params) patch.modelMode          = params.modelMode === 'remote' ? 'remote' : 'local';
        if ('remoteProvider'    in params) patch.remoteProvider     = String(params.remoteProvider);
        if ('remoteModel'       in params) patch.remoteModel        = String(params.remoteModel);
        if ('remoteApiKey'      in params) patch.remoteApiKey       = String(params.remoteApiKey);
        if ('remoteRetryCount'  in params) patch.remoteRetryCount   = Number(params.remoteRetryCount);
        if ('remoteTimeoutSeconds' in params) patch.remoteTimeoutSeconds = Number(params.remoteTimeoutSeconds);

        if (Object.keys(patch).length === 0) {
          return { toolName: this.name, success: false, error: 'No valid settings to update' };
        }

        // Write to persistent storage
        await ipcRenderer.invoke('settings-write', { experimental: patch });

        // Apply immediately to runtime
        updateAgentConfigFull(patch);

        return {
          toolName: this.name,
          success: true,
          result: { applied: patch, message: 'Settings updated — restart agent for full effect if model changed' }
        };
      }

      return { toolName: this.name, success: false, error: `Unknown subcommand: ${subcommand}` };
    } catch (err: any) {
      return { toolName: this.name, success: false, error: err.message || String(err) };
    }
  }
}