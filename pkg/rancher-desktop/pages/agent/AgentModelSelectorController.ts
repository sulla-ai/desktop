import { computed, ref } from 'vue';
import type { ComputedRef, Ref } from 'vue';

import { ipcRenderer } from '@pkg/utils/ipcRenderer';
import { updateAgentConfigFull } from '@pkg/agent/services/ConfigService';

type ModelOption =
  | { type: 'local'; value: string; label: string; isActive: boolean }
  | { type: 'remote'; provider: string; value: string; label: string; isActive: boolean };

export class AgentModelSelectorController {
  readonly showModelMenu = ref(false);
  readonly modelMenuEl = ref<HTMLElement | null>(null);
  readonly loadingLocalModels = ref(false);

  private readonly installedLocalModels = ref<string[]>([]);

  private readonly remoteProvider = ref<string>('');
  private readonly remoteModel = ref<string>('');
  private readonly remoteApiKey = ref<string>('');

  readonly activeModelLabel: ComputedRef<string>;
  readonly localModelOptions: ComputedRef<ModelOption[]>;
  readonly remoteOption: ComputedRef<ModelOption | null>;
  readonly isRunningValue: ComputedRef<boolean>;

  constructor(private readonly deps: {
    systemReady: Ref<boolean>;
    loading: Ref<boolean>;
    isRunning: Ref<boolean>;

    modelName: Ref<string>;
    modelMode: Ref<'local' | 'remote'>;
  }) {
    this.activeModelLabel = computed(() => {
      if (this.deps.modelMode.value === 'remote') {
        return this.remoteModel.value || this.deps.modelName.value || 'Remote';
      }

      return this.deps.modelName.value || 'Local';
    });

    this.localModelOptions = computed(() => {
      return this.installedLocalModels.value.map((name) => ({
        type: 'local',
        value: name,
        label: name,
        isActive: this.deps.modelMode.value === 'local' && this.deps.modelName.value === name,
      }));
    });

    this.remoteOption = computed(() => {
      if (!this.remoteProvider.value || !this.remoteModel.value || !this.remoteApiKey.value) {
        return null;
      }

      return {
        type: 'remote',
        provider: this.remoteProvider.value,
        value: this.remoteModel.value,
        label: `${ this.remoteProvider.value } / ${ this.remoteModel.value }`,
        isActive: this.deps.modelMode.value === 'remote',
      };
    });

    this.isRunningValue = computed(() => this.deps.isRunning.value);
  }

  async start(): Promise<void> {
    ipcRenderer.on('settings-read', this.handleSettingsRead);
    document.addEventListener('mousedown', this.handleDocumentClick);

    ipcRenderer.send('settings-read');
    await this.refreshInstalledLocalModels();
  }

  dispose(): void {
    ipcRenderer.removeListener('settings-read', this.handleSettingsRead);
    document.removeEventListener('mousedown', this.handleDocumentClick);
  }

  get showModelMenuValue(): boolean {
    return this.showModelMenu.value;
  }

  get loadingLocalModelsValue(): boolean {
    return this.loadingLocalModels.value;
  }

  get activeModelLabelValue(): string {
    return this.activeModelLabel.value;
  }

  get localModelOptionsValue(): ModelOption[] {
    return this.localModelOptions.value;
  }

  get remoteOptionValue(): ModelOption | null {
    return this.remoteOption.value;
  }

  async toggleModelMenu(): Promise<void> {
    if (!this.deps.systemReady.value) {
      return;
    }

    this.showModelMenu.value = !this.showModelMenu.value;
    if (this.showModelMenu.value) {
      await this.refreshInstalledLocalModels();
      ipcRenderer.send('settings-read');
    }
  }

  hideModelMenu(): void {
    this.showModelMenu.value = false;
  }

  async selectModel(option: ModelOption): Promise<void> {
    try {
      if (option.type === 'local') {
        const patch = { modelMode: 'local' as const, sullaModel: option.value };

        await ipcRenderer.invoke('settings-write', { experimental: patch });
        updateAgentConfigFull(patch);
      } else {
        const patch = {
          modelMode: 'remote' as const,
          remoteProvider: option.provider,
          remoteModel: option.value,
        };

        await ipcRenderer.invoke('settings-write', { experimental: patch });
        updateAgentConfigFull({
          modelMode: 'remote',
          remoteProvider: option.provider,
          remoteModel: option.value,
          remoteApiKey: this.remoteApiKey.value,
        });
      }
    } finally {
      this.showModelMenu.value = false;
    }
  }

  private readonly handleSettingsRead = (_event: unknown, settings: {
    experimental?: {
      remoteProvider?: string;
      remoteModel?: string;
      remoteApiKey?: string;
    };
  }) => {
    this.remoteProvider.value = settings.experimental?.remoteProvider || '';
    this.remoteModel.value = settings.experimental?.remoteModel || '';
    this.remoteApiKey.value = settings.experimental?.remoteApiKey || '';
  };

  private readonly handleDocumentClick = (ev: MouseEvent) => {
    if (!this.showModelMenu.value) {
      return;
    }
    const container = this.modelMenuEl.value;

    if (!container) {
      return;
    }
    if (ev.target instanceof Node && container.contains(ev.target)) {
      return;
    }

    this.showModelMenu.value = false;
  };

  private async refreshInstalledLocalModels(): Promise<void> {
    this.loadingLocalModels.value = true;
    try {
      const res = await fetch('http://127.0.0.1:30114/api/tags', {
        signal: AbortSignal.timeout(3000),
      });

      if (!res.ok) {
        this.installedLocalModels.value = [];
        return;
      }

      const data = await res.json();
      this.installedLocalModels.value = (data.models || []).map((m: { name: string }) => m.name);
    } catch {
      this.installedLocalModels.value = [];
    } finally {
      this.loadingLocalModels.value = false;
    }
  }
}
