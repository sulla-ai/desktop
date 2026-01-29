<script lang="ts">
import { defineComponent } from 'vue';

import { ipcRenderer } from '@pkg/utils/ipcRenderer';

// Nav items for the Language Model Settings sidebar
const navItems = [
  { id: 'models', name: 'Models' },
];

// Ollama models sorted by resource requirements (smallest to largest)
const OLLAMA_MODELS = [
  {
    name: 'tinyllama:latest', displayName: 'TinyLlama', size: '637MB', minMemoryGB: 2, minCPUs: 2, description: 'Compact 1.1B model, fast responses, good for basic tasks',
  },
  {
    name: 'phi3:mini', displayName: 'Phi-3 Mini', size: '2.2GB', minMemoryGB: 4, minCPUs: 2, description: 'Microsoft\'s efficient 3.8B model, great reasoning capabilities',
  },
  {
    name: 'gemma:2b', displayName: 'Gemma 2B', size: '1.7GB', minMemoryGB: 4, minCPUs: 2, description: 'Google\'s lightweight model, good general performance',
  },
  {
    name: 'llama3.2:1b', displayName: 'Llama 3.2 1B', size: '1.3GB', minMemoryGB: 4, minCPUs: 2, description: 'Meta\'s smallest Llama 3.2, efficient and capable',
  },
  {
    name: 'llama3.2:3b', displayName: 'Llama 3.2 3B', size: '2.0GB', minMemoryGB: 4, minCPUs: 2, description: 'Meta\'s compact Llama 3.2, balanced performance',
  },
  {
    name: 'mistral:7b', displayName: 'Mistral 7B', size: '4.1GB', minMemoryGB: 5, minCPUs: 2, description: 'Excellent 7B model, strong coding and reasoning',
  },
  {
    name: 'llama3.1:8b', displayName: 'Llama 3.1 8B', size: '4.7GB', minMemoryGB: 6, minCPUs: 2, description: 'Meta\'s latest 8B model, excellent all-around performance',
  },
  {
    name: 'gemma:7b', displayName: 'Gemma 7B', size: '5.0GB', minMemoryGB: 6, minCPUs: 2, description: 'Google\'s larger model, improved capabilities',
  },
  {
    name: 'codellama:7b', displayName: 'Code Llama 7B', size: '3.8GB', minMemoryGB: 5, minCPUs: 2, description: 'Specialized for code generation and understanding',
  },
  {
    name: 'llama3.1:70b', displayName: 'Llama 3.1 70B', size: '40GB', minMemoryGB: 48, minCPUs: 8, description: 'Meta\'s flagship model, state-of-the-art performance',
  },
  {
    name: 'mixtral:8x7b', displayName: 'Mixtral 8x7B', size: '26GB', minMemoryGB: 32, minCPUs: 8, description: 'Mixture of experts, excellent quality and speed',
  },
  {
    name: 'deepseek-coder:33b', displayName: 'DeepSeek Coder 33B', size: '19GB', minMemoryGB: 24, minCPUs: 6, description: 'Advanced coding model, excellent for development',
  },
];

interface InstalledModel {
  name: string;
  size: number;
  modified_at: string;
  digest: string;
}

// Remote API providers
const REMOTE_PROVIDERS = [
  {
    id:          'grok',
    name:        'Grok (xAI)',
    description: 'xAI\'s Grok models - fast, witty, and capable',
    baseUrl:     'https://api.x.ai/v1',
    models:      [
      { id: 'grok-4-1-fast-reasoning', name: 'Grok 4.1 Fast Reasoning', description: '2M context, best for reasoning tasks', pricing: '$0.20/$0.50' },
      { id: 'grok-4-1-fast-non-reasoning', name: 'Grok 4.1 Fast', description: '2M context, fast general purpose', pricing: '$0.20/$0.50' },
      { id: 'grok-code-fast-1', name: 'Grok Code Fast', description: '256K context, optimized for code', pricing: '$0.20/$1.50' },
      { id: 'grok-4-fast-reasoning', name: 'Grok 4 Fast Reasoning', description: '2M context, reasoning tasks', pricing: '$0.20/$0.50' },
      { id: 'grok-4-fast-non-reasoning', name: 'Grok 4 Fast', description: '2M context, fast general purpose', pricing: '$0.20/$0.50' },
      { id: 'grok-4-0709', name: 'Grok 4', description: '256K context, flagship model', pricing: '$3.00/$15.00' },
      { id: 'grok-3-mini', name: 'Grok 3 Mini', description: '131K context, fast and affordable', pricing: '$0.30/$0.50' },
      { id: 'grok-3', name: 'Grok 3', description: '131K context, previous flagship', pricing: '$3.00/$15.00' },
    ],
  },
  {
    id:          'openai',
    name:        'OpenAI',
    description: 'GPT-4, GPT-3.5, and other OpenAI models',
    baseUrl:     'https://api.openai.com/v1',
    models:      [
      { id: 'gpt-4o', name: 'GPT-4o', description: 'Most capable multimodal model' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast and affordable' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'High capability with vision' },
    ],
  },
  {
    id:          'anthropic',
    name:        'Anthropic',
    description: 'Claude models - safe, helpful, and honest',
    baseUrl:     'https://api.anthropic.com/v1',
    models:      [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Best balance of speed and capability' },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: 'Most capable Claude model' },
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', description: 'Fastest Claude model' },
    ],
  },
  {
    id:          'google',
    name:        'Google AI',
    description: 'Gemini models from Google',
    baseUrl:     'https://generativelanguage.googleapis.com/v1beta',
    models:      [
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Most capable Gemini model' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Fast and efficient' },
    ],
  },
];

export default defineComponent({
  name: 'language-model-settings',

  data() {
    return {
      currentNav:       'models' as string,
      navItems,
      // Which tab is being viewed (local or remote)
      viewingTab:       'local' as 'local' | 'remote',
      // Which mode is currently active (saved in settings)
      activeMode:       'local' as 'local' | 'remote',
      // Local model settings
      activeModel:      'tinyllama:latest', // The currently saved/active local model
      pendingModel:     'tinyllama:latest', // The model selected in dropdown
      installedModels:  [] as InstalledModel[],
      loadingModels:    false,
      downloadingModel: null as string | null,
      downloadProgress: 0,
      // Remote model settings
      remoteProviders:      REMOTE_PROVIDERS,
      selectedProvider:     'grok',
      selectedRemoteModel:  'grok-4-1-fast-reasoning',
      apiKey:               '',
      apiKeyVisible:        false,
      // Activation state
      activating:           false,
      activationError:      '' as string,
    };
  },

  computed: {
    currentNavItem(): { id: string; name: string } {
      return this.navItems.find(item => item.id === this.currentNav) || this.navItems[0];
    },
    availableModels(): Array<{ name: string; displayName: string; size: string; description: string }> {
      return OLLAMA_MODELS;
    },
    pendingModelDescription(): string {
      const model = OLLAMA_MODELS.find(m => m.name === this.pendingModel);

      return model?.description || '';
    },
    isPendingModelInstalled(): boolean {
      return this.installedModels.some(m => m.name === this.pendingModel);
    },
    isPendingDifferentFromActive(): boolean {
      return this.pendingModel !== this.activeModel;
    },
    formattedInstalledModels(): Array<InstalledModel & { formattedSize: string }> {
      return this.installedModels.map(model => ({
        ...model,
        formattedSize: this.formatBytes(model.size),
      }));
    },
    currentProvider(): typeof REMOTE_PROVIDERS[0] | undefined {
      return this.remoteProviders.find(p => p.id === this.selectedProvider);
    },
    currentProviderModels(): Array<{ id: string; name: string; description: string; pricing?: string }> {
      return this.currentProvider?.models || [];
    },
    selectedRemoteModelDescription(): string {
      const model = this.currentProviderModels.find(m => m.id === this.selectedRemoteModel);

      return model?.description || '';
    },
  },

  async mounted() {
    // Load saved settings
    ipcRenderer.on('settings-read', (_event: unknown, settings: {
      experimental?: {
        sullaModel?: string;
        modelMode?: 'local' | 'remote';
        remoteProvider?: string;
        remoteModel?: string;
        remoteApiKey?: string;
      };
    }) => {
      if (settings.experimental?.sullaModel) {
        this.activeModel = settings.experimental.sullaModel;
        this.pendingModel = settings.experimental.sullaModel;
      }
      if (settings.experimental?.modelMode) {
        this.activeMode = settings.experimental.modelMode;
        this.viewingTab = settings.experimental.modelMode;
      }
      if (settings.experimental?.remoteProvider) {
        this.selectedProvider = settings.experimental.remoteProvider;
      }
      if (settings.experimental?.remoteModel) {
        this.selectedRemoteModel = settings.experimental.remoteModel;
      }
      if (settings.experimental?.remoteApiKey) {
        this.apiKey = settings.experimental.remoteApiKey;
      }
    });
    ipcRenderer.send('settings-read');

    await this.loadModels();
    ipcRenderer.send('dialog/ready');
  },

  methods: {
    navClicked(navId: string) {
      this.currentNav = navId;
      if (navId === 'models') {
        this.loadModels();
      }
    },

    formatBytes(bytes: number): string {
      if (bytes === 0) {
        return '0 B';
      }
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));

      return `${ parseFloat((bytes / Math.pow(k, i)).toFixed(1)) } ${ sizes[i] }`;
    },

    // Models tab methods
    async loadModels() {
      this.loadingModels = true;
      try {
        const res = await fetch('http://127.0.0.1:30114/api/tags', {
          signal: AbortSignal.timeout(5000),
        });

        if (res.ok) {
          const data = await res.json();

          this.installedModels = data.models || [];
        }
      } catch (err) {
        console.error('Failed to load models:', err);
      } finally {
        this.loadingModels = false;
      }
    },

    async downloadPendingModel() {
      await this.pullModel(this.pendingModel);
    },

    async pullModel(modelName: string) {
      this.downloadingModel = modelName;
      this.downloadProgress = 0;

      try {
        const res = await fetch('http://127.0.0.1:30114/api/pull', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ name: modelName, stream: true }),
        });

        if (!res.ok || !res.body) {
          console.error('Failed to download model:', res.status);

          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          const text = decoder.decode(value, { stream: true });
          const lines = text.split('\n').filter(line => line.trim());

          for (const line of lines) {
            try {
              const data = JSON.parse(line);

              if (data.total && data.completed) {
                this.downloadProgress = Math.round((data.completed / data.total) * 100);
              } else if (data.status === 'success') {
                this.downloadProgress = 100;
              }
            } catch {
              // Ignore parse errors for partial JSON
            }
          }
        }

        await this.loadModels();
        // After successful download, activate the model
        this.activateModel();
      } catch (err) {
        console.error('Error downloading model:', err);
      } finally {
        this.downloadingModel = null;
        this.downloadProgress = 0;
      }
    },

    async activateModel() {
      // Save the pending model as the active model
      this.activeModel = this.pendingModel;
      try {
        await ipcRenderer.invoke('settings-write', {
          experimental: { sullaModel: this.pendingModel },
        });
        console.log(`[LM Settings] Model activated: ${this.pendingModel}`);
      } catch (err) {
        console.error('Failed to save model setting:', err);
      }
    },

    // Remote model methods
    onProviderChange() {
      // Reset to first model of new provider
      const provider = this.remoteProviders.find(p => p.id === this.selectedProvider);

      if (provider && provider.models.length > 0) {
        this.selectedRemoteModel = provider.models[0].id;
      }
    },

    async activateLocalModel() {
      this.activating = true;
      this.activationError = '';

      try {
        // Check if Ollama is running
        const ollamaRes = await fetch('http://127.0.0.1:30114/api/tags', {
          signal: AbortSignal.timeout(5000),
        });

        if (!ollamaRes.ok) {
          this.activationError = 'Cannot connect to Ollama. Make sure the service is running.';

          return;
        }

        // Check if selected model is installed
        if (!this.isPendingModelInstalled) {
          this.activationError = `Model "${this.pendingModel}" is not installed. Please download it first.`;

          return;
        }

        // Save settings
        await ipcRenderer.invoke('settings-write', {
          experimental: {
            modelMode:  'local',
            sullaModel: this.pendingModel,
          },
        });

        this.activeMode = 'local';
        this.activeModel = this.pendingModel;
        console.log(`[LM Settings] Local model activated: ${this.pendingModel}`);
      } catch (err) {
        this.activationError = 'Failed to connect to Ollama. Is the service running?';
        console.error('Failed to activate local model:', err);
      } finally {
        this.activating = false;
      }
    },

    async activateRemoteModel() {
      this.activating = true;
      this.activationError = '';

      try {
        // Validate API key
        if (!this.apiKey.trim()) {
          this.activationError = 'Please enter an API key.';

          return;
        }

        // Test connection to remote API
        const provider = this.currentProvider;

        if (!provider) {
          this.activationError = 'Invalid provider selected.';

          return;
        }

        // Try a simple API call to validate the key
        const testUrl = provider.id === 'grok' || provider.id === 'openai'
          ? `${provider.baseUrl}/models`
          : null;

        if (testUrl) {
          try {
            const testRes = await fetch(testUrl, {
              headers: { Authorization: `Bearer ${this.apiKey}` },
              signal:  AbortSignal.timeout(10000),
            });

            if (!testRes.ok) {
              const errorText = await testRes.text();

              this.activationError = `API key validation failed: ${testRes.status}. Check your API key.`;
              console.error('API validation error:', errorText);

              return;
            }
          } catch {
            this.activationError = 'Could not connect to API. Check your internet connection and API key.';

            return;
          }
        }

        // Save settings
        await ipcRenderer.invoke('settings-write', {
          experimental: {
            modelMode:      'remote',
            remoteProvider: this.selectedProvider,
            remoteModel:    this.selectedRemoteModel,
            remoteApiKey:   this.apiKey,
          },
        });

        this.activeMode = 'remote';
        console.log(`[LM Settings] Remote model activated: ${this.selectedProvider}/${this.selectedRemoteModel}`);
      } catch (err) {
        this.activationError = 'Failed to save remote settings.';
        console.error('Failed to activate remote model:', err);
      } finally {
        this.activating = false;
      }
    },

    async deleteModel(modelName: string) {
      if (!confirm(`Delete model "${ modelName }"?`)) {
        return;
      }

      try {
        const res = await fetch('http://127.0.0.1:30114/api/delete', {
          method:  'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ name: modelName }),
        });

        if (res.ok) {
          await this.loadModels();
        }
      } catch (err) {
        console.error('Error deleting model:', err);
      }
    },

    closeWindow() {
      window.close();
    },
  },
});
</script>

<template>
  <div class="lm-settings">
    <!-- Header -->
    <div class="lm-header">
      <h1>Language Model Settings</h1>
    </div>

    <!-- Main content with sidebar -->
    <div class="lm-content">
      <!-- Sidebar navigation -->
      <nav class="lm-nav">
        <div
          v-for="item in navItems"
          :key="item.id"
          class="nav-item"
          :class="{ active: currentNav === item.id }"
          @click="navClicked(item.id)"
        >
          {{ item.name }}
        </div>
      </nav>

      <!-- Content area -->
      <div class="lm-body">
        <!-- Models Tab -->
        <div
          v-if="currentNav === 'models'"
          class="tab-content"
        >
          <!-- Active Mode Indicator -->
          <div class="active-mode-banner">
            <span class="active-label">Active:</span>
            <span class="active-value">
              {{ activeMode === 'local' ? `Local (${activeModel})` : `Remote (${selectedProvider}/${selectedRemoteModel})` }}
            </span>
          </div>

          <!-- Model Source Tabs -->
          <div class="model-tabs">
            <button
              class="model-tab"
              :class="{ active: viewingTab === 'local' }"
              @click="viewingTab = 'local'; activationError = ''"
            >
              Local Model (Ollama)
            </button>
            <button
              class="model-tab"
              :class="{ active: viewingTab === 'remote' }"
              @click="viewingTab = 'remote'; activationError = ''"
            >
              Remote Model (API)
            </button>
          </div>

          <!-- Activation Error -->
          <div
            v-if="activationError"
            class="activation-error"
          >
            {{ activationError }}
          </div>

          <!-- Local Model Settings (Ollama) -->
          <template v-if="viewingTab === 'local'">
            <!-- Activate Button -->
            <div class="activate-section">
              <button
                class="btn role-primary activate-btn"
                :class="{ 'is-active': activeMode === 'local' }"
                :disabled="activating || activeMode === 'local'"
                @click="activateLocalModel"
              >
                {{ activating ? 'Activating...' : (activeMode === 'local' ? '✓ Active' : 'Activate Local Model') }}
              </button>
            </div>

            <!-- Model Selection -->
            <div class="setting-group">
              <label class="setting-label">Select Model</label>
              <select
                v-model="pendingModel"
                class="model-select"
                :disabled="!!downloadingModel"
              >
                <option
                  v-for="model in availableModels"
                  :key="model.name"
                  :value="model.name"
                >
                  {{ model.displayName }} ({{ model.size }})
                </option>
              </select>
              <p class="setting-description">
                {{ pendingModelDescription }}
              </p>

              <!-- Download button if model not installed -->
              <div
                v-if="!isPendingModelInstalled && !downloadingModel"
                class="model-action"
              >
                <p class="model-status not-installed">
                  This model is not installed.
                </p>
                <button
                  class="btn role-primary"
                  @click="downloadPendingModel"
                >
                  Download Model
                </button>
              </div>

              <!-- Download progress -->
              <div
                v-if="downloadingModel"
                class="download-progress"
              >
                <p class="model-status downloading">
                  Downloading {{ downloadingModel }}...
                </p>
                <div class="progress-bar">
                  <div
                    class="progress-fill"
                    :style="{ width: downloadProgress + '%' }"
                  />
                </div>
                <p class="progress-text">
                  {{ downloadProgress }}% complete
                </p>
              </div>

              <!-- Installed indicator -->
              <div
                v-if="isPendingModelInstalled && !downloadingModel"
                class="model-action"
              >
                <p class="model-status installed">
                  ✓ Model is installed and ready to use.
                </p>
              </div>
            </div>

          </template>

          <!-- Remote Model Settings -->
          <template v-if="viewingTab === 'remote'">
            <!-- Activate Button -->
            <div class="activate-section">
              <button
                class="btn role-primary activate-btn"
                :class="{ 'is-active': activeMode === 'remote' }"
                :disabled="activating || activeMode === 'remote'"
                @click="activateRemoteModel"
              >
                {{ activating ? 'Activating...' : (activeMode === 'remote' ? '✓ Active' : 'Activate Remote Model') }}
              </button>
            </div>

            <!-- Provider Selection -->
            <div class="setting-group">
              <label class="setting-label">API Provider</label>
              <select
                v-model="selectedProvider"
                class="model-select"
                @change="onProviderChange"
              >
                <option
                  v-for="provider in remoteProviders"
                  :key="provider.id"
                  :value="provider.id"
                >
                  {{ provider.name }}
                </option>
              </select>
              <p class="setting-description">
                {{ currentProvider?.description }}
              </p>
            </div>

            <!-- Model Selection -->
            <div class="setting-group">
              <label class="setting-label">Model</label>
              <select
                v-model="selectedRemoteModel"
                class="model-select"
              >
                <option
                  v-for="model in currentProviderModels"
                  :key="model.id"
                  :value="model.id"
                >
                  {{ model.name }}{{ model.pricing ? ` - ${model.pricing}` : '' }}
                </option>
              </select>
              <p class="setting-description">
                {{ selectedRemoteModelDescription }}
              </p>
            </div>

            <!-- API Key -->
            <div class="setting-group">
              <label class="setting-label">API Key</label>
              <div class="api-key-input">
                <input
                  v-model="apiKey"
                  :type="apiKeyVisible ? 'text' : 'password'"
                  class="text-input"
                  placeholder="Enter your API key"
                >
                <button
                  class="btn btn-sm role-secondary"
                  type="button"
                  @click="apiKeyVisible = !apiKeyVisible"
                >
                  {{ apiKeyVisible ? 'Hide' : 'Show' }}
                </button>
              </div>
              <p class="setting-description">
                Get your API key from the {{ currentProvider?.name }} dashboard.
              </p>
            </div>
          </template>
        </div>

      </div>
    </div>

    <!-- Footer -->
    <div class="lm-footer">
      <button
        class="btn role-secondary"
        @click="closeWindow"
      >
        Close
      </button>
    </div>
  </div>
</template>

<style lang="scss" src="@pkg/assets/styles/app.scss"></style>
<style lang="scss" scoped>
.lm-settings {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--body-bg);
  color: var(--body-text);
}

.lm-header {
  height: 3rem;
  font-size: 1.5rem;
  line-height: 2rem;
  display: flex;
  align-items: center;
  padding: 0 0.75rem;
  width: 100%;
  border-bottom: 1px solid var(--header-border);

  h1 {
    flex: 1;
    margin: 0;
    font-size: inherit;
    font-weight: normal;
  }
}

.lm-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.lm-nav {
  width: 200px;
  border-right: 1px solid var(--header-border);
  padding-top: 0.75rem;
  flex-shrink: 0;

  .nav-item {
    font-size: 1.125rem;
    line-height: 1.75rem;
    padding: 0.5rem 0.75rem;
    cursor: pointer;
    user-select: none;

    &.active {
      background-color: var(--nav-active);
    }
  }
}

.lm-body {
  flex: 1;
  padding: 1.5rem;
  overflow: auto;
}

.active-mode-banner {
  background: var(--primary-bg, rgba(59, 130, 246, 0.1));
  border: 1px solid var(--primary, #3b82f6);
  border-radius: 6px;
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;

  .active-label {
    font-weight: 600;
    color: var(--primary, #3b82f6);
  }

  .active-value {
    color: var(--body-text);
  }
}

.model-tabs {
  display: flex;
  gap: 0;
  margin-bottom: 1.5rem;
  border-bottom: 2px solid var(--input-border);
}

.model-tab {
  padding: 0.75rem 1.5rem;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  cursor: pointer;
  font-size: 0.95rem;
  color: var(--muted);
  transition: all 0.2s;

  &:hover {
    color: var(--body-text);
    background: var(--nav-active);
  }

  &.active {
    color: var(--primary, #3b82f6);
    border-bottom-color: var(--primary, #3b82f6);
    font-weight: 500;
  }
}

.activate-section {
  margin-bottom: 1.5rem;
}

.activate-btn {
  min-width: 200px;

  &.is-active {
    background: var(--success, #22c55e);
    border-color: var(--success, #22c55e);
    cursor: default;
  }
}

.activation-error {
  background: var(--error-bg, rgba(239, 68, 68, 0.1));
  border: 1px solid var(--error, #ef4444);
  border-radius: 6px;
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
  color: var(--error, #ef4444);
  font-size: 0.9rem;
}

.tab-content {
  h2 {
    margin: 0 0 0.5rem;
    font-size: 1.1rem;
    font-weight: 500;
  }

  .description {
    color: var(--muted);
    margin-bottom: 1.5rem;
  }
}

.lm-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--header-border);
  display: flex;
  justify-content: flex-end;
}

// Models tab styles
.setting-group {
  margin-bottom: 1.5rem;

  .setting-label {
    display: block;
    font-weight: 500;
    margin-bottom: 0.5rem;
  }

  .setting-description {
    color: var(--muted);
    font-size: 0.875rem;
    margin-top: 0.5rem;
    margin-bottom: 0.5rem;
  }
}

.radio-group {
  display: flex;
  gap: 1.5rem;

  .radio-option {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;

    input[type="radio"] {
      cursor: pointer;
    }
  }
}

.current-model {
  font-size: 0.875rem;
  color: var(--muted);
  margin-bottom: 0.5rem;

  strong {
    color: var(--body-text);
  }
}

.model-select {
  width: 100%;
  max-width: 400px;
  padding: 0.5rem;
  font-size: 0.9rem;
  border: 1px solid var(--input-border);
  border-radius: 4px;
  background: var(--input-bg);
  color: var(--input-text);

  &:focus {
    outline: none;
    border-color: var(--primary);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.text-input {
  flex: 1;
  padding: 0.5rem;
  font-size: 0.9rem;
  border: 1px solid var(--input-border);
  border-radius: 4px;
  background: var(--input-bg);
  color: var(--input-text);

  &:focus {
    outline: none;
    border-color: var(--primary);
  }
}

.api-key-input {
  display: flex;
  gap: 0.5rem;
  max-width: 500px;

  .text-input {
    flex: 1;
  }
}

.model-action {
  margin-top: 1rem;
}

.model-status {
  font-size: 0.875rem;
  margin-bottom: 0.5rem;

  &.not-installed {
    color: var(--warning, #f59e0b);
  }

  &.installed {
    color: var(--success, #22c55e);
  }

  &.downloading {
    color: var(--primary);
  }
}

.download-progress {
  margin-top: 1rem;
}

.progress-bar {
  width: 100%;
  max-width: 400px;
  height: 8px;
  background: var(--input-border);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--primary);
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 0.75rem;
  color: var(--muted);
  margin-top: 0.25rem;
}

.download-section {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1.5rem;

  input {
    flex: 1;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--input-border);
    border-radius: 4px;
    background: var(--input-bg);
    color: var(--input-text);

    &:focus {
      outline: none;
      border-color: var(--primary);
    }
  }
}

.models-table {
  width: 100%;
  border-collapse: collapse;

  th, td {
    padding: 0.75rem;
    text-align: left;
    border-bottom: 1px solid var(--header-border);
  }

  th {
    font-weight: 500;
    color: var(--muted);
    font-size: 0.875rem;
  }

  .model-name {
    font-weight: 500;
  }
}

// Memory tab styles
.memory-layout {
  display: flex;
  gap: 1rem;
  height: calc(100vh - 280px);
}

.pages-list {
  width: 250px;
  border: 1px solid var(--header-border);
  border-radius: 4px;
  overflow: auto;

  .page-item {
    padding: 0.75rem;
    border-bottom: 1px solid var(--header-border);
    cursor: pointer;

    &:hover {
      background: var(--dropdown-hover-bg);
    }

    &.selected {
      background: var(--primary);
      color: var(--primary-text);
    }

    .page-title {
      display: block;
      font-weight: 500;
    }

    .page-type {
      font-size: 0.75rem;
      color: var(--muted);
    }

    &.selected .page-type {
      color: inherit;
      opacity: 0.8;
    }
  }
}

.page-editor {
  flex: 1;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--header-border);
  border-radius: 4px;
  padding: 1rem;

  .editor-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1rem;

    h3 {
      margin: 0;
      font-size: 1rem;
    }

    .badge {
      font-size: 0.75rem;
      padding: 0.25rem 0.5rem;
      background: var(--muted);
      color: var(--body-bg);
      border-radius: 4px;
    }
  }

  .editor-textarea {
    flex: 1;
    padding: 0.75rem;
    border: 1px solid var(--input-border);
    border-radius: 4px;
    background: var(--input-bg);
    color: var(--input-text);
    resize: none;
    font-family: inherit;

    &:focus {
      outline: none;
      border-color: var(--primary);
    }
  }

  .editor-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 1rem;
  }
}

// Resources tab styles
.services-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.service-card {
  border: 1px solid var(--header-border);
  border-radius: 8px;
  padding: 1.25rem;

  .service-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;

    h3 {
      margin: 0;
      font-size: 1rem;
    }
  }

  p {
    color: var(--muted);
    font-size: 0.875rem;
    margin: 0 0 1rem;
  }

  .service-actions {
    display: flex;
    gap: 0.5rem;
  }
}

.status-badge {
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  text-transform: capitalize;

  &.running {
    background: #22c55e;
    color: white;
  }

  &.stopped {
    background: #ef4444;
    color: white;
  }

  &.error {
    background: #f59e0b;
    color: white;
  }

  &.unknown {
    background: var(--muted);
    color: white;
  }
}

// Logs tab styles
.logs-container {
  height: calc(100vh - 280px);
  border: 1px solid var(--header-border);
  border-radius: 4px;
  overflow: auto;
}

.logs-output {
  margin: 0;
  padding: 1rem;
  font-family: monospace;
  font-size: 0.875rem;
  white-space: pre-wrap;
  word-break: break-all;
}

// Common styles
.loading, .empty-state {
  padding: 2rem;
  text-align: center;
  color: var(--muted);
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: background 0.15s;

  &.role-primary {
    background: var(--primary);
    color: var(--primary-text);

    &:hover {
      opacity: 0.9;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  &.role-secondary {
    background: var(--input-bg);
    border: 1px solid var(--input-border);
    color: var(--body-text);

    &:hover {
      background: var(--dropdown-hover-bg);
    }
  }

  &.btn-sm {
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
  }
}
</style>
