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
        <div class="w-11 h-11 bg-slate-800/70 ring-1 ring-white/10 flex items-center justify-center relative">
          <div class="absolute w-6 h-6 rounded-full blur-sm animate-pulse" style="background-color: color-mix(in oklab, var(--persona-primary) 40%, transparent);"></div>
          <div class="absolute w-4 h-4 rounded-full" style="background-color: color-mix(in oklab, var(--persona-primary) 60%, transparent);"></div>
          <div class="absolute w-2 h-2 bg-white rounded-full animate-ping"></div>
          <svg viewBox="0 0 44 44" class="absolute w-full h-full">
            <path d="M10 22 Q22 10 34 22" fill="none" stroke="currentColor" stroke-width="1" opacity="0.5" class="persona-icon">
              <animate attributeName="d" values="M10 22 Q22 10 34 22;M10 22 Q22 34 34 22;M10 22 Q22 10 34 22" dur="3s" repeatCount="indefinite" />
            </path>
            <path d="M10 28 Q22 16 34 28" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3" class="persona-icon">
              <animate attributeName="d" values="M10 28 Q22 16 34 28;M10 28 Q22 40 34 28;M10 28 Q22 16 34 28" dur="4s" repeatCount="indefinite" />
            </path>
          </svg>
        </div>
        <div class="flex-1">
          <div class="persona-label">{{ agentId }}</div>
          <div class="text-sm font-medium persona-title">{{ agentName }}</div>
        </div>
        <div class="flex items-center gap-2">
          <svg viewBox="0 0 40 20" class="w-10 h-5">
            <polyline
              points="0 10 8 10 12 4 16 16 20 10 28 10 32 6 36 14 40 10"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              class="persona-icon"
            >
              <animate attributeName="stroke-opacity" values="1;0.4;1" dur="1.2s" repeatCount="indefinite" />
            </polyline>
          </svg>
        </div>
      </div>
      <div class="px-4 pb-4 space-y-2">
        <div class="flex items-center gap-2">
          <div class="w-1.5 h-1.5 rounded-full animate-ping" style="background-color: var(--persona-primary);"></div>
          <span class="text-xs" style="color: color-mix(in oklab, var(--persona-primary) 80%, transparent);">dendrite_firing</span>
        </div>
        <div class="flex items-center gap-2">
          <div class="w-1.5 h-1.5 rounded-full" style="background-color: color-mix(in oklab, var(--persona-primary) 50%, transparent);"></div>
          <span class="text-xs text-slate-400">temp: {{ temperature.toFixed(1) }}</span>
        </div>
        <div class="flex items-center gap-2">
          <div class="w-1.5 h-1.5 rounded-full" style="background-color: color-mix(in oklab, var(--persona-primary) 35%, transparent);"></div>
          <span class="text-xs text-slate-400">tokens/s: {{ Math.round(tokensPerSecond) }}</span>
        </div>
        <div
          class="h-px"
          style="background-image: linear-gradient(to right, color-mix(in oklab, var(--persona-primary) 50%, transparent), color-mix(in oklab, var(--persona-primary) 20%, transparent), transparent);"
        ></div>
        <div class="text-[10px] text-slate-500 font-mono">status: {{ statusLabel }}</div>
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
  temperature: number;
}>();

const agentId = computed(() => props.agentId);
const agentName = computed(() => props.agentName || props.agentId);
const tokensPerSecond = computed(() => props.tokensPerSecond ?? 0);
const temperature = computed(() => props.temperature ?? 0);

const statusLabel = computed(() => {
  switch (props.status) {
    case 'online':
      return 'active';
    case 'busy':
      return 'working';
    case 'idle':
      return 'idle';
    case 'offline':
      return 'offline';
  }
});
</script>
