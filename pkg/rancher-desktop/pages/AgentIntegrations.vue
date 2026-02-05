<template>
  <div class="min-h-screen bg-white text-sm text-[#0d0d0d] dark:bg-slate-900 dark:text-neutral-50 font-sans" :class="{ dark: isDark }">
    <div class="flex min-h-screen flex-col">
      <AgentHeader :is-dark="isDark" :toggle-theme="toggleTheme" />

      <div class="flex w-full flex-col">
        <div class="overflow-hidden bg-slate-900 dark:-mt-19 dark:-mb-32 dark:pt-19 dark:pb-32">
          <div class="py-16 sm:px-2 lg:relative lg:px-0 lg:py-20">
            <div class="mx-auto grid max-w-6xl grid-cols-1 items-center gap-x-8 gap-y-10 px-4 lg:grid-cols-2 lg:px-8 xl:gap-x-16">
              <div class="relative z-10 md:text-center lg:text-left">
                <div class="relative">
                  <p class="inline bg-linear-to-r from-indigo-200 via-sky-400 to-indigo-200 bg-clip-text font-display text-5xl tracking-tight text-transparent">
                    Native Integrations.
                  </p>
                  <p class="mt-3 text-2xl tracking-tight text-slate-400">
                    Connect your favorite tools and services with Sulla.
                  </p>
                </div>
              </div>

              <div class="relative">
                <div class="flex flex-col gap-4">
                  <div class="relative">
                    <svg aria-hidden="true" viewBox="0 0 20 20" class="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 fill-slate-400 dark:fill-slate-500">
                      <path d="M16.293 17.707a1 1 0 0 0 1.414-1.414l-1.414 1.414ZM9 14a5 5 0 0 1-5-5H2a7 7 0 0 0 7 7v-2ZM4 9a5 5 0 0 1 5-5V2a7 7 0 0 0-7 7h2Zm5-5a5 5 0 0 1 5 5h2a7 7 0 0 0-7-7v2Zm8.707 12.293-3.757-3.757-1.414 1.414 3.757 3.757 1.414-1.414ZM14 9a4.98 4.98 0 0 1-1.464 3.536l1.414 1.414A6.98 6.98 0 0 0 16 9h-2Zm-1.464 3.536A4.98 4.98 0 0 1 9 14v2a6.98 6.98 0 0 0 4.95-2.05l-1.414-1.414Z"></path>
                    </svg>

                    <input
                      v-model="search"
                      type="text"
                      placeholder="Search integrations"
                      class="h-11 w-full rounded-lg bg-white/95 pr-4 pl-12 text-sm text-slate-900 ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-300/50 dark:bg-slate-800/75 dark:text-slate-100 dark:ring-white/5 dark:ring-inset"
                    >
                    <kbd class="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 font-medium text-slate-400 md:block dark:text-slate-500">
                      <kbd class="font-sans">⌘</kbd><kbd class="font-sans">K</kbd>
                    </kbd>
                  </div>

                  <div class="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      class="flex h-6 rounded-full p-px text-xs font-medium"
                      :class="activeCategory === null ? 'bg-linear-to-r from-sky-400/30 via-sky-400 to-sky-400/30 text-sky-300' : 'text-slate-500 bg-slate-800/60 ring-1 ring-white/5'"
                      @click="activeCategory = null"
                    >
                      <span class="flex items-center rounded-full px-2.5" :class="activeCategory === null ? 'bg-slate-800' : ''">All</span>
                    </button>
                    <button
                      v-for="category in categories"
                      :key="category"
                      type="button"
                      class="flex h-6 rounded-full p-px text-xs font-medium"
                      :class="activeCategory === category ? 'bg-linear-to-r from-sky-400/30 via-sky-400 to-sky-400/30 text-sky-300' : 'text-slate-500 bg-slate-800/60 ring-1 ring-white/5'"
                      @click="activeCategory = category"
                    >
                      <span class="flex items-center rounded-full px-2.5" :class="activeCategory === category ? 'bg-slate-800' : ''">{{ category }}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="flex-1 overflow-auto">
          <div class="mx-auto max-w-6xl px-4 py-6">
            <div class="overflow-auto">
              <div
                v-if="filteredIntegrations.length === 0"
                class="flex h-40 items-center justify-center text-sm text-[#0d0d0d]/60 dark:text-white/60"
              >
                No integrations found.
              </div>

              <div
                v-else
                class="grid grid-cols-3 gap-6"
              >
                <div
                  v-for="integration in filteredIntegrations"
                  :key="integration.id"
                  class="group relative overflow-hidden rounded-xl bg-white shadow-sm border border-gray-200 transition-all duration-200 hover:shadow-lg hover:border-gray-300 dark:bg-slate-800 dark:border-gray-700 dark:hover:border-gray-600"
                >
                  <div class="p-6">
                    <div class="flex items-start justify-between mb-4">
                      <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-2xl dark:bg-slate-700">
                        {{ integration.icon }}
                      </div>
                      <div class="flex items-center gap-2">
                        <div
                          class="h-2 w-2 rounded-full"
                          :class="integration.connected ? 'bg-green-500' : 'bg-gray-300'"
                        ></div>
                        <span class="text-xs text-slate-500 dark:text-slate-400">
                          {{ integration.connected ? 'Connected' : 'Disconnected' }}
                        </span>
                      </div>
                    </div>

                    <h3 class="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                      {{ integration.name }}
                    </h3>
                    
                    <p class="text-sm text-slate-600 dark:text-slate-300 mb-4 line-clamp-2">
                      {{ integration.description }}
                    </p>

                    <div class="flex items-center justify-between">
                      <span class="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-800 dark:bg-slate-700 dark:text-slate-200">
                        {{ integration.category }}
                      </span>
                      
                      <router-link
                        :to="`/Integrations/${integration.id}`"
                        class="inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
                        :class="integration.connected 
                          ? 'bg-red-600 text-white hover:bg-red-700' 
                          : 'bg-blue-600 text-white hover:bg-blue-700'"
                      >
                        {{ integration.connected ? 'Manage' : 'Connect now' }}
                      </router-link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import AgentHeader from './agent/AgentHeader.vue';
import { integrations, type Integration } from '@pkg/agent/integrations/catalog';

import { computed, onMounted, ref } from 'vue';

const THEME_STORAGE_KEY = 'agentTheme';
const isDark = ref(false);

const search = ref('');
const activeCategory = ref<string | null>(null);

const integrationsList = ref(Object.values(integrations));

const categories = computed(() => {
  const counts = new Map<string, number>();
  for (const integration of integrationsList.value) {
    counts.set(integration.category, (counts.get(integration.category) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 6)
    .map(([category]) => category);
});

const filteredIntegrations = computed(() => {
  const q = search.value.trim().toLowerCase();
  const category = activeCategory.value;

  return integrationsList.value
    .filter((integration) => {
      if (category && integration.category !== category) {
        return false;
      }

      if (!q) {
        return true;
      }

      const hay = `${integration.name} ${integration.description} ${integration.category}`.toLowerCase();
      return hay.includes(q);
    })
    .sort((a, b) => a.name.localeCompare(b.name));
});

const toggleTheme = () => {
  isDark.value = !isDark.value;
  localStorage.setItem(THEME_STORAGE_KEY, isDark.value ? 'dark' : 'light');
};

const connectIntegration = (id: string) => {
  const integration = integrations[id];
  if (integration) {
    integration.connected = true;
    const index = integrationsList.value.findIndex(i => i.id === id);
    if (index !== -1) {
      integrationsList.value[index] = { ...integration };
    }
  }
};

const disconnectIntegration = (id: string) => {
  const integration = integrations[id];
  if (integration) {
    integration.connected = false;
    const index = integrationsList.value.findIndex(i => i.id === id);
    if (index !== -1) {
      integrationsList.value[index] = { ...integration };
    }
  }
};

onMounted(() => {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    isDark.value = saved === 'dark';
  } catch {
    isDark.value = false;
  }
});
</script>

<style scoped>
/* Integration cards styles */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-clamp: 2;
}
</style>
