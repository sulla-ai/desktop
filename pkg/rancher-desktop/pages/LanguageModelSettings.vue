<script lang="ts">
import { defineComponent } from 'vue';

import { ipcRenderer } from '@pkg/utils/ipcRenderer';

// @ts-ignore - raw-loader import
import soulPromptRaw from '../agent/prompts/soul.md';
// @ts-ignore - raw-loader import
import heartbeatPromptRaw from '../agent/prompts/heartbeat.md';

// Nav items for the Language Model Settings sidebar
const navItems = [
  { id: 'overview', name: 'Overview' },
  { id: 'models', name: 'Models' },
  { id: 'soul', name: 'Soul' },
  { id: 'heartbeat', name: 'Heartbeat' },
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
    name: 'llama3.3:latest', displayName: 'Llama 3.3', size: '4.7GB', minMemoryGB: 6, minCPUs: 2, description: 'Meta\'s latest 70B-distilled 8B model, excellent reasoning',
  },
  {
    name: 'qwen2.5:latest', displayName: 'Qwen 2.5', size: '4.7GB', minMemoryGB: 6, minCPUs: 2, description: 'Alibaba\'s excellent 7B model, strong multilingual performance',
  },
  {
    name: 'qwen2.5-coder:latest', displayName: 'Qwen 2.5 Coder', size: '4.7GB', minMemoryGB: 6, minCPUs: 2, description: 'Alibaba\'s coding-specialized model, excellent for development',
  },
  {
    name: 'deepseek-r1:latest', displayName: 'DeepSeek R1', size: '4.7GB', minMemoryGB: 6, minCPUs: 2, description: 'DeepSeek\'s reasoning model, chain-of-thought capabilities',
  },
  {
    name: 'deepseek-v3:latest', displayName: 'DeepSeek V3', size: '4.7GB', minMemoryGB: 6, minCPUs: 2, description: 'DeepSeek\'s latest general purpose model, strong performance',
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
    signupUrl:   'https://x.ai/api',
    signupText:  'Get API key from xAI',
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
    signupUrl:   'https://platform.openai.com/signup',
    signupText:  'Get API key from OpenAI',
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
    signupUrl:   'https://console.anthropic.com/',
    signupText:  'Get API key from Anthropic',
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
    signupUrl:   'https://ai.google.dev/',
    signupText:  'Get API key from Google AI',
  },
  {
    id:          'kimi',
    name:        'Kimi (Moonshot AI)',
    description: 'Kimi K2.5 models from Moonshot AI',
    baseUrl:     'https://api.moonshot.cn/v1',
    models:      [
      { id: 'kimi-k2.5', name: 'Kimi K2.5', description: '256K context, advanced reasoning and long-context capabilities' },
      { id: 'kimi-k2', name: 'Kimi K2', description: '200K context, balanced performance' },
    ],
    signupUrl:   'https://platform.moonshot.cn/',
    signupText:  'Get API key from Moonshot AI',
  },
  {
    id:          'nvidia',
    name:        'NVIDIA (Free Moonshot/Kimi)',
    description: 'Access Moonshot Kimi models for free through NVIDIA API',
    baseUrl:     'https://integrate.api.nvidia.com/v1',
    models:      [
      { id: 'moonshotai/kimi-k2.5', name: 'Kimi K2.5 (Free)', description: '256K context, FREE through NVIDIA API' },
      { id: 'moonshotai/kimi-k2', name: 'Kimi K2 (Free)', description: '200K context, FREE through NVIDIA API' },
      { id: 'nvidia/llama-3.1-nemotron-70b-instruct', name: 'Llama 3.1 Nemotron 70B', description: 'NVIDIA optimized Llama model' },
      { id: 'meta/llama-3.1-70b-instruct', name: 'Llama 3.1 70B', description: 'Meta Llama 3.1' },
    ],
    signupUrl:   'https://build.nvidia.com/',
    signupText:  'Get free API key from NVIDIA (includes Moonshot access)',
  },
];

export default defineComponent({
  name: 'language-model-settings',

  data() {
    const defaultSoulPrompt = (typeof soulPromptRaw === 'string' ? soulPromptRaw : soulPromptRaw.default) || '';
    const defaultHeartbeatPrompt = (typeof heartbeatPromptRaw === 'string' ? heartbeatPromptRaw : heartbeatPromptRaw.default) || '';

    return {
      currentNav:       'overview' as string,
      navItems,
      // Overview dashboard metrics
      containerStats: {
        cpuPercent:    0,
        memoryUsage:   0,
        memoryLimit:   0,
        memoryPercent: 0,
        status:        'unknown' as string,
      },
      statsInterval:    null as ReturnType<typeof setInterval> | null,
      loadingStats:     false,
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
      remoteRetryCount:     3, // Number of retries before falling back to local LLM
      remoteTimeoutSeconds: 60, // Remote API timeout limit in seconds
      // Local Ollama settings
      localTimeoutSeconds:  120, // Local Ollama timeout limit in seconds
      localRetryCount:      2, // Number of retries for local Ollama
      // Heartbeat settings
      heartbeatEnabled:     true,
      heartbeatDelayMinutes: 30,
      defaultHeartbeatPrompt,
      heartbeatPrompt:      '',
      heartbeatModel:       'default' as string, // 'default' or specific model like 'local:tinyllama:latest' or 'remote:grok:grok-4-1-fast-reasoning'

      // Soul prompt settings
      defaultSoulPrompt,
      soulPrompt: '',
      botName: 'Sulla',
      primaryUserName: '',

      // Activation state
      activating:           false,
      activationError:      '' as string,
      savingSettings:       false,
    };
  },

  computed: {
    currentNavItem(): { id: string; name: string } {
      return this.navItems.find(item => item.id === this.currentNav) || this.navItems[0];
    },
    soulPromptEditor: {
      get(): string {
        const override = String(this.soulPrompt || '');
        return override.trim() ? override : String(this.defaultSoulPrompt || '');
      },
      set(val: string) {
        this.soulPrompt = String(val || '');
      },
    },
    heartbeatPromptEditor: {
      get(): string {
        const override = String(this.heartbeatPrompt || '');
        return override.trim() ? override : String(this.defaultHeartbeatPrompt || '');
      },
      set(val: string) {
        this.heartbeatPrompt = String(val || '');
      },
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
    formattedMemoryUsage(): string {
      return this.formatBytes(this.containerStats.memoryUsage);
    },
    formattedMemoryLimit(): string {
      return this.formatBytes(this.containerStats.memoryLimit);
    },
  },

  async mounted() {
    // Load saved settings
    ipcRenderer.on('settings-read', (_event: unknown, settings: {
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
        localTimeoutSeconds?: number;
        localRetryCount?: number;
        heartbeatEnabled?: boolean;
        heartbeatDelayMinutes?: number;
        heartbeatPrompt?: string;
        heartbeatModel?: string;
      };
    }) => {
      if (settings.experimental?.sullaModel) {
        this.activeModel = settings.experimental.sullaModel;
        this.pendingModel = settings.experimental.sullaModel;
      }
      if (settings.experimental?.soulPrompt !== undefined) {
        this.soulPrompt = settings.experimental.soulPrompt;
      }
      if (settings.experimental?.botName !== undefined) {
        this.botName = settings.experimental.botName;
      }
      if (settings.experimental?.primaryUserName !== undefined) {
        this.primaryUserName = settings.experimental.primaryUserName;
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
      if (settings.experimental?.remoteRetryCount !== undefined) {
        this.remoteRetryCount = settings.experimental.remoteRetryCount;
      }
      if (settings.experimental?.remoteTimeoutSeconds !== undefined) {
        this.remoteTimeoutSeconds = settings.experimental.remoteTimeoutSeconds;
      }
      if (settings.experimental?.localTimeoutSeconds !== undefined) {
        this.localTimeoutSeconds = settings.experimental.localTimeoutSeconds;
      }
      if (settings.experimental?.localRetryCount !== undefined) {
        this.localRetryCount = settings.experimental.localRetryCount;
      }
      if (settings.experimental?.heartbeatEnabled !== undefined) {
        this.heartbeatEnabled = settings.experimental.heartbeatEnabled;
      }
      if (settings.experimental?.heartbeatDelayMinutes !== undefined) {
        this.heartbeatDelayMinutes = settings.experimental.heartbeatDelayMinutes;
      }
      if (settings.experimental?.heartbeatPrompt !== undefined) {
        this.heartbeatPrompt = settings.experimental.heartbeatPrompt;
      }
      if (settings.experimental?.heartbeatModel) {
        this.heartbeatModel = settings.experimental.heartbeatModel;
      }
    });
    ipcRenderer.send('settings-read');

    await this.loadModels();
    // Start fetching container stats
    this.fetchContainerStats();
    this.statsInterval = setInterval(() => this.fetchContainerStats(), 3000);
    ipcRenderer.send('dialog/ready');
  },

  beforeUnmount() {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
  },

  methods: {
    navClicked(navId: string) {
      this.currentNav = navId;
      if (navId === 'models') {
        this.loadModels();
      }
    },

    async fetchContainerStats() {
      try {
        // Query Ollama API for service status and running models
        const [tagsRes, psRes] = await Promise.all([
          fetch('http://127.0.0.1:30114/api/tags', { signal: AbortSignal.timeout(3000) }).catch(() => null),
          fetch('http://127.0.0.1:30114/api/ps', { signal: AbortSignal.timeout(3000) }).catch(() => null),
        ]);

        if (!tagsRes || !tagsRes.ok) {
          this.containerStats.status = 'offline';

          return;
        }

        this.containerStats.status = 'running';

        // Get running models info from /api/ps
        if (psRes && psRes.ok) {
          const psData = await psRes.json();
          const runningModels = psData.models || [];

          if (runningModels.length > 0) {
            // Sum up memory usage from all running models
            let totalSize = 0;
            let totalVramSize = 0;

            for (const model of runningModels) {
              totalSize += model.size || 0;
              totalVramSize += model.size_vram || 0;
            }

            // Use model size as memory indicator (actual VRAM/RAM used)
            this.containerStats.memoryUsage = totalVramSize || totalSize;
            // Estimate limit based on typical system (this is approximate)
            this.containerStats.memoryLimit = 16 * 1024 * 1024 * 1024; // 16GB default
            this.containerStats.memoryPercent = (this.containerStats.memoryUsage / this.containerStats.memoryLimit) * 100;

            // Store running model count for display
            (this.containerStats as Record<string, unknown>).runningModels = runningModels.length;
            (this.containerStats as Record<string, unknown>).modelDetails = runningModels.map((m: { name: string; size: number }) => ({
              name:  m.name,
              size:  m.size,
            }));
          } else {
            this.containerStats.memoryUsage = 0;
            this.containerStats.memoryPercent = 0;
            (this.containerStats as Record<string, unknown>).runningModels = 0;
            (this.containerStats as Record<string, unknown>).modelDetails = [];
          }
        }
      } catch (err) {
        console.warn('[LM Settings] Failed to fetch Ollama stats:', err);
        this.containerStats.status = 'error';
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
        await this.writeExperimentalSettings({ modelMode: 'local' });

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
        const timeoutMs = Math.max(1000, Math.min(300, this.remoteTimeoutSeconds)) * 1000;

        if (provider.id === 'grok' || provider.id === 'openai' || provider.id === 'kimi' || provider.id === 'nvidia') {
          const testUrl = `${provider.baseUrl}/chat/completions`;
          const testBody = {
            model:       this.selectedRemoteModel,
            messages:    [{ role: 'user', content: 'Reply with the word: OK' }],
            temperature: 0,
            max_tokens:  10,
          };

          console.log('[Remote Test] Provider:', provider.id);
          console.log('[Remote Test] URL:', testUrl);
          console.log('[Remote Test] Model:', this.selectedRemoteModel);
          console.log('[Remote Test] API Key starts with:', this.apiKey.substring(0, 10) + '...');

          try {
            const testRes = await fetch(testUrl, {
              method:  'POST',
              headers: {
                'Content-Type':  'application/json',
                Authorization:   `Bearer ${this.apiKey}`,
              },
              body:    JSON.stringify(testBody),
              signal:  AbortSignal.timeout(timeoutMs),
            });

            if (!testRes.ok) {
              const errorText = await testRes.text();
              console.error('[Remote Test] Error response:', testRes.status, errorText);

              this.activationError = `Remote model test failed: ${testRes.status}. Check model, key, and timeout.`;
              console.error('Remote model test error:', errorText);

              return;
            }
          } catch (err) {
            this.activationError = 'Remote model test failed (timeout/network). Check connection, API key, and timeout.';
            console.error('Remote model test error:', err);

            return;
          }
        } else {
          this.activationError = 'Remote provider test is not supported for this provider yet.';

          return;
        }

        // Save settings
        await this.writeExperimentalSettings({ modelMode: 'remote' });

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

    async saveSettings() {
      if (this.savingSettings) {
        return;
      }

      this.savingSettings = true;
      try {
        await this.writeExperimentalSettings();
        console.log('[LM Settings] Settings saved');
      } catch (err) {
        console.error('Failed to save LM settings:', err);
      } finally {
        this.savingSettings = false;
      }
    },

    async writeExperimentalSettings(extra: Record<string, unknown> = {}) {
      await ipcRenderer.invoke('settings-write', {
        experimental: {
          ...extra,
          sullaModel:            this.pendingModel,
          soulPrompt:            this.soulPrompt,
          botName:               this.botName,
          primaryUserName:       this.primaryUserName,
          remoteProvider:        this.selectedProvider,
          remoteModel:           this.selectedRemoteModel,
          remoteApiKey:          this.apiKey,
          remoteRetryCount:      this.remoteRetryCount,
          remoteTimeoutSeconds:  this.remoteTimeoutSeconds,
          localTimeoutSeconds:   this.localTimeoutSeconds,
          localRetryCount:       this.localRetryCount,
          heartbeatEnabled:      this.heartbeatEnabled,
          heartbeatDelayMinutes: this.heartbeatDelayMinutes,
          heartbeatPrompt:       this.heartbeatPrompt,
          heartbeatModel:        this.heartbeatModel,
        },
      });
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
        <!-- Overview Tab -->
        <div
          v-if="currentNav === 'overview'"
          class="tab-content"
        >
          <h2>Ollama Container Status</h2>
          <p class="description">
            Monitor the resource usage of your local Ollama container.
          </p>

          <!-- Status Badge -->
          <div class="status-section">
            <span class="status-label">Status:</span>
            <span
              class="status-badge"
              :class="{
                'status-running': containerStats.status === 'running',
                'status-stopped': containerStats.status === 'exited' || containerStats.status === 'stopped',
                'status-error': containerStats.status === 'error' || containerStats.status === 'docker_unavailable',
                'status-unknown': containerStats.status === 'unknown' || containerStats.status === 'not_found',
              }"
            >
              {{ containerStats.status === 'docker_unavailable' ? 'Docker Unavailable' :
                 containerStats.status === 'not_found' ? 'Container Not Found' :
                 containerStats.status.charAt(0).toUpperCase() + containerStats.status.slice(1) }}
            </span>
          </div>

          <!-- Metrics Cards -->
          <div
            v-if="containerStats.status === 'running'"
            class="metrics-grid"
          >
            <!-- Running Models -->
            <div class="metric-card">
              <div class="metric-header">
                <span class="metric-title">Running Models</span>
              </div>
              <div class="metric-value">
                {{ (containerStats as any).runningModels || 0 }}
              </div>
              <div
                v-if="(containerStats as any).modelDetails?.length"
                class="metric-subtext"
              >
                {{ (containerStats as any).modelDetails.map((m: any) => m.name).join(', ') }}
              </div>
              <div
                v-else
                class="metric-subtext"
              >
                No models loaded
              </div>
            </div>

            <!-- Model Memory Usage -->
            <div class="metric-card">
              <div class="metric-header">
                <span class="metric-title">Model Memory</span>
              </div>
              <div class="metric-value">
                {{ formattedMemoryUsage }}
              </div>
              <div class="metric-bar">
                <div
                  class="metric-bar-fill memory-bar"
                  :style="{ width: Math.min(containerStats.memoryPercent, 100) + '%' }"
                />
              </div>
              <div class="metric-subtext">
                Memory used by loaded models
              </div>
            </div>
          </div>

          <!-- Not Running Message -->
          <div
            v-else
            class="not-running-message"
          >
            <p v-if="containerStats.status === 'offline'">
              Ollama service is offline. Make sure it's running on port 30114.
            </p>
            <p v-else-if="containerStats.status === 'error'">
              Unable to connect to Ollama service.
            </p>
            <p v-else>
              Checking Ollama status...
            </p>
          </div>

          <!-- Active Model Info -->
          <div class="active-model-section">
            <h3>Active Configuration</h3>
            <div class="config-item">
              <span class="config-label">Mode:</span>
              <span class="config-value">{{ activeMode === 'local' ? 'Local (Ollama)' : 'Remote (API)' }}</span>
            </div>
            <div
              v-if="activeMode === 'local'"
              class="config-item"
            >
              <span class="config-label">Model:</span>
              <span class="config-value">{{ activeModel }}</span>
            </div>
            <div
              v-else
              class="config-item"
            >
              <span class="config-label">Provider:</span>
              <span class="config-value">{{ selectedProvider }} / {{ selectedRemoteModel }}</span>
            </div>
          </div>
        </div>

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

            <!-- Timeout Limit (seconds) -->
            <div class="setting-group">
              <label class="setting-label">Timeout Limit (seconds)</label>
              <div class="timeout-input">
                <input
                  v-model.number="localTimeoutSeconds"
                  type="number"
                  class="text-input"
                  min="10"
                  max="600"
                  style="width: 120px;"
                >
              </div>
              <p class="setting-description">
                Timeout limit for local Ollama API calls (in seconds). Default is 120 seconds.
              </p>
            </div>

            <!-- Retry Count -->
            <div class="setting-group">
              <label class="setting-label">Retry Count</label>
              <div class="retry-input">
                <input
                  v-model.number="localRetryCount"
                  type="number"
                  class="text-input"
                  min="0"
                  max="10"
                  style="width: 80px;"
                >
              </div>
              <p class="setting-description">
                Number of retries for failed local Ollama requests. Set to 0 to disable retries.
              </p>
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
                <a
                  :href="currentProvider?.signupUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="provider-signup-link"
                >
                  {{ currentProvider?.signupText || `Get API key from ${currentProvider?.name}` }}
                </a>
              </p>
            </div>

            <!-- Retry Count -->
            <div class="setting-group">
              <label class="setting-label">Retry Count</label>
              <div class="retry-input">
                <input
                  v-model.number="remoteRetryCount"
                  type="number"
                  class="text-input"
                  min="0"
                  max="10"
                  style="width: 80px;"
                >
              </div>
              <p class="setting-description">
                Number of retries before falling back to local Ollama model. Set to 0 to disable fallback.
              </p>
            </div>

            <!-- Timeout Limit (seconds) -->
            <div class="setting-group">
              <label class="setting-label">Timeout Limit (seconds)</label>
              <div class="timeout-input">
                <input
                  v-model.number="remoteTimeoutSeconds"
                  type="number"
                  class="text-input"
                  min="1"
                  max="300"
                  style="width: 120px;"
                >
              </div>
              <p class="setting-description">
                Timeout limit for remote API calls (in seconds).
              </p>
            </div>
          </template>
        </div>

        <!-- Soul Tab -->
        <div
          v-if="currentNav === 'soul'"
          class="tab-content"
        >
          <h2>Soul</h2>
          <p class="description">
            Configure the agent's identity and system prompt. The bot name and user name will be prefixed to the soul prompt.
          </p>

          <div class="form-group" style="margin-bottom: 1.5rem;">
            <label class="form-label">Bot Name</label>
            <input
              v-model="botName"
              type="text"
              class="text-input"
              placeholder="Sulla"
              style="max-width: 400px;"
            >
            <p class="setting-description">
              The name of the AI assistant (default: Sulla)
            </p>
          </div>

          <div class="form-group" style="margin-bottom: 2rem;">
            <label class="form-label">Primary User Name</label>
            <input
              v-model="primaryUserName"
              type="text"
              class="text-input"
              placeholder="Enter your name (optional)"
              style="max-width: 400px;"
            >
            <p class="setting-description">
              Your name (optional) - helps personalize interactions
            </p>
          </div>

          <div class="form-group">
            <label class="form-label">Soul Prompt</label>
            <textarea
              v-model="soulPromptEditor"
              class="soul-textarea"
              spellcheck="false"
            />
            <p class="setting-description">
              The system prompt that shapes the agent's personality and behavior. Leave blank to use the built-in default.
            </p>
            <div class="soul-actions">
              <button
                class="btn role-secondary"
                type="button"
                @click="soulPrompt = ''"
              >
                Reset to default
              </button>
            </div>
          </div>
        </div>

        <!-- Heartbeat Tab -->
        <div
          v-if="currentNav === 'heartbeat'"
          class="tab-content"
        >
          <h2>Heartbeat Settings</h2>
          <p class="description">
            Configure a periodic heartbeat that triggers the agent to check in and review its state.
          </p>

          <!-- Enable/Disable Toggle -->
          <div class="setting-group">
            <label class="setting-label">Enable Heartbeat</label>
            <div class="toggle-switch">
              <label class="switch">
                <input
                  v-model="heartbeatEnabled"
                  type="checkbox"
                >
                <span class="slider" />
              </label>
              <span class="toggle-label">{{ heartbeatEnabled ? 'Enabled' : 'Disabled' }}</span>
            </div>
            <p class="setting-description">
              When enabled, the agent will periodically wake up and process the heartbeat prompt.
            </p>
          </div>

          <!-- Delay Setting -->
          <div class="setting-group">
            <label class="setting-label">Heartbeat Interval (minutes)</label>
            <div class="delay-input">
              <input
                v-model.number="heartbeatDelayMinutes"
                type="number"
                class="text-input"
                min="1"
                max="1440"
                style="width: 120px;"
              >
            </div>
            <p class="setting-description">
              How often the heartbeat should trigger (1-1440 minutes). Default is 30 minutes.
            </p>
          </div>

          <!-- Model Setting -->
          <div class="setting-group">
            <label class="setting-label">Heartbeat Model</label>
            <select
              v-model="heartbeatModel"
              class="model-select"
            >
              <option value="default">
                Use System Default
              </option>
              <optgroup label="Local Models (Ollama)">
                <option
                  v-for="model in installedModels"
                  :key="'local:' + model.name"
                  :value="'local:' + model.name"
                >
                  {{ model.name }}
                </option>
              </optgroup>
              <optgroup
                v-for="provider in remoteProviders"
                :key="provider.id"
                :label="'Remote: ' + provider.name"
              >
                <option
                  v-for="model in provider.models"
                  :key="'remote:' + provider.id + ':' + model.id"
                  :value="'remote:' + provider.id + ':' + model.id"
                >
                  {{ model.name }}
                </option>
              </optgroup>
            </select>
            <p class="setting-description">
              Select which model to use for heartbeat processing. "Use System Default" follows your main model settings.
            </p>
          </div>

          <!-- Instructions Setting -->
          <div class="setting-group">
            <label class="setting-label">Heartbeat Instructions</label>
            <textarea
              v-model="heartbeatPromptEditor"
              class="soul-textarea"
              spellcheck="false"
            />
            <p class="setting-description">
              Instructions sent to the agent each time the heartbeat triggers. Leave blank to use the built-in default.
            </p>
            <div class="soul-actions">
              <button
                class="btn role-secondary"
                type="button"
                @click="heartbeatPrompt = ''"
              >
                Reset to default
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- Footer -->
    <div class="lm-footer">
      <button
        class="btn role-primary"
        :disabled="activating || savingSettings"
        @click="saveSettings"
      >
        {{ savingSettings ? 'Saving...' : 'Save' }}
      </button>
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
  border-top: none;
  border-left: none;
  border-right: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  cursor: pointer;
  font-size: 0.95rem;
  color: var(--muted);
  transition: all 0.2s;
  outline: none;

  &:focus {
    outline: none;
    box-shadow: none;
  }

  &:focus-visible {
    outline: 2px solid var(--primary, #3b82f6);
    outline-offset: -2px;
  }

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
    background: var(--success, #22c55e) !important;
    border-color: var(--success, #22c55e) !important;
    color: white !important;
    opacity: 1 !important;
    cursor: default;
  }

  &.is-active:disabled {
    background: var(--success, #22c55e) !important;
    border-color: var(--success, #22c55e) !important;
    color: white !important;
    opacity: 1 !important;
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

  h3 {
    margin: 1.5rem 0 0.75rem;
    font-size: 1rem;
    font-weight: 500;
  }

  .description {
    color: var(--muted);
    margin-bottom: 1.5rem;
  }
}

// Overview tab styles
.status-section {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.5rem;

  .status-label {
    font-weight: 500;
  }

  .status-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.85rem;
    font-weight: 500;

    &.status-running {
      background: rgba(34, 197, 94, 0.15);
      color: #22c55e;
    }

    &.status-stopped {
      background: rgba(234, 179, 8, 0.15);
      color: #eab308;
    }

    &.status-error {
      background: rgba(239, 68, 68, 0.15);
      color: #ef4444;
    }

    &.status-unknown {
      background: rgba(156, 163, 175, 0.15);
      color: #9ca3af;
    }
  }
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.metric-card {
  background: var(--input-bg, rgba(0, 0, 0, 0.1));
  border: 1px solid var(--input-border);
  border-radius: 8px;
  padding: 1rem;

  .metric-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .metric-title {
    font-size: 0.9rem;
    color: var(--muted);
  }

  .metric-value {
    font-size: 1.5rem;
    font-weight: 600;
    margin-bottom: 0.75rem;
  }

  .metric-bar {
    height: 8px;
    background: var(--input-border);
    border-radius: 4px;
    overflow: hidden;
  }

  .metric-bar-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.3s ease;

    &.cpu-bar {
      background: linear-gradient(90deg, #3b82f6, #8b5cf6);
    }

    &.memory-bar {
      background: linear-gradient(90deg, #22c55e, #eab308);
    }
  }

  .metric-subtext {
    font-size: 0.8rem;
    color: var(--muted);
    margin-top: 0.5rem;
  }
}

.not-running-message {
  background: var(--input-bg, rgba(0, 0, 0, 0.1));
  border: 1px solid var(--input-border);
  border-radius: 8px;
  padding: 2rem;
  text-align: center;
  color: var(--muted);

  p {
    margin: 0;
  }
}

.active-model-section {
  background: var(--input-bg, rgba(0, 0, 0, 0.1));
  border: 1px solid var(--input-border);
  border-radius: 8px;
  padding: 1rem;

  h3 {
    margin: 0 0 0.75rem !important;
  }

  .config-item {
    display: flex;
    gap: 0.5rem;
    padding: 0.25rem 0;

    .config-label {
      color: var(--muted);
      min-width: 80px;
    }

    .config-value {
      font-weight: 500;
    }
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
    opacity: 0.6;
    margin-bottom: 0.5rem;

    .provider-signup-link {
      color: var(--primary, #3b82f6);
      text-decoration: none;
      font-weight: 500;

      &:hover {
        text-decoration: underline;
      }
    }
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

.soul-textarea {
  width: 100%;
  max-width: 900px;
  padding: 0.75rem;
  font-size: 0.85rem;
  line-height: 1.5;
  border: 1px solid var(--input-border);
  border-radius: 6px;
  background: var(--input-bg);
  color: var(--input-text);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  resize: vertical;
  min-height: 520px;

  &:focus {
    outline: none;
    border-color: var(--primary);
  }
}

.soul-actions {
  margin-top: 0.75rem;
  display: flex;
  gap: 0.75rem;
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

// Toggle switch styles
.toggle-switch {
  display: flex;
  align-items: center;
  gap: 0.75rem;

  .toggle-label {
    font-size: 0.9rem;
    color: var(--body-text);
  }
}

.switch {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 24px;

  input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: var(--input-border);
    transition: 0.3s;
    border-radius: 24px;

    &::before {
      position: absolute;
      content: "";
      height: 18px;
      width: 18px;
      left: 3px;
      bottom: 3px;
      background-color: white;
      transition: 0.3s;
      border-radius: 50%;
    }
  }

  input:checked + .slider {
    background-color: var(--primary, #3b82f6);
  }

  input:checked + .slider::before {
    transform: translateX(24px);
  }

  input:disabled + .slider {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.prompt-textarea {
  width: 100%;
  max-width: 600px;
  padding: 0.75rem;
  font-size: 0.9rem;
  border: 1px solid var(--input-border);
  border-radius: 4px;
  background: var(--input-bg);
  color: var(--input-text);
  font-family: inherit;
  resize: vertical;
  min-height: 100px;

  &:focus {
    outline: none;
    border-color: var(--primary);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
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
