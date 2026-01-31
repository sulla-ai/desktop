<template>
  <div class="first-run-container">
    <h2 data-test="k8s-settings-header">
      Welcome to Sulla Desktop by Jonathon Byrdziak
    </h2>
    <p class="welcome-text">
      Sulla Desktop provides a local AI assistant with Kubernetes-powered services
      including local LLM models, persistent memory graph, and full integration with the client machine.
    </p>
    <rd-fieldset
      v-if="hasSystemPreferences"
      legend-text="Virtual Machine Resources"
      legend-tooltip="Allocate CPU and memory for the AI services"
    >
      <system-preferences
        :memory-in-g-b="settings.virtualMachine.memoryInGB"
        :number-c-p-us="settings.virtualMachine.numberCPUs"
        :avail-memory-in-g-b="availMemoryInGB"
        :avail-num-c-p-us="availNumCPUs"
        :reserved-memory-in-g-b="6"
        :reserved-num-c-p-us="1"
        :is-locked-memory="memoryLocked"
        :is-locked-cpu="cpuLocked"
        @update:memory="onMemoryChange"
        @update:cpu="onCpuChange"
      />
    </rd-fieldset>
    <rd-fieldset
      legend-text="AI Model"
      legend-tooltip="Select the LLM model to use. Models are filtered based on your allocated resources."
    >
      <select
        v-model="selectedModel"
        class="model-select"
        @change="onModelChange"
      >
        <option
          v-for="model in availableModels"
          :key="model.name"
          :value="model.name"
          :disabled="!model.available"
          :class="{ 'model-disabled': !model.available }"
        >
          {{ model.displayName }} ({{ model.size }}) {{ !model.available ? '- Requires more resources' : '' }}
        </option>
      </select>
      <p class="model-description">
        {{ selectedModelDescription }}
      </p>
    </rd-fieldset>
    <rd-fieldset
      v-if="pathManagementRelevant"
      :legend-text="t('pathManagement.label')"
      :legend-tooltip="t('pathManagement.tooltip', { }, true)"
      :is-locked="pathManagementSelectorLocked"
    >
      <path-management-selector
        :value="pathManagementStrategy"
        :is-locked="pathManagementSelectorLocked"
        :show-label="false"
        @input="setPathManagementStrategy"
      />
    </rd-fieldset>
    <div class="button-area">
      <button
        v-focus
        data-test="accept-btn"
        class="role-primary"
        @click="close"
      >
        Get Started
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import os from 'os';

import _ from 'lodash';
import { defineComponent } from 'vue';
import { mapGetters } from 'vuex';

import PathManagementSelector from '@pkg/components/PathManagementSelector.vue';
import SystemPreferences from '@pkg/components/SystemPreferences.vue';
import RdFieldset from '@pkg/components/form/RdFieldset.vue';
import { defaultSettings } from '@pkg/config/settings';
import type { Settings } from '@pkg/config/settings';
import { PathManagementStrategy } from '@pkg/integrations/pathManager';
import { ipcRenderer } from '@pkg/utils/ipcRenderer';
import { highestStableVersion, VersionEntry } from '@pkg/utils/kubeVersions';
import { RecursivePartial } from '@pkg/utils/typeUtils';

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

export default defineComponent({
  name:       'first-run-dialog',
  components: {
    RdFieldset,
    PathManagementSelector,
    SystemPreferences,
  },
  layout: 'dialog',
  data() {
    return {
      settings:                     defaultSettings,
      pathManagementSelectorLocked: false,
      memoryLocked:                 false,
      cpuLocked:                    false,
      selectedModel:                'tinyllama:latest',
      kubernetesVersion:            '',
    };
  },
  computed: {
    ...mapGetters('applicationSettings', { pathManagementStrategy: 'pathManagementStrategy' }),
    pathManagementRelevant(): boolean {
      return os.platform() === 'linux' || os.platform() === 'darwin';
    },
    hasSystemPreferences(): boolean {
      return !os.platform().startsWith('win');
    },
    availMemoryInGB(): number {
      return Math.ceil(os.totalmem() / 2 ** 30);
    },
    availNumCPUs(): number {
      return os.cpus().length;
    },
    allocatedMemoryGB(): number {
      return this.settings.virtualMachine.memoryInGB;
    },
    allocatedCPUs(): number {
      return this.settings.virtualMachine.numberCPUs;
    },
    // Ollama gets ~70% of VM memory and ~75% of CPUs (rest for K8s, other pods)
    ollamaMemoryGB(): number {
      return Math.floor(this.allocatedMemoryGB * 0.7);
    },
    ollamaCPUs(): number {
      return Math.floor(this.allocatedCPUs * 0.75);
    },
    availableModels(): Array<{ name: string; displayName: string; size: string; available: boolean; description: string }> {
      return OLLAMA_MODELS.map(model => ({
        ...model,
        // Filter based on what Ollama actually gets, not total VM resources
        available: this.ollamaMemoryGB >= model.minMemoryGB && this.ollamaCPUs >= model.minCPUs,
      }));
    },
    selectedModelDescription(): string {
      const model = OLLAMA_MODELS.find(m => m.name === this.selectedModel);

      return model?.description || '';
    },
  },
  beforeMount() {
    window.addEventListener('beforeunload', this.close);
  },
  mounted() {
    ipcRenderer.on('settings-read', (event, settings) => {
      this.$data.settings = settings;
      // Load saved model selection if available
      if (settings.experimental?.sullaModel) {
        this.$data.selectedModel = settings.experimental.sullaModel;
      }
      this.autoSelectBestModel();
    });
    ipcRenderer.send('settings-read');

    // Get K8s versions and select the highest stable version
    ipcRenderer.on('k8s-versions', (event, versions: VersionEntry[]) => {
      const recommendedVersions = versions.filter((v: VersionEntry) => !!v.channels);
      const bestVersion = highestStableVersion(recommendedVersions) ?? versions[0];

      if (bestVersion) {
        this.$data.kubernetesVersion = bestVersion.version;
        console.log(`[FirstRun] Selected K8s version: ${bestVersion.version}`);
      }

      // Send ready event after we have the K8s version
      ipcRenderer.send('dialog/ready');
    });
    ipcRenderer.send('k8s-versions');

    if (this.pathManagementRelevant) {
      this.setPathManagementStrategy(PathManagementStrategy.RcFiles);
    }

    ipcRenderer.invoke('get-locked-fields').then((lockedFields) => {
      this.$data.pathManagementSelectorLocked = _.get(lockedFields, 'application.pathManagementStrategy');
      this.$data.memoryLocked = _.get(lockedFields, 'virtualMachine.memoryInGB');
      this.$data.cpuLocked = _.get(lockedFields, 'virtualMachine.numberCPUs');
    });
  },
  beforeUnmount() {
    window.removeEventListener('beforeunload', this.close);
  },
  methods: {
    async commitChanges(settings: RecursivePartial<Settings>) {
      try {
        return await ipcRenderer.invoke('settings-write', settings);
      } catch (ex) {
        console.log(`invoke settings-write failed: `, ex);
      }
    },
    close() {
      this.commitChanges({
        application:    { pathManagementStrategy: this.pathManagementStrategy },
        virtualMachine: {
          memoryInGB: this.settings.virtualMachine.memoryInGB,
          numberCPUs: this.settings.virtualMachine.numberCPUs,
        },
        kubernetes:   {
          enabled: true,
          version: this.kubernetesVersion,
        },
        experimental: { sullaModel: this.selectedModel },
      });
      window.close();
    },
    setPathManagementStrategy(val: PathManagementStrategy) {
      this.$store.dispatch('applicationSettings/setPathManagementStrategy', val);
    },
    onMemoryChange(value: number) {
      this.settings.virtualMachine.memoryInGB = value;
      this.autoSelectBestModel();
    },
    onCpuChange(value: number) {
      this.settings.virtualMachine.numberCPUs = value;
      this.autoSelectBestModel();
    },
    onModelChange() {
      // Model selection is handled by v-model
    },
    autoSelectBestModel() {
      // If current selection is no longer available, select the best available model
      const currentModel = this.availableModels.find(m => m.name === this.selectedModel);

      if (!currentModel?.available) {
        // Find the best (largest) available model
        const available = this.availableModels.filter(m => m.available);

        if (available.length > 0) {
          this.selectedModel = available[available.length - 1].name;
        } else {
          // Fallback to tinyllama if nothing is available
          this.selectedModel = 'tinyllama:latest';
        }
      }
    },
  },
});
</script>

<style lang="scss">
  html {
    height: initial;
  }
</style>

<style lang="scss" scoped>
  .button-area {
    align-self: flex-end;
    margin-top: 1.5rem;
  }

  .welcome-text {
    color: var(--body-text);
    margin-bottom: 1rem;
    line-height: 1.5;
  }

  .first-run-container {
    width: 30rem;
  }

  .model-select {
    width: 100%;
    padding: 0.5rem;
    font-size: 0.9rem;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--input-bg);
    color: var(--input-text);
    margin-top: 0.5rem;

    option {
      padding: 0.5rem;
    }

    option:disabled {
      color: var(--disabled);
      font-style: italic;
    }
  }

  .model-description {
    margin-top: 0.5rem;
    font-size: 0.85rem;
    color: var(--muted);
    font-style: italic;
  }

  .model-disabled {
    color: var(--disabled);
  }
</style>
