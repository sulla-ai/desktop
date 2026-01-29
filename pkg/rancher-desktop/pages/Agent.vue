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
        
        <!-- Model download progress -->
        <div
          v-if="modelDownloading"
          class="model-download-info"
        >
          <p class="model-name">
            📦 Downloading: <strong>{{ modelName }}</strong>
          </p>
          <p class="model-status">
            {{ modelDownloadStatus }}
          </p>
          <div
            v-if="modelDownloadTotal > 0"
            class="progress-bar-container"
          >
            <div
              class="progress-bar-fill model-progress"
              :style="{ width: (modelDownloadProgress / modelDownloadTotal * 100) + '%' }"
            />
          </div>
          <p
            v-if="modelDownloadTotal > 0"
            class="model-progress-text"
          >
            {{ Math.round(modelDownloadProgress / 1024 / 1024) }} MB / {{ Math.round(modelDownloadTotal / 1024 / 1024) }} MB
            ({{ Math.round(modelDownloadProgress / modelDownloadTotal * 100) }}%)
          </p>
        </div>
        
        <!-- K8s progress bar -->
        <div
          v-else-if="progressMax > 0"
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
import {
  getSensory,
  getContextDetector,
  getThread,
  getResponseHandler,
} from '@pkg/agent';
import { updateAgentConfig } from '@pkg/agent/services/ConfigService';

const query = ref('');
const response = ref('');
const loading = ref(false);
const error = ref('');
const currentThreadId = ref<string | null>(null);

// Initialize agent components
const sensory = getSensory();
const contextDetector = getContextDetector();
const responseHandler = getResponseHandler();

// System readiness state
const systemReady = ref(false);
const progressCurrent = ref(0);
const progressMax = ref(-1);
const progressDescription = ref('');
const startupPhase = ref('initializing');

// Model download state
const modelDownloading = ref(false);
const modelName = ref('');
const modelDownloadProgress = ref(0);
const modelDownloadTotal = ref(0);
const modelDownloadStatus = ref('');

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

// Check if Ollama has the configured model ready
const checkOllamaModel = async (targetModel: string): Promise<boolean> => {
  try {
    const res = await fetch(`${ OLLAMA_BASE }/api/tags`);

    if (res.ok) {
      const data = await res.json();
      const modelNames = data.models?.map((m: { name: string }) => m.name) || [];

      // Check if the target model is available
      if (modelNames.includes(targetModel)) {
        return true;
      }

      // Also check without tag (e.g., 'mistral:7b' matches 'mistral:7b')
      const baseModel = targetModel.split(':')[0];
      if (modelNames.some((name: string) => name.startsWith(baseModel))) {
        return true;
      }
    }
  } catch {
    // Not ready yet
  }

  return false;
};

// Pull model with streaming progress
const pullModelWithProgress = async (targetModel: string): Promise<boolean> => {
  modelDownloading.value = true;
  modelName.value = targetModel;
  modelDownloadStatus.value = 'Starting download...';
  modelDownloadProgress.value = 0;
  modelDownloadTotal.value = 0;

  try {
    const res = await fetch(`${ OLLAMA_BASE }/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: targetModel, stream: true }),
    });

    if (!res.ok || !res.body) {
      modelDownloadStatus.value = 'Download failed';
      modelDownloading.value = false;
      return false;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const data = JSON.parse(line);
          
          if (data.status) {
            modelDownloadStatus.value = data.status;
          }
          
          if (data.total && data.completed !== undefined) {
            modelDownloadTotal.value = data.total;
            modelDownloadProgress.value = data.completed;
          }
          
          if (data.status === 'success') {
            modelDownloadStatus.value = 'Download complete!';
            modelDownloading.value = false;
            return true;
          }
        } catch {
          // Ignore parse errors
        }
      }
    }

    modelDownloading.value = false;
    return true;
  } catch (err) {
    console.error('[Agent] Model pull failed:', err);
    modelDownloadStatus.value = 'Download failed';
    modelDownloading.value = false;
    return false;
  }
};

// Poll for system readiness with detailed status updates
let readinessInterval: ReturnType<typeof setInterval> | null = null;
let k8sReady = false;

const startReadinessCheck = () => {
  readinessInterval = setInterval(async () => {
    // Phase 1: Wait for K8s progress to complete
    if (!k8sReady) {
      if (progressMax.value > 0 && progressCurrent.value >= progressMax.value) {
        k8sReady = true;
      } else {
        // Still waiting for K8s - don't override the K8s progress description
        return;
      }
    }

    // Phase 2: Check Ollama connectivity
    const ollamaUp = await checkOllamaConnectivity();

    if (!ollamaUp) {
      updateStartupStatus('pods', 'Waiting for Ollama pod to start...');

      return;
    }

    // Phase 3: Check for model and pull if needed
    const targetModel = modelName.value || 'tinyllama:latest';
    updateStartupStatus('model', `Checking for AI model (${targetModel})...`);
    const hasModel = await checkOllamaModel(targetModel);

    if (!hasModel) {
      if (!modelDownloading.value) {
        // Start the model download
        updateStartupStatus('model', `Downloading ${targetModel}...`);
        pullModelWithProgress(targetModel);
      }
      return;
    }

    // All ready!
    updateStartupStatus('ready', 'System ready!');
    systemReady.value = true;
    if (readinessInterval) {
      clearInterval(readinessInterval);
      readinessInterval = null;
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

  // Load settings and update agent config with selected model
  ipcRenderer.on('settings-read', (_event: unknown, settings: { experimental?: { sullaModel?: string } }) => {
    if (settings.experimental?.sullaModel) {
      modelName.value = settings.experimental.sullaModel;
      updateAgentConfig(settings.experimental.sullaModel);
      console.log(`[Agent] Model configured: ${settings.experimental.sullaModel}`);
    } else {
      modelName.value = 'tinyllama:latest';
    }
  });
  ipcRenderer.send('settings-read');

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

  // Always start readiness check - it will verify K8s is done AND Ollama is ready
  startReadinessCheck();
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
    // 1. Create sensory input
    const input = sensory.createTextInput(query.value);

    // 2. Detect context and get/create thread
    const threadContext = await contextDetector.detect(input);

    currentThreadId.value = threadContext.threadId;

    // 3. Get or create conversation thread (uses default graph with nodes)
    const thread = getThread(threadContext.threadId);

    // Always initialize (idempotent - handles persistence setup)
    await thread.initialize();

    // 4. Process through the graph: Memory → Planner → Executor → Critic
    const agentResponse = await thread.process(input);

    // 5. Handle response
    if (responseHandler.hasErrors(agentResponse)) {
      const err = responseHandler.getError(agentResponse);

      throw new Error(err || 'Unknown error');
    }

    response.value = responseHandler.formatText(agentResponse) || 'No response from model';
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

/* Model download progress styles */
.model-download-info {
  margin: 1rem 0;
  padding: 1rem;
  background: rgba(79, 172, 254, 0.1);
  border-radius: 0.5rem;
  border: 1px solid rgba(79, 172, 254, 0.3);
}

.model-name {
  font-size: 1rem;
  margin-bottom: 0.5rem;
  color: #4facfe;
}

.model-name strong {
  color: #00f2fe;
}

.model-status {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 0.75rem;
}

.model-download-info .progress-bar-container {
  margin-bottom: 0.5rem;
}

.model-progress {
  background: linear-gradient(90deg, #00f2fe 0%, #4facfe 100%);
}

.model-progress-text {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.6);
  margin: 0;
  font-family: monospace;
}
</style>
