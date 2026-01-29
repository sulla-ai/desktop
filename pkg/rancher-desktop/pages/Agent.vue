<template>
  <div class="agent">
    <!-- Loading overlay while system boots -->
    <div
      v-if="!systemReady"
      class="loading-overlay"
    >
      <div class="loading-content">
        <div class="loading-spinner">
          ⚙️
        </div>
        <h2>Starting Sulla...</h2>
        <p class="progress-text">
          {{ progressDescription || 'Initializing system...' }}
        </p>
        <div
          v-if="progressMax > 0"
          class="progress-bar-container"
        >
          <div
            class="progress-bar-fill"
            :style="{ width: progressPercent + '%' }"
          />
        </div>
        <div
          v-else
          class="progress-bar-container"
        >
          <div class="progress-bar-indeterminate" />
        </div>
      </div>
    </div>

    <!-- Main agent interface -->
    <div
      class="agent-content"
      :class="{ blurred: !systemReady }"
    >
      <h1>Sulla</h1>
      <div class="avatar">
        {{ loading ? '🔄' : '🤖' }}
      </div>
      <input
        v-model="query"
        type="text"
        placeholder="Ask me anything..."
        :disabled="loading || !systemReady"
        @keyup.enter="send"
      >
      <div
        v-if="loading"
        class="status"
      >
        Thinking...
      </div>
      <div
        v-if="response"
        class="response"
      >
        {{ response }}
      </div>
      <div
        v-if="error"
        class="error"
      >
        {{ error }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';

import { ipcRenderer } from '@pkg/utils/ipcRenderer';

const query = ref('');
const response = ref('');
const loading = ref(false);
const error = ref('');
const availableModel = ref('');

// System readiness state
const systemReady = ref(false);
const progressCurrent = ref(0);
const progressMax = ref(-1);
const progressDescription = ref('');
const startupPhase = ref('initializing');

const progressPercent = computed(() => {
  if (progressMax.value <= 0) {
    return 0;
  }

  return Math.round((progressCurrent.value / progressMax.value) * 100);
});

const OLLAMA_BASE = 'http://127.0.0.1:30114';

// Startup phases with descriptions
const updateStartupStatus = (phase: string, detail: string) => {
  startupPhase.value = phase;
  progressDescription.value = detail;
};

// Check Ollama connectivity (not model, just the service)
const checkOllamaConnectivity = async (): Promise<boolean> => {
  try {
    const res = await fetch(`${ OLLAMA_BASE }/api/tags`, { signal: AbortSignal.timeout(2000) });

    return res.ok;
  } catch {
    return false;
  }
};

// Check if Ollama has a model ready
const checkOllamaModel = async (): Promise<boolean> => {
  try {
    const res = await fetch(`${ OLLAMA_BASE }/api/tags`);

    if (res.ok) {
      const data = await res.json();

      if (data.models && data.models.length > 0) {
        availableModel.value = data.models[0].name;

        return true;
      }
    }
  } catch {
    // Not ready yet
  }

  return false;
};

// Poll for system readiness with detailed status updates
let readinessInterval: ReturnType<typeof setInterval> | null = null;
let k8sReady = false;

const startReadinessCheck = () => {
  readinessInterval = setInterval(async () => {
    // Phase 1: Wait for K8s progress to complete
    if (!k8sReady && progressMax.value > 0 && progressCurrent.value >= progressMax.value) {
      k8sReady = true;
      updateStartupStatus('pods', 'Waiting for Sulla pods to start...');
    }

    // Phase 2: Check Ollama connectivity
    if (k8sReady || progressMax.value <= 0) {
      const ollamaUp = await checkOllamaConnectivity();

      if (!ollamaUp) {
        updateStartupStatus('pods', 'Starting Ollama service...');

        return;
      }

      // Phase 3: Check for model
      updateStartupStatus('model', 'Checking for AI model...');
      const hasModel = await checkOllamaModel();

      if (!hasModel) {
        updateStartupStatus('model', 'Downloading AI model (this may take a few minutes)...');

        return;
      }

      // All ready!
      updateStartupStatus('ready', 'System ready!');
      systemReady.value = true;
      if (readinessInterval) {
        clearInterval(readinessInterval);
        readinessInterval = null;
      }
    }
  }, 2000);
};

// Handle K8s progress updates
const handleProgress = (_event: unknown, progress: { current: number; max: number; description?: string }) => {
  progressCurrent.value = progress.current;
  progressMax.value = progress.max;

  // Only update description from K8s if we're still in K8s boot phase
  if (startupPhase.value === 'initializing' || startupPhase.value === 'k8s') {
    progressDescription.value = progress.description || 'Starting Kubernetes...';
    startupPhase.value = 'k8s';
  }
};

onMounted(async () => {
  // Listen for K8s progress events
  ipcRenderer.on('k8s-progress', handleProgress);

  // Get initial progress
  try {
    const progress = await ipcRenderer.invoke('k8s-progress');

    if (progress) {
      progressCurrent.value = progress.current;
      progressMax.value = progress.max;
      progressDescription.value = progress.description || 'Initializing...';

      // Check if K8s is already done
      if (progress.max > 0 && progress.current >= progress.max) {
        k8sReady = true;
      }
    }
  } catch {
    // Progress not available yet
  }

  // Check if already fully ready
  const hasModel = await checkOllamaModel();

  if (hasModel) {
    systemReady.value = true;
  } else {
    startReadinessCheck();
  }
});

onUnmounted(() => {
  ipcRenderer.removeListener('k8s-progress', handleProgress);
  if (readinessInterval) {
    clearInterval(readinessInterval);
  }
});

const send = async () => {
  if (!query.value.trim() || loading.value || !systemReady.value) {
    return;
  }

  loading.value = true;
  response.value = '';
  error.value = '';

  try {
    // Get available model if not already detected
    if (!availableModel.value) {
      const tagsRes = await fetch(`${ OLLAMA_BASE }/api/tags`);

      if (tagsRes.ok) {
        const tagsData = await tagsRes.json();

        if (tagsData.models && tagsData.models.length > 0) {
          availableModel.value = tagsData.models[0].name;
        } else {
          throw new Error('No models available. Ollama is still downloading the model.');
        }
      } else {
        throw new Error('Cannot connect to Ollama. Make sure Kubernetes is running.');
      }
    }

    const res = await fetch(`${ OLLAMA_BASE }/api/generate`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        model:  availableModel.value,
        prompt: query.value,
        stream: false,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));

      throw new Error(errData.error || `HTTP ${ res.status }: ${ res.statusText }`);
    }

    const data = await res.json();

    response.value = data.response || 'No response from model';
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);

    error.value = `Error: ${ message }`;
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.agent {
  position: relative;
  min-height: 100vh;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: #fff;
}

.agent-content {
  text-align: center;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  transition: filter 0.3s ease;
}

.agent-content.blurred {
  filter: blur(8px);
  pointer-events: none;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  background: rgba(26, 26, 46, 0.9);
}

.loading-content {
  text-align: center;
  max-width: 400px;
  padding: 2rem;
}

.loading-spinner {
  font-size: 4rem;
  animation: spin 2s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-content h2 {
  font-size: 1.5rem;
  font-weight: 300;
  margin-bottom: 1rem;
  letter-spacing: 0.1em;
}

.progress-text {
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 1.5rem;
  min-height: 1.5em;
}

.progress-bar-container {
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #4facfe 0%, #00f2fe 100%);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.progress-bar-indeterminate {
  height: 100%;
  width: 30%;
  background: linear-gradient(90deg, #4facfe 0%, #00f2fe 100%);
  border-radius: 3px;
  animation: indeterminate 1.5s ease-in-out infinite;
}

@keyframes indeterminate {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(400%); }
}

h1 {
  font-size: 2.5rem;
  margin-bottom: 1rem;
  font-weight: 300;
  letter-spacing: 0.2em;
}

.avatar {
  font-size: 8rem;
  margin: 2rem 0;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

input {
  width: 80%;
  max-width: 500px;
  padding: 1rem 1.5rem;
  margin: 1rem;
  border: none;
  border-radius: 2rem;
  font-size: 1rem;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  outline: none;
  transition: background 0.3s;
}

input::placeholder {
  color: rgba(255, 255, 255, 0.5);
}

input:focus {
  background: rgba(255, 255, 255, 0.2);
}

.response {
  margin-top: 2rem;
  padding: 1.5rem;
  max-width: 600px;
  min-height: 2rem;
  font-size: 1.1rem;
  color: rgba(255, 255, 255, 0.9);
  background: rgba(255, 255, 255, 0.05);
  border-radius: 1rem;
  line-height: 1.6;
  text-align: left;
  white-space: pre-wrap;
}

.status {
  margin-top: 1rem;
  color: rgba(255, 255, 255, 0.6);
  font-style: italic;
}

.error {
  margin-top: 2rem;
  padding: 1rem;
  max-width: 500px;
  color: #ff6b6b;
  background: rgba(255, 107, 107, 0.1);
  border-radius: 0.5rem;
  font-size: 0.9rem;
}

input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
