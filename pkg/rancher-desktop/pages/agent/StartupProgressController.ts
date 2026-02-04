import { computed, ref } from 'vue';
import type { ComputedRef, Ref } from 'vue';

import { ipcRenderer } from '@pkg/utils/ipcRenderer';
import type { IpcRendererEvent } from 'electron';

export class StartupProgressController {
  static createState() {
    const progressCurrent = ref(0);
    const progressMax = ref(100); // Start at 100 so overlay shows immediately

    return {
      systemReady:         ref(false),
      progressCurrent,
      progressMax,
      progressDescription: ref('Starting Sulla...'),
      startupPhase:        ref('initializing'),
      showOverlay:         ref(false), // Controls overlay visibility

      modelDownloading:    ref(false),
      modelName:           ref(''),
      modelDownloadStatus: ref(''),

      modelMode:           ref<'local' | 'remote'>('local'),
    };
  }

  public progressPercent = computed(() => {
    if (this.state.progressMax.value <= 0) return 0;
    return Math.round((this.state.progressCurrent.value / this.state.progressMax.value) * 100);
  });

  private readonly OLLAMA_BASE = 'http://127.0.0.1:30114';
  private readinessInterval: ReturnType<typeof setInterval> | null = null;
  private k8sReady = false;

  constructor(private readonly state: ReturnType<typeof StartupProgressController.createState>) {}

  start(): void {
    // Initialize overlay state immediately so popup shows right away
    this.state.progressMax.value = 100;
    this.state.progressCurrent.value = 0;
    this.state.progressDescription.value = 'Initializing...';
    this.state.systemReady.value = false;
    
    // Listen for main process restart to show overlay
    ipcRenderer.on('sulla-main-started' as any, this.handleMainStarted);
    
    ipcRenderer.on('k8s-progress', this.handleProgress);

    // Use type assertion until you extend IpcRendererEvents
    ipcRenderer.on('ollama-model-status' as any, (event: IpcRendererEvent, payload: unknown) => {
      // Safely narrow the payload
      if (payload && typeof payload === 'object' && 'status' in payload) {
        const typedPayload = payload as { status: string; model?: string };
        this.state.modelDownloading.value =
          typedPayload.status.includes('Downloading') ||
          typedPayload.status.includes('pulling') ||
          typedPayload.status.includes('Extracting');

        this.state.modelName.value = typedPayload.model || this.state.modelName.value;
        this.state.modelDownloadStatus.value = typedPayload.status;

        // Show overlay if model is downloading
        if (this.state.modelDownloading.value && this.state.progressMax.value <= 0) {
          this.state.progressMax.value = 100;
          this.state.progressCurrent.value = 0;
          this.state.progressDescription.value = 'Downloading model...';
        }

        // Show overlay on any model status event
        this.state.showOverlay.value = true;

        if (typedPayload.status === 'success' || typedPayload.status.includes('complete')) {
          this.state.modelDownloading.value = false;
          this.state.modelDownloadStatus.value = 'Model ready';
        }
      }
    });

    this.startReadinessCheck();
  }

  dispose(): void {
    ipcRenderer.removeListener('sulla-main-started' as any, this.handleMainStarted);
    ipcRenderer.removeListener('k8s-progress', this.handleProgress);

    // Use the inline anonymous function pattern to match expected signature
    ipcRenderer.removeListener('ollama-model-status' as any, (event: IpcRendererEvent, payload: unknown) => {
      if (payload && typeof payload === 'object' && 'status' in payload) {
        const typed = payload as { status: string; model?: string };
        this.state.modelDownloading.value =
          typed.status.includes('Downloading') ||
          typed.status.includes('pulling') ||
          typed.status.includes('Extracting');

        this.state.modelName.value = typed.model || this.state.modelName.value;
        this.state.modelDownloadStatus.value = typed.status;

        if (typed.status === 'success' || typed.status.includes('complete')) {
          this.state.modelDownloading.value = false;
          this.state.modelDownloadStatus.value = 'Model ready';
        }
      }
    });

    if (this.readinessInterval) {
      clearInterval(this.readinessInterval);
      this.readinessInterval = null;
    }
  }

  private readonly handleModelStatus = (
    event: IpcRendererEvent,
    payload: { status: string; model?: string }
  ) => {
    this.state.modelDownloading.value =
      payload.status.includes('Downloading') ||
      payload.status.includes('pulling') ||
      payload.status.includes('Extracting');

    this.state.modelName.value = payload.model || this.state.modelName.value;
    this.state.modelDownloadStatus.value = payload.status;

    if (payload.status === 'success' || payload.status.includes('complete')) {
      this.state.modelDownloading.value = false;
      this.state.modelDownloadStatus.value = 'Model ready';
      this.state.showOverlay.value = false;
    }
  };

  private readonly handleProgress = (_: unknown, progress: { current: number; max: number; description?: string }) => {
    // Show overlay on any progress event
    this.state.showOverlay.value = true;
    
    // If we got a real progress update, use those values instead of restart placeholder
    if (progress.max !== 100 || progress.current !== 0) {
      this.state.progressCurrent.value = progress.current;
      this.state.progressMax.value = progress.max;
    }
    this.state.progressDescription.value = progress.description || this.state.progressDescription.value;

    if (progress.description?.includes('Ollama') || progress.description?.includes('model')) {
      this.state.startupPhase.value = 'model';
    } else if (
      progress.description?.includes('Kubernetes') ||
      progress.description?.includes('deployment') ||
      progress.description?.includes('pod')
    ) {
      this.state.startupPhase.value = 'pods';
    } else {
      this.state.startupPhase.value = 'k8s';
    }

    if (progress.max > 0 && progress.current >= progress.max) {
      this.k8sReady = true;
    }
  };

  private readonly handleMainStarted = () => {
    console.log('[StartupProgressController] Main process restarted - showing overlay');
    this.state.showOverlay.value = true;

    // Set progressMax to trigger overlay display
    this.state.progressMax.value = 100;
    this.state.progressCurrent.value = 0;
    this.state.progressDescription.value = 'System restarting...';
    this.state.startupPhase.value = 'initializing';
    this.state.systemReady.value = false;
    this.k8sReady = false;
  };

  private startReadinessCheck(): void {
    this.readinessInterval = setInterval(async () => {
      if (!this.k8sReady) return;

      const ollamaUp = await this.checkOllamaConnectivity();
      if (!ollamaUp) {
        this.state.startupPhase.value = 'pods';
        this.state.progressDescription.value = 'Waiting for Ollama pod...';
        return;
      }

      if (this.state.modelDownloading.value) {
        return; // model status already updating via event
      }

      this.state.startupPhase.value = 'ready';
      this.state.progressDescription.value = 'System ready!';
      this.state.systemReady.value = true;
      this.state.showOverlay.value = false; // Hide overlay when ready

      clearInterval(this.readinessInterval!);
      this.readinessInterval = null;
    }, 3000);
  }

  private async checkOllamaConnectivity(): Promise<boolean> {
    try {
      const res = await fetch(`${this.OLLAMA_BASE}/api/tags`, { signal: AbortSignal.timeout(1500) });
      return res.ok;
    } catch {
      return false;
    }
  }
}