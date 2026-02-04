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
        <div class="w-11 h-11 relative flex items-center justify-center">
          <div class="absolute inset-0 rounded-full blur-md animate-pulse" style="background-color: color-mix(in oklab, var(--persona-primary) 30%, transparent);"></div>
          <div
            class="absolute inset-1 rounded-full opacity-80"
            style="background-image: linear-gradient(to top right, var(--persona-from), var(--persona-to));"
          ></div>
          <div class="relative w-5 h-5 bg-white rounded-full" style="box-shadow: 0 0 10px var(--persona-primary);"></div>
        </div>
        <div class="flex-1">
          <div class="persona-label">Core_ID</div>
          <div class="text-sm font-semibold persona-title">{{ agentName }}</div>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-[10px] text-slate-400 font-mono">{{ statusLabel }}</span>
          <div class="w-2 h-2 rounded-full animate-pulse persona-status-dot"></div>
        </div>
      </div>
      <div class="px-4 pb-4 space-y-2">
        <div class="flex flex-wrap gap-1.5">
          <div
            class="flex h-5 rounded-full p-px"
            style="background-image: linear-gradient(to right, color-mix(in oklab, var(--persona-primary) 20%, transparent), color-mix(in oklab, var(--persona-primary) 40%, transparent), color-mix(in oklab, var(--persona-primary) 20%, transparent));"
          >
            <div class="flex items-center rounded-full px-2 text-[10px] font-medium bg-slate-800/80" style="color: color-mix(in oklab, var(--persona-primary) 90%, transparent);">inference.js</div>
          </div>
          <div class="flex h-5 rounded-full bg-slate-700/30">
            <div class="flex items-center rounded-full px-2 text-[10px] text-slate-400">model.gguf</div>
          </div>
        </div>
        <div class="flex items-center gap-3 text-[10px] font-mono pt-1">
          <div class="flex items-center gap-1 text-slate-400">
            <span style="color: color-mix(in oklab, var(--persona-primary) 60%, transparent);">tokens/s:</span>
            <span style="color: var(--persona-strong);">{{ Math.round(tokensPerSecond) }}</span>
          </div>
          <div class="flex items-center gap-1 text-slate-400">
            <span style="color: color-mix(in oklab, var(--persona-to) 60%, transparent);">temp:</span>
            <span style="color: var(--persona-strong);">{{ temperature.toFixed(1) }}</span>
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
  temperature: number;
}>();

const agentName = computed(() => props.agentName || props.agentId);
const tokensPerSecond = computed(() => props.tokensPerSecond ?? 0);
const temperature = computed(() => props.temperature ?? 0);

const statusLabel = computed(() => {
  switch (props.status) {
    case 'online':
      return 'LIVE';
    case 'busy':
      return 'RUNNING';
    case 'idle':
      return 'IDLE';
    case 'offline':
      return 'OFFLINE';
  }
});
</script>
