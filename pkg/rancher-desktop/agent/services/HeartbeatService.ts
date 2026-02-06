// HeartbeatService - Triggers periodic sensory input for the agent to check in
// Uses setInterval for simple periodic scheduling based on config settings

import type { ThreadState } from '../types';
import { createHeartbeatGraph } from '../nodes/Graph';

export interface HeartbeatConfig {
  enabled: boolean;
  delayMinutes: number;
  prompt: string;
  model: string; // 'default' or specific model like 'local:tinyllama:latest' or 'remote:grok:grok-4-1-fast-reasoning'
}

let heartbeatServiceInstance: HeartbeatService | null = null;

export function getHeartbeatService(): HeartbeatService {
  if (!heartbeatServiceInstance) {
    heartbeatServiceInstance = new HeartbeatService();
  }
  return heartbeatServiceInstance;
}

export class HeartbeatService {
  private initialized = false;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isExecuting = false; // Track if heartbeat is actively executing
  private config: HeartbeatConfig = {
    enabled: true,
    delayMinutes: 30,
    prompt: '',
    model: 'default',
  };

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log('[HeartbeatService] Initializing...');
    this.initialized = true;

    // Start the heartbeat if enabled
    if (this.config.enabled) {
      this.startHeartbeat();
    }
  }

  updateConfig(config: Partial<HeartbeatConfig>): void {
    const wasEnabled = this.config.enabled;
    const oldDelay = this.config.delayMinutes;

    if (config.enabled !== undefined) {
      this.config.enabled = config.enabled;
    }
    if (config.delayMinutes !== undefined) {
      this.config.delayMinutes = config.delayMinutes;
    }
    if (config.prompt !== undefined) {
      this.config.prompt = config.prompt;
    }
    if (config.model !== undefined) {
      this.config.model = config.model;
    }

    console.log(`[HeartbeatService] Config updated: enabled=${this.config.enabled}, delay=${this.config.delayMinutes}min, model=${this.config.model}`);

    // Handle enable/disable or delay changes
    if (this.config.enabled !== wasEnabled || this.config.delayMinutes !== oldDelay) {
      this.stopHeartbeat();
      if (this.config.enabled) {
        this.startHeartbeat();
      }
    }
  }

  private startHeartbeat(): void {
    if (this.intervalId) {
      return; // Already running
    }

    const delayMs = this.config.delayMinutes * 60 * 1000;
    console.log(`[HeartbeatService] Starting heartbeat with ${this.config.delayMinutes} minute interval`);

    this.intervalId = setInterval(async () => {
      console.log(`[HeartbeatService] ⏰ HEARTBEAT TRIGGERED`);
      console.log(`[HeartbeatService]   Time: ${new Date().toISOString()}`);
      await this.triggerHeartbeat();
    }, delayMs);

    // Log next heartbeat time
    const nextHeartbeat = new Date(Date.now() + delayMs);
    console.log(`[HeartbeatService] Next heartbeat at: ${nextHeartbeat.toISOString()}`);
  }

  private stopHeartbeat(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[HeartbeatService] Heartbeat stopped');
    }
  }

  private async triggerHeartbeat(): Promise<void> {
    try {
      // Skip if heartbeat is already executing
      if (this.isExecuting) {
        console.log('[HeartbeatService] ⏭️ Skipping heartbeat - already executing');
        return;
      }

      // Mark as executing
      this.isExecuting = true;

      // Build the heartbeat prompt
      const prompt = this.buildHeartbeatPrompt();
      console.log(`[HeartbeatService] Built prompt \n${prompt})`);

      // Build a minimal ThreadState and execute nodes directly (skip Sensory/ContextDetector/ConversationThread)
      const now = Date.now();
      const threadId = `heartbeat_${ now }`;
      const state: ThreadState = {
        threadId,
        messages:        [{
          id:        `msg_${ now }_heartbeat`,
          role:      'user',
          content:   prompt,
          timestamp: now,
          metadata:  { source: 'heartbeat' },
        }],
        shortTermMemory: [],
        metadata:        {},
        createdAt:       now,
        updatedAt:       now,
      };

      if (this.config.model !== 'default') {
        state.metadata.heartbeatModel = this.config.model;
      }

      console.log(`[HeartbeatService] 🧠 Executing heartbeat graph (OverLord → HierarchicalGraph → OverLord) (threadId=${threadId})`);
      const graph = createHeartbeatGraph();
      await graph.execute(state);

      console.log(`[HeartbeatService] ✅ Heartbeat graph executed successfully`);
    } catch (err) {
      console.error(`[HeartbeatService] ❌ Failed to trigger heartbeat:`, err);
    } finally {
      // Always reset executing flag
      this.isExecuting = false;
    }
  }

  private buildHeartbeatPrompt(): string {
    const now = new Date();
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const formattedTime = now.toLocaleString('en-US', {
      timeZone: timezone,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    return `\nCurrent time: ${formattedTime}\nTimezone: ${timezone}\n\n${this.config.prompt}`;
  }

  getConfig(): HeartbeatConfig {
    return { ...this.config };
  }

  isRunning(): boolean {
    return this.intervalId !== null;
  }

  destroy(): void {
    this.stopHeartbeat();
    this.initialized = false;
  }
}
