<template>
  <div class="h-screen bg-white text-sm text-[#0d0d0d] dark:bg-neutral-950 dark:text-neutral-50 font-sans" :class="{ dark: isDark }">
    <div class="flex h-screen min-h-0 flex-col">
      <div class="sticky top-0 z-40 border-b border-black/10 bg-white/70 backdrop-blur dark:border-white/10 dark:bg-neutral-950/70">
        <div class="flex items-center justify-between px-4 py-3">
          <div class="text-sm font-semibold tracking-tight text-[#0d0d0d]/80 dark:text-white/80">
            Sulla
          </div>

          <nav class="absolute left-1/2 -translate-x-1/2 flex items-center gap-x-6">
            <router-link
              to="/Chat"
              class="text-sm font-semibold"
              :class="route.path === '/Chat' ? 'text-[#0d0d0d] dark:text-white' : 'text-[#0d0d0d]/60 hover:text-[#0d0d0d] dark:text-white/60 dark:hover:text-white'"
            >
              Chat
            </router-link>
            <router-link
              to="/Calendar"
              class="text-sm font-semibold"
              :class="route.path === '/Calendar' ? 'text-[#0d0d0d] dark:text-white' : 'text-[#0d0d0d]/60 hover:text-[#0d0d0d] dark:text-white/60 dark:hover:text-white'"
            >
              Calendar
            </router-link>
            <router-link
              to="/Skills"
              class="text-sm font-semibold"
              :class="route.path === '/Skills' ? 'text-[#0d0d0d] dark:text-white' : 'text-[#0d0d0d]/60 hover:text-[#0d0d0d] dark:text-white/60 dark:hover:text-white'"
            >
              Skills
            </router-link>
          </nav>

          <div class="flex items-center gap-2">
            <a
              class="flex h-10 w-10 items-center justify-center border border-black/10 bg-white/70 text-[#0d0d0d] shadow-sm backdrop-blur hover:bg-white/90 dark:border-white/10 dark:bg-neutral-950/70 dark:text-white dark:hover:bg-neutral-950/90"
              href="https://github.com/sulla-ai/desktop"
              target="_blank"
              rel="noreferrer"
              aria-label="Open GitHub repository"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor">
                <path d="M12 .5C5.73.5.75 5.66.75 12.02c0 5.12 3.29 9.46 7.86 10.99.58.11.79-.26.79-.57 0-.28-.01-1.02-.02-2-3.2.7-3.87-1.57-3.87-1.57-.53-1.36-1.29-1.72-1.29-1.72-1.05-.73.08-.72.08-.72 1.16.08 1.77 1.22 1.77 1.22 1.03 1.8 2.69 1.28 3.35.98.1-.77.4-1.28.72-1.57-2.55-.3-5.23-1.31-5.23-5.83 0-1.29.45-2.35 1.19-3.18-.12-.3-.52-1.52.11-3.17 0 0 .97-.32 3.18 1.21.92-.26 1.9-.39 2.88-.39.98 0 1.96.13 2.88.39 2.2-1.53 3.17-1.21 3.17-1.21.63 1.65.23 2.87.12 3.17.74.83 1.19 1.89 1.19 3.18 0 4.53-2.69 5.53-5.25 5.82.41.36.78 1.08.78 2.19 0 1.58-.02 2.86-.02 3.25 0 .31.21.68.8.56 4.56-1.53 7.84-5.87 7.84-10.98C23.25 5.66 18.27.5 12 .5z" />
              </svg>
            </a>

            <button
              type="button"
              class="flex h-10 w-10 items-center justify-center border border-black/10 bg-white/70 text-[#0d0d0d] shadow-sm backdrop-blur hover:bg-white/90 dark:border-white/10 dark:bg-neutral-950/70 dark:text-white dark:hover:bg-neutral-950/90"
              :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
              @click="toggleTheme"
            >
              <svg v-if="isDark" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2" />
                <path d="M12 20v2" />
                <path d="m4.93 4.93 1.41 1.41" />
                <path d="m17.66 17.66 1.41 1.41" />
                <path d="M2 12h2" />
                <path d="M20 12h2" />
                <path d="m6.34 17.66-1.41 1.41" />
                <path d="m19.07 4.93-1.41 1.41" />
              </svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79Z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div class="flex-1">
        <div class="mx-auto h-full max-w-6xl px-4 py-6">
          <div class="flex flex-col gap-4">
            <div class="flex items-start justify-between gap-4">
              <div>
                <div class="text-2xl font-semibold tracking-tight">Skills</div>
                <div class="mt-1 text-sm text-[#0d0d0d]/60 dark:text-white/60">
                  Browse and install skills for Sulla to use during tasks.
                </div>
              </div>
            </div>

            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div class="relative w-full sm:max-w-lg">
                <input
                  v-model="search"
                  type="text"
                  class="h-11 w-full border border-black/10 bg-white/70 px-4 pr-10 text-sm shadow-sm backdrop-blur placeholder:text-[#0d0d0d]/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 dark:border-white/10 dark:bg-neutral-950/70 dark:placeholder:text-white/40"
                  placeholder="Search skills"
                >
                <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-[#0d0d0d]/40 dark:text-white/40">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                </div>
              </div>

              <div class="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  class="h-9 border px-3 text-sm font-semibold shadow-sm"
                  :class="activeTag === null ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-black/10 bg-white/70 text-[#0d0d0d] hover:bg-white/90 dark:border-white/10 dark:bg-neutral-950/70 dark:text-white dark:hover:bg-neutral-950/90'"
                  @click="activeTag = null"
                >
                  All
                </button>
                <button
                  v-for="tag in topTags"
                  :key="tag"
                  type="button"
                  class="h-9 border px-3 text-sm font-semibold shadow-sm"
                  :class="activeTag === tag ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-black/10 bg-white/70 text-[#0d0d0d] hover:bg-white/90 dark:border-white/10 dark:bg-neutral-950/70 dark:text-white dark:hover:bg-neutral-950/90'"
                  @click="activeTag = tag"
                >
                  {{ tag }}
                </button>
              </div>
            </div>

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
                  class="block cursor-pointer border border-black/10 bg-white/70 p-4 shadow-sm backdrop-blur hover:border-black/50 hover:bg-white/90 dark:border-white/10 dark:bg-neutral-950/70 dark:hover:border-white/50 dark:hover:bg-neutral-950/90"
                >
                  <div class="min-w-0">
                    <div class="flex items-start justify-between gap-3">
                      <div class="min-w-0">
                        <div class="flex items-center gap-2">
                          <div class="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden text-sm font-semibold text-[#0d0d0d]/70 dark:text-white/70">
                            <img
                              v-if="skill.icon"
                              :src="skill.icon"
                              :alt="skill.name"
                              class="h-full w-full object-cover"
                            >
                            <span v-else>{{ skill.name.slice(0, 2).toUpperCase() }}</span>
                          </div>
                          <div class="truncate text-[18px] font-medium">{{ skill.name }}</div>
                        </div>

                        <div class="mt-0.5 text-sm text-[#0d0d0d]/60 dark:text-white/60">
                          By {{ skill.publisher }}
                        </div>
                      </div>
                    </div>

                    <div class="mt-3 line-clamp-3 text-sm text-[#0d0d0d]/80 dark:text-white/80">
                      {{ skill.shortDescription }}
                    </div>

                    <div class="mt-3 flex flex-wrap gap-2">
                      <span
                        v-for="tag in skill.tags"
                        :key="tag"
                        class="border border-black/10 bg-white/70 px-2.5 py-1 text-sm font-semibold text-[#0d0d0d]/70 dark:border-white/10 dark:bg-neutral-950/70 dark:text-white/70"
                      >
                        {{ tag }}
                      </span>
                    </div>

                    <div class="mt-4 grid grid-cols-3 gap-2 text-sm text-[#0d0d0d]/60 dark:text-white/60">
                      <div>
                        <div class="font-semibold text-[#0d0d0d]/80 dark:text-white/80">{{ skill.rating.toFixed(1) }}</div>
                        <div>Rating</div>
                      </div>
                      <div>
                        <div class="font-semibold text-[#0d0d0d]/80 dark:text-white/80">{{ formatInstalls(skill.activeInstalls) }}</div>
                        <div>Active</div>
                      </div>
                      <div>
                        <div class="font-semibold text-[#0d0d0d]/80 dark:text-white/80">{{ skill.version }}</div>
                        <div>Version</div>
                      </div>
                    </div>

                    <div class="mt-3 text-sm text-[#0d0d0d]/60 dark:text-white/60">
                      Updated {{ skill.lastUpdated }}
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
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

import type { Skill } from './agent/skillsData';
import { skillsData } from './agent/skillsData';

const route = useRoute();

const THEME_STORAGE_KEY = 'agentTheme';
const isDark = ref(false);

const search = ref('');
const activeTag = ref<string | null>(null);

const skills = ref<Skill[]>(skillsData);

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

onMounted(() => {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    isDark.value = saved === 'dark';
  } catch {
    isDark.value = false;
  }
});
</script>
