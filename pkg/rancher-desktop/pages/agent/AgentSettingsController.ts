import type { Ref } from 'vue';

import { ipcRenderer } from '@pkg/utils/ipcRenderer';

export class AgentSettingsController {
  private readonly handlePreferencesChanged = () => {
    ipcRenderer.send('settings-read');
  };

  private readonly handleSettingsUpdate = () => {
    ipcRenderer.send('settings-read');
  };

  private readonly handleSettingsRead = (_event: unknown, settings: {
    experimental?: {
      sullaModel?: string;
      soulPrompt?: string;
      botName?: string;
      primaryUserName?: string;
      modelMode?: 'local' | 'remote';
      remoteProvider?: string;
      remoteModel?: string;
      remoteApiKey?: string;
      remoteRetryCount?: number;
      remoteTimeoutSeconds?: number;
      heartbeatEnabled?: boolean;
      heartbeatDelayMinutes?: number;
      heartbeatPrompt?: string;
      heartbeatModel?: string;
    };
  }) => {
    const exp = settings.experimental;

    if (exp) {
      this.updateAgentConfigFull({
        sullaModel:            exp.sullaModel,
        soulPrompt:            exp.soulPrompt,
        botName:               exp.botName,
        primaryUserName:       exp.primaryUserName,
        modelMode:             exp.modelMode,
        remoteProvider:        exp.remoteProvider,
        remoteModel:           exp.remoteModel,
        remoteApiKey:          exp.remoteApiKey,
        remoteRetryCount:      exp.remoteRetryCount,
        remoteTimeoutSeconds:  exp.remoteTimeoutSeconds,
        heartbeatEnabled:      exp.heartbeatEnabled,
        heartbeatDelayMinutes: exp.heartbeatDelayMinutes,
        heartbeatPrompt:       exp.heartbeatPrompt,
        heartbeatModel:        exp.heartbeatModel,
      });

      this.modelMode.value = exp.modelMode || 'local';

      if (exp.modelMode === 'remote' && exp.remoteModel) {
        this.modelName.value = exp.remoteModel;
        console.log(`[Agent] Remote model configured: ${exp.remoteProvider}/${exp.remoteModel}`);
      } else if (exp.sullaModel) {
        this.modelName.value = exp.sullaModel;
        console.log(`[Agent] Local model configured: ${exp.sullaModel}`);
      } else {
        this.modelName.value = 'tinyllama:latest';
      }
    } else {
      this.modelName.value = 'tinyllama:latest';
      this.modelMode.value = 'local';
    }
  };

  constructor(
    private readonly params: {
      modelName: Ref<string>;
      modelMode: Ref<'local' | 'remote'>;
    },
    private readonly updateAgentConfigFull: (config: {
      sullaModel?: string;
      modelMode?: 'local' | 'remote';
      remoteProvider?: string;
      remoteModel?: string;
      remoteApiKey?: string;
      remoteRetryCount?: number;
      remoteTimeoutSeconds?: number;
    }) => void,
  ) {
    this.modelName = params.modelName;
    this.modelMode = params.modelMode;
  }

  private modelName: Ref<string>;
  private modelMode: Ref<'local' | 'remote'>;

  start(): void {
    ipcRenderer.on('settings-read', this.handleSettingsRead);
    ipcRenderer.on('preferences/changed', this.handlePreferencesChanged);
    ipcRenderer.on('settings-update', this.handleSettingsUpdate);
    ipcRenderer.send('settings-read');
  }

  dispose(): void {
    ipcRenderer.removeListener('settings-read', this.handleSettingsRead);
    ipcRenderer.removeListener('preferences/changed', this.handlePreferencesChanged);
    ipcRenderer.removeListener('settings-update', this.handleSettingsUpdate);
  }
}
