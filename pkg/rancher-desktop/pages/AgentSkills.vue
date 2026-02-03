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
                    Skills marketplace.
                  </p>
                  <p class="mt-3 text-2xl tracking-tight text-slate-400">
                    Browse and install skills for Sulla to use during tasks.
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
                      placeholder="Search skills"
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
                      :class="activeTag === null ? 'bg-linear-to-r from-sky-400/30 via-sky-400 to-sky-400/30 text-sky-300' : 'text-slate-500 bg-slate-800/60 ring-1 ring-white/5'"
                      @click="activeTag = null"
                    >
                      <span class="flex items-center rounded-full px-2.5" :class="activeTag === null ? 'bg-slate-800' : ''">All</span>
                    </button>
                    <button
                      v-for="tag in topTags"
                      :key="tag"
                      type="button"
                      class="flex h-6 rounded-full p-px text-xs font-medium"
                      :class="activeTag === tag ? 'bg-linear-to-r from-sky-400/30 via-sky-400 to-sky-400/30 text-sky-300' : 'text-slate-500 bg-slate-800/60 ring-1 ring-white/5'"
                      @click="activeTag = tag"
                    >
                      <span class="flex items-center rounded-full px-2.5" :class="activeTag === tag ? 'bg-slate-800' : ''">{{ tag }}</span>
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
                v-if="filteredSkills.length === 0"
                class="flex h-40 items-center justify-center text-sm text-[#0d0d0d]/60 dark:text-white/60"
              >
                No skills found.
              </div>

              <div
                v-else
                class="grid grid-cols-1 gap-4 sm:grid-cols-2"
              >
                <router-link
                  v-for="skill in filteredSkills"
                  :key="skill.id"
                  :to="`/Skills/${skill.id}`"
                  class="group relative overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/10 transition hover:shadow-md hover:ring-black/20 dark:bg-[#0A101F]/80 dark:ring-white/10 dark:hover:ring-white/20 dark:shadow-none dark:hover:shadow-none"
                >
                  <div class="absolute -top-px right-11 left-20 h-[2px] bg-linear-to-r from-sky-300/0 via-sky-300/70 to-sky-300/0"></div>
                  <div class="absolute right-20 -bottom-px left-11 h-[2px] bg-linear-to-r from-blue-400/0 via-blue-400 to-blue-400/0"></div>

                  <div class="pt-4 pl-4">
                    <svg aria-hidden="true" viewBox="0 0 42 10" fill="none" class="h-2.5 w-auto stroke-slate-500/30">
                      <circle cx="5" cy="5" r="4.5"></circle>
                      <circle cx="21" cy="5" r="4.5"></circle>
                      <circle cx="37" cy="5" r="4.5"></circle>
                    </svg>

                    <div class="mt-4 flex items-center gap-3 pr-4">
                      <div class="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-xs font-semibold text-slate-700 ring-1 ring-black/10 dark:bg-slate-800 dark:text-slate-200 dark:ring-white/10">
                        <img
                          v-if="skill.icon"
                          :src="skill.icon"
                          :alt="skill.name"
                          class="h-full w-full object-cover"
                        >
                        <span v-else>{{ skill.name.slice(0, 2).toUpperCase() }}</span>
                      </div>

                      <div class="min-w-0 flex-1">
                        <div class="font-display text-3xl tracking-tight text-slate-900 dark:text-white">{{ skill.name }}</div>
                        <div class="text-xs text-slate-600 dark:text-slate-400">By {{ skill.publisher }}</div>
                      </div>

                      <div class="shrink-0 text-xs font-semibold text-slate-600 dark:text-slate-300">{{ skill.rating.toFixed(1) }}</div>
                    </div>

                    <div class="mt-4 flex flex-wrap gap-2 text-xs">
                      <div
                        v-for="tag in skill.tags"
                        :key="tag"
                        class="flex h-6 rounded-full bg-linear-to-r from-sky-400/30 via-sky-400 to-sky-400/30 p-px font-medium text-sky-700 dark:text-sky-300"
                      >
                        <div class="flex items-center rounded-full px-2.5 bg-white/90 ring-1 ring-black/10 dark:bg-slate-800 dark:ring-white/10">{{ tag }}</div>
                      </div>
                    </div>

                    <div class="mt-6 flex items-start px-1 text-sm">
                      <div aria-hidden="true" class="border-r border-slate-200 pr-4 font-mono text-slate-400 select-none dark:border-slate-300/5 dark:text-slate-600">
                        <div v-for="n in (4 + getDescriptionLines(skill.shortDescription).length)" :key="n">{{ pad2(n) }}</div>
                      </div>

                      <pre class="skills-codeblock prism-code language-javascript block overflow-x-hidden overflow-y-auto pb-2"><code class="whitespace-pre-wrap break-words"><div class="token-line"><span class="token keyword module">Skill By</span><span class="token plain"> </span><span class="token keyword module">{{ skill.publisher }}</span><span class="token plain"> </span><span class="token punctuation">{</span></div><div class="token-line" v-for="(descLine, idx) in getDescriptionLines(skill.shortDescription)" :key="`desc-${idx}`"><template v-if="idx === 0"><span class="token plain">  </span><span class="token literal-property property">description</span><span class="token operator">:</span><span class="token plain"> </span><span class="token string">'{{ descLine }}'</span></template><template v-else><span class="token plain">  </span><span class="token string">'{{ descLine }}'</span></template></div><div class="token-line"><span class="token plain">  </span><span class="token literal-property property">updated</span><span class="token operator">:</span><span class="token plain"> </span><span class="token string">'{{ skill.lastUpdated }}'</span></div><div class="token-line"><span class="token punctuation">}</span></div></code></pre>
                    </div>
                  </div>
                </router-link>
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

import { computed, onMounted, ref } from 'vue';

import type { SkillCatalogEntry } from '@pkg/agent/services/SkillService';
import { getSkillService } from '@pkg/agent/services/SkillService';

const THEME_STORAGE_KEY = 'agentTheme';
const isDark = ref(false);

const search = ref('');
const activeTag = ref<string | null>(null);

const skills = ref<SkillCatalogEntry[]>([]);

const topTags = computed(() => {
  const counts = new Map<string, number>();
  for (const skill of skills.value) {
    for (const tag of skill.tags) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 6)
    .map(([tag]) => tag);
});

const filteredSkills = computed(() => {
  const q = search.value.trim().toLowerCase();
  const tag = activeTag.value;

  return skills.value
    .filter((s) => {
      if (tag && !s.tags.includes(tag)) {
        return false;
      }

      if (!q) {
        return true;
      }

      const hay = `${s.name} ${s.publisher} ${s.shortDescription} ${s.tags.join(' ')}`.toLowerCase();
      return hay.includes(q);
    })
    .sort((a, b) => b.activeInstalls - a.activeInstalls);
});

const formatInstalls = (n: number): string => {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }
  if (n >= 10_000) {
    return `${Math.round(n / 1_000)}K`;
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1)}K`;
  }
  return String(n);
};

const toggleTheme = () => {
  isDark.value = !isDark.value;
  localStorage.setItem(THEME_STORAGE_KEY, isDark.value ? 'dark' : 'light');
};

const getDescriptionLines = (desc: string): string[] => {
  const lines = String(desc ?? '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  return lines.length ? lines : [''];
};

const pad2 = (n: number): string => String(n).padStart(2, '0');

onMounted(() => {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    isDark.value = saved === 'dark';
  } catch {
    isDark.value = false;
  }

  const svc = getSkillService();
  svc.listCatalog().then((entries) => {
    skills.value = entries;
  }).catch((err) => {
    console.warn('[Skills] Failed to load catalog:', err);
    skills.value = [];
  });
});
</script>

<style scoped>
 .skills-codeblock {
   scrollbar-width: thin;
   scrollbar-color: rgba(100, 116, 139, 0.25) transparent;
 }

 .dark .skills-codeblock {
   scrollbar-color: rgba(148, 163, 184, 0.25) transparent;
 }

 .skills-codeblock::-webkit-scrollbar {
   height: 6px;
   width: 6px;
 }

 .skills-codeblock::-webkit-scrollbar-track {
   background: transparent;
 }

 .skills-codeblock::-webkit-scrollbar-thumb {
   background-color: rgba(100, 116, 139, 0.18);
   border-radius: 9999px;
 }

 .dark .skills-codeblock::-webkit-scrollbar-thumb {
   background-color: rgba(148, 163, 184, 0.18);
 }

 .skills-codeblock::-webkit-scrollbar-thumb:hover {
   background-color: rgba(100, 116, 139, 0.28);
 }

 .dark .skills-codeblock::-webkit-scrollbar-thumb:hover {
   background-color: rgba(148, 163, 184, 0.28);
 }
 </style>
