<template>
  <div class="w-full p-3 persona-wrap">
    <div class="persona-glow-blur"></div>
    <div class="persona-glow"></div>
    <div class="persona-card persona-shine">
      <div class="persona-accent-top"></div>
      <div class="persona-accent-bottom"></div>
      <div class="pt-3 pl-3 flex items-center gap-1.5">
        <div class="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
        <div class="w-2.5 h-2.5 rounded-full bg-amber-500/80"></div>
        <div class="w-2.5 h-2.5 rounded-full bg-green-500/80"></div>
      </div>
      <div class="flex items-center gap-3 p-4 pt-2">
        <div class="w-12 h-12 bg-slate-800/70 ring-1 ring-white/10 flex items-center justify-center relative overflow-hidden">
          <svg viewBox="0 0 48 48" class="w-10 h-10 animate-spin" style="animation-duration: 8s;">
            <circle cx="24" cy="24" r="6" fill="currentColor" class="persona-icon" />
            <path d="M24 8 L26 14 L24 12 L22 14 Z" fill="currentColor" class="persona-icon" />
            <path d="M24 40 L26 34 L24 36 L22 34 Z" fill="currentColor" class="persona-icon" />
            <path d="M8 24 L14 26 L12 24 L14 22 Z" fill="currentColor" class="persona-icon" />
            <path d="M40 24 L34 26 L36 24 L34 22 Z" fill="currentColor" class="persona-icon" />
          </svg>
          <div class="absolute w-3 h-3 persona-status-dot"></div>
        </div>
        <div class="flex-1">
          <div class="persona-label">WORKER BOT</div>
          <div class="text-sm font-bold persona-title">{{ agentName }}</div>
        </div>
        <div class="flex flex-col items-end gap-1">
          <div class="flex items-center gap-1">
            <div class="w-10 h-2 bg-slate-700/60 overflow-hidden ring-1 ring-white/5">
              <div class="h-full w-3/4 animate-pulse" style="background-image: linear-gradient(to right, var(--persona-primary), color-mix(in oklab, var(--persona-primary) 60%, transparent));"></div>
            </div>
          </div>
          <span class="text-[10px] font-bold persona-mono" style="color: color-mix(in oklab, var(--persona-primary) 85%, transparent);">{{ statusLabel }}</span>
        </div>
      </div>
      <div class="px-4 pb-4">
        <div class="grid grid-cols-2 gap-2">
          <div class="persona-panel p-2">
            <div class="text-[10px] text-slate-400 uppercase">Estimate</div>
            <div class="text-sm font-bold" style="color: var(--persona-strong);">${{ totalCost.toFixed(4) }}</div>
          </div>
          <div class="persona-panel p-2">
            <div class="text-[10px] text-slate-400 uppercase">Total</div>
            <div class="text-sm font-bold" style="color: var(--persona-strong);">{{ totalTokens }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  agentId: string;
  agentName: string;
  status: 'online' | 'idle' | 'busy' | 'offline';
  tokensPerSecond: number;
  totalTokens: number;
  temperature: number;
}>();

const agentName = computed(() => props.agentName || props.agentId);
const tokensPerSecond = computed(() => props.tokensPerSecond ?? 0);
const totalTokens = computed(() => props.totalTokens ?? 0);
const temperature = computed(() => props.temperature ?? 0);

// Calculate cost based on model (assuming Grok pricing)
const costPerMillionTokens = 5; // $5 per 1M tokens for Grok
const totalCost = computed(() => (props.totalTokens * costPerMillionTokens) / 1000000);

const statusLabel = computed(() => {
  switch (props.status) {
    case 'online':
      return 'ACTIVE';
    case 'busy':
      return 'WORKING';
    case 'idle':
      return 'IDLE';
    case 'offline':
      return 'OFFLINE';
  }
});
</script>
