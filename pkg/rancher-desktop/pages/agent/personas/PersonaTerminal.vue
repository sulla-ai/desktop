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
        <div class="w-10 h-10 bg-slate-800/70 ring-1 ring-white/10 flex items-center justify-center">
          <svg viewBox="0 0 40 40" class="w-8 h-8">
            <rect x="8" y="8" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" class="persona-icon" />
            <rect x="12" y="16" width="6" height="2" fill="currentColor" class="persona-icon" />
            <rect x="22" y="16" width="6" height="2" fill="currentColor" class="persona-icon" />
            <rect x="14" y="26" width="12" height="1" fill="currentColor" class="persona-icon" />
            <rect x="16" y="28" width="8" height="1" fill="currentColor" class="persona-icon animate-pulse" />
          </svg>
        </div>
        <div class="flex-1">
          <div class="persona-label">AGENT_ID</div>
          <div class="text-sm persona-mono persona-title">{{ agentName }}</div>
          <div class="mt-0.5 text-[10px] text-slate-500 persona-mono">{{ agentId }}</div>
        </div>
        <div class="flex items-center gap-2">
          <span class="persona-status-text">{{ statusLabel }}</span>
          <div class="w-2 h-3 animate-pulse" style="background-color: var(--persona-primary); box-shadow: 0 0 8px var(--persona-primary);"></div>
        </div>
      </div>
      <div class="px-4 pb-4 font-mono text-xs">
        <div style="color: color-mix(in oklab, var(--persona-primary) 70%, transparent);">> tokens: {{ totalTokens.toLocaleString() }}</div>
        <div class="text-slate-500">> cost: ${{ ((inputCost + outputCost) * 1000).toFixed(3) }}k</div>
        <div class="text-slate-600 mt-1">> temp: {{ temperature.toFixed(1) }}</div>
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
  totalTokens: number;
  temperature: number;
  inputCost: number;
  outputCost: number;
}>();

const statusLabel = computed(() => {
  switch (props.status) {
    case 'online':
      return 'ONLINE';
    case 'idle':
      return 'IDLE';
    case 'busy':
      return 'BUSY';
    case 'offline':
      return 'OFFLINE';
  }
});

const agentName = computed(() => props.agentName || props.agentId);
const agentId = computed(() => props.agentId);
const totalTokens = computed(() => props.totalTokens ?? 0);
const temperature = computed(() => props.temperature ?? 0);
const inputCost = computed(() => props.inputCost ?? 0);
const outputCost = computed(() => props.outputCost ?? 0);
</script>
