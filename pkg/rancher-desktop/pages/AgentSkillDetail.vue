<template>
  <div class="min-h-screen overflow-hidden bg-white text-base text-[#0d0d0d] dark:bg-slate-900 dark:text-neutral-50 font-sans" :class="{ dark: isDark }">
    <div class="flex min-h-screen flex-col">
      <div class="sticky top-0 z-40 border-b border-black/10 bg-white/70 backdrop-blur dark:border-white/10 dark:bg-neutral-950/70">
        <div class="flex items-center justify-between px-4 py-3">
          <div class="text-base font-semibold tracking-tight text-[#0d0d0d]/80 dark:text-white/80">
            Sulla
          </div>

          <nav class="absolute left-1/2 -translate-x-1/2 flex items-center gap-x-6">
            <router-link
              to="/Chat"
              class="cursor-pointer text-base font-semibold"
              :class="route.path === '/Chat' ? 'text-[#0d0d0d] dark:text-white' : 'text-[#0d0d0d]/60 hover:text-[#0d0d0d] dark:text-white/60 dark:hover:text-white'"
            >
              Chat
            </router-link>
            <router-link
              to="/Calendar"
              class="cursor-pointer text-base font-semibold"
              :class="route.path === '/Calendar' ? 'text-[#0d0d0d] dark:text-white' : 'text-[#0d0d0d]/60 hover:text-[#0d0d0d] dark:text-white/60 dark:hover:text-white'"
            >
              Calendar
            </router-link>
            <router-link
              to="/Skills"
              class="cursor-pointer text-base font-semibold"
              :class="route.path.startsWith('/Skills') ? 'text-[#0d0d0d] dark:text-white' : 'text-[#0d0d0d]/60 hover:text-[#0d0d0d] dark:text-white/60 dark:hover:text-white'"
            >
              Skills
            </router-link>
          </nav>

          <div class="flex items-center gap-2">
            <a
              class="flex h-10 w-10 cursor-pointer items-center justify-center border border-black/10 bg-white/70 text-[#0d0d0d] shadow-sm backdrop-blur hover:bg-white/90 dark:border-white/10 dark:bg-neutral-950/70 dark:text-white dark:hover:bg-neutral-950/90"
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
              class="flex h-10 w-10 cursor-pointer items-center justify-center border border-black/10 bg-white/70 text-[#0d0d0d] shadow-sm backdrop-blur hover:bg-white/90 dark:border-white/10 dark:bg-neutral-950/70 dark:text-white dark:hover:bg-neutral-950/90"
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

      <div class="flex-1 overflow-auto"><img alt="" width="530" height="530" decoding="async" data-nimg="1" class="absolute -top-64 -right-64"
                    style="color:transparent" src="./agent/splash.png">
                  
        <div class="mx-auto max-w-6xl px-4 py-6">
          <div v-if="!skill" class="border border-black/10 bg-white/70 p-6 text-base text-[#0d0d0d]/70 shadow-sm backdrop-blur dark:border-white/10 dark:bg-neutral-950/70 dark:text-white/70">
            Skill not found.
          </div>

          <div v-else class="flex flex-col gap-6">
            <div class="flex items-center justify-between">
              <button
                type="button"
                class="inline-flex h-9 cursor-pointer items-center gap-2 border border-black/10 bg-white/70 px-3 text-base font-semibold text-[#0d0d0d] shadow-sm backdrop-blur hover:bg-white/90 dark:border-white/10 dark:bg-neutral-950/70 dark:text-white dark:hover:bg-neutral-950/90"
                @click="goBack"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="m15 18-6-6 6-6" />
                </svg>
                Back
              </button>
            </div>

            <div class="overflow-hidden">
              <div class="relative h-44 w-full bg-neutral-200 dark:bg-neutral-800">
                <img
                  v-if="skill.banner"
                  :src="skill.banner"
                  :alt="`${skill.name} banner`"
                  class="h-full w-full object-cover"
                >
                <div class="absolute inset-0 bg-gradient-to-t from-black/35 via-black/10 to-transparent" />
              </div>

              <div class="p-5">
                <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div class="flex items-start gap-4">
                    <div class="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden border border-black/10 bg-white/80 text-base font-semibold text-[#0d0d0d]/70 dark:border-white/10 dark:bg-neutral-950/80 dark:text-white/70">
                      <img v-if="skill.icon" :src="skill.icon" :alt="skill.name" class="h-full w-full object-cover">
                      <span v-else>{{ skill.name.slice(0, 2).toUpperCase() }}</span>
                    </div>

                    <div class="min-w-0">
                      <div class="text-2xl font-semibold tracking-tight">{{ skill.name }}</div>
                      <div class="mt-1 text-base text-[#0d0d0d]/60 dark:text-white/60">
                        by
                        <a
                          v-if="skill.authorUrl"
                          :href="skill.authorUrl"
                          target="_blank"
                          rel="noreferrer"
                          class="cursor-pointer font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
                        >
                          {{ skill.publisher }}
                        </a>
                        <span v-else class="font-semibold">{{ skill.publisher }}</span>
                      </div>

                      <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-base text-[#0d0d0d]/70 dark:text-white/70">
                        <div class="flex items-center gap-1">
                          <div class="flex items-center">
                            <svg
                              v-for="n in 5"
                              :key="n"
                              xmlns="http://www.w3.org/2000/svg"
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              :fill="n <= Math.round(skill.rating) ? 'currentColor' : 'none'"
                              stroke="currentColor"
                              stroke-width="2"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              class="text-yellow-500"
                              aria-hidden="true"
                            >
                              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                            </svg>
                          </div>
                          <span class="font-semibold">{{ skill.rating.toFixed(1) }}</span>
                        </div>

                        <div class="font-semibold">{{ formatInstalls(skill.activeInstalls) }}+ active installs</div>
                      </div>

                      <div class="mt-3 text-base text-[#0d0d0d]/80 dark:text-white/80">
                        {{ skill.shortDescription }}
                      </div>
                    </div>
                  </div>

                  <div class="flex flex-col gap-2 lg:w-64">
                    <button
                      type="button"
                      class="h-11 w-full cursor-pointer border border-indigo-600 px-4 text-base font-semibold shadow-sm"
                      :class="isEnabled ? 'bg-white text-indigo-600 hover:bg-indigo-50 dark:bg-neutral-900 dark:hover:bg-neutral-800' : 'bg-indigo-600 text-white hover:bg-indigo-700'"
                      :disabled="loadingEnable || !skillMeta"
                      @click="toggleEnabled"
                    >
                      {{ loadingEnable ? '...' : (isEnabled ? 'Disable' : 'Enable') }}
                    </button>

                    <a
                      v-if="skill.homepage"
                      :href="skill.homepage"
                      target="_blank"
                      rel="noreferrer"
                      class="h-10 w-full cursor-pointer border border-black/10 bg-white/70 px-4 text-center text-base font-semibold leading-10 text-[#0d0d0d] shadow-sm hover:bg-white/90 dark:border-white/10 dark:bg-neutral-950/70 dark:text-white dark:hover:bg-neutral-950/90"
                    >
                      View on web
                    </a>
                  </div>
                </div>

                <div class="mt-4 flex flex-wrap gap-2">
                  <span
                    v-for="tag in skill.tags"
                    :key="tag"
                    class="border border-black/10 bg-white/70 px-2.5 py-1 text-base font-semibold text-[#0d0d0d]/70 dark:border-white/10 dark:bg-neutral-950/70 dark:text-white/70"
                  >
                    {{ tag }}
                  </span>
                </div>
              </div>
            </div>

            <div class="border-b border-black/50 px-4 pt-3 dark:border-white/50">
              <div class="flex flex-wrap gap-0">
                <button
                  v-for="tab in tabs"
                  :key="tab"
                  type="button"
                  class="-mb-px cursor-pointer px-4 py-2 text-base font-normal text-[#0d0d0d]/70 hover:bg-neutral-100 hover:text-[#0d0d0d] dark:text-white/70 dark:hover:bg-neutral-900 dark:hover:text-white"
                  :class="activeTab === tab ? 'border border-black/50 border-b-0 bg-white text-[#0d0d0d] dark:border-white/50 dark:border-b-0 dark:bg-neutral-950 dark:text-white' : ''"
                  @click="activeTab = tab"
                >
                  {{ tab }}
                </button>
              </div>
            </div>

            <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div class="lg:col-span-2">
                <div>
                  <div class="p-5">
                    <div class="text-base text-[#0d0d0d]/80 dark:text-white/80" style="white-space: pre-wrap;">
                      {{ activeTabContent }}
                    </div>
                  </div>
                </div>
              </div>

              <div class="lg:col-span-1">
                <div>
                  <div v-if="skill.commercial" class="mb-4 pb-4 border-b border-black/10 dark:border-white/10">
                    <div class="text-[20px] font-semibold text-[#1e1e1e] dark:text-white">
                      Commercial plugin
                    </div>
                    <div class="mt-2 text-base text-[#0d0d0d]/70 dark:text-white/70">
                      This plugin is free but offers additional paid commercial upgrades or support.
                      <a
                        :href="skill.homepage || '#'"
                        target="_blank"
                        rel="noreferrer"
                        class="inline-flex cursor-pointer items-center gap-1 font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
                      >
                        View support
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                          <path d="M15 3h6v6" />
                          <path d="M10 14 21 3" />
                          <path d="M21 14v7H3V3h7" />
                        </svg>
                      </a>
                    </div>
                  </div>

                  <div class="bg-white/70 dark:bg-neutral-950/70">
                    <div class="flex items-start justify-between gap-4 border-b border-black/10 px-0 py-3 text-base dark:border-white/10">
                      <div class="text-[#0d0d0d]/60 dark:text-white/60">Version</div>
                      <div class="font-semibold text-[#0d0d0d]/80 dark:text-white/80">{{ skill.version }}</div>
                    </div>

                    <div class="flex items-start justify-between gap-4 border-b border-black/10 px-0 py-3 text-base dark:border-white/10">
                      <div class="text-[#0d0d0d]/60 dark:text-white/60">Last updated</div>
                      <div class="font-semibold text-[#0d0d0d]/80 dark:text-white/80">{{ skill.lastUpdated }}</div>
                    </div>

                    <div class="flex items-start justify-between gap-4 border-b border-black/10 px-0 py-3 text-base dark:border-white/10">
                      <div class="text-[#0d0d0d]/60 dark:text-white/60">Active installs</div>
                      <div class="font-semibold text-[#0d0d0d]/80 dark:text-white/80">{{ formatInstalls(skill.activeInstalls) }}+</div>
                    </div>

                    <div v-if="skill.downloads" class="flex items-start justify-between gap-4 border-b border-black/10 px-0 py-3 text-base dark:border-white/10">
                      <div class="text-[#0d0d0d]/60 dark:text-white/60">Downloads</div>
                      <div class="font-semibold text-[#0d0d0d]/80 dark:text-white/80">{{ formatBigNumber(skill.downloads) }}</div>
                    </div>

                    <div v-if="skill.requires" class="flex items-start justify-between gap-4 border-b border-black/10 px-0 py-3 text-base dark:border-white/10">
                      <div class="text-[#0d0d0d]/60 dark:text-white/60">Requires</div>
                      <div class="font-semibold text-[#0d0d0d]/80 dark:text-white/80">{{ skill.requires }}</div>
                    </div>

                    <div v-if="skill.testedUpTo" class="flex items-start justify-between gap-4 border-b border-black/10 px-0 py-3 text-base dark:border-white/10">
                      <div class="text-[#0d0d0d]/60 dark:text-white/60">Tested up to</div>
                      <div class="font-semibold text-[#0d0d0d]/80 dark:text-white/80">{{ skill.testedUpTo }}</div>
                    </div>

                    <div v-if="skill.requiresPhp" class="flex items-start justify-between gap-4 border-b border-black/10 px-0 py-3 text-base dark:border-white/10">
                      <div class="text-[#0d0d0d]/60 dark:text-white/60">Requires PHP</div>
                      <div class="font-semibold text-[#0d0d0d]/80 dark:text-white/80">{{ skill.requiresPhp }}</div>
                    </div>

                    <div v-if="skill.license" class="flex items-start justify-between gap-4 border-b border-black/10 px-0 py-3 text-base dark:border-white/10">
                      <div class="text-[#0d0d0d]/60 dark:text-white/60">License</div>
                      <a
                        v-if="skill.licenseUrl"
                        :href="skill.licenseUrl"
                        target="_blank"
                        rel="noreferrer"
                        class="cursor-pointer font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
                      >
                        {{ skill.license }}
                      </a>
                      <div v-else class="font-semibold text-[#0d0d0d]/80 dark:text-white/80">{{ skill.license }}</div>
                    </div>

                    <div v-if="skill.supportThreads" class="flex items-start justify-between gap-4 border-b border-black/10 px-0 py-3 text-base dark:border-white/10">
                      <div class="text-[#0d0d0d]/60 dark:text-white/60">Support threads</div>
                      <div class="font-semibold text-[#0d0d0d]/80 dark:text-white/80">{{ formatBigNumber(skill.supportThreads) }}</div>
                    </div>

                    <div class="px-0 py-3 text-base text-[#0d0d0d]/60 dark:text-white/60">
                      Skill ID: {{ skill.id }}
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
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { getSkillService } from '@pkg/agent/services/SkillService';
import type { SkillMeta } from '@pkg/agent/services/SkillService';

const route = useRoute();
const router = useRouter();

const THEME_STORAGE_KEY = 'agentTheme';
const isDark = ref(false);

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

const skillId = computed(() => {
  const raw = route.params.id;
  return typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : '';
});

const skillMeta = ref<SkillMeta | null>(null);
const loadingSkill = ref(false);
const isEnabled = ref(false);
const loadingEnable = ref(false);

const loadSkill = async(id: string) => {
  loadingSkill.value = true;
  try {
    const svc = getSkillService();
    skillMeta.value = await svc.getSkillMetaById(id);
    isEnabled.value = await svc.isSkillEnabled(id);
  } catch {
    skillMeta.value = null;
    isEnabled.value = false;
  } finally {
    loadingSkill.value = false;
  }
};

const toggleEnabled = async() => {
  if (!skillMeta.value) {
    return;
  }
  loadingEnable.value = true;
  try {
    const svc = getSkillService();
    if (isEnabled.value) {
      await svc.disableSkill(skillMeta.value.id);
      isEnabled.value = false;
    } else {
      await svc.enableSkill(skillMeta.value);
      isEnabled.value = true;
    }
  } finally {
    loadingEnable.value = false;
  }
};

const skill = computed(() => {
  if (!skillMeta.value) {
    return null;
  }

  const s: any = skillMeta.value;
  const sections = (s.sections && typeof s.sections === 'object') ? s.sections : {};

  return {
    id: s.id,
    name: s.title,
    shortDescription: s.shortDescription || s.description || '',
    publisher: s.publisher || '',
    authorUrl: s.authorUrl,
    banner: s.banner,
    icon: s.icon,
    homepage: s.homepage,
    commercial: !!s.commercial,
    rating: typeof s.rating === 'number' ? s.rating : 0,
    activeInstalls: typeof s.activeInstalls === 'number' ? s.activeInstalls : 0,
    version: s.version || '',
    lastUpdated: s.lastUpdated || '',
    requires: s.requires,
    testedUpTo: s.testedUpTo,
    requiresPhp: s.requiresPhp,
    license: s.license,
    licenseUrl: s.licenseUrl,
    downloads: s.downloads,
    supportThreads: s.supportThreads,
    tags: Array.isArray(s.tags) ? s.tags : [],
    overview: String(sections.details || ''),
    reviews: String(sections.reviews || ''),
    installation: String(sections.installation || ''),
    advancedView: String(sections.development || ''),
    faq: s.faq,
    screenshots: s.screenshots,
    changelog: s.changelog,
  };
});

const tabs = ['Details', 'Reviews', 'Installation', 'Development'] as const;

type Tab = (typeof tabs)[number];

const activeTab = ref<Tab>('Details');

watch(skillId, (id) => {
  activeTab.value = 'Details';
  if (id) {
    loadSkill(id);
  } else {
    skillMeta.value = null;
  }
}, { immediate: true });

const goBack = () => {
  if (window.history.length > 1) {
    router.back();
    return;
  }
  router.push('/Skills');
};

const activeTabContent = computed(() => {
  if (!skill.value) {
    return '';
  }
  switch (activeTab.value) {
  case 'Reviews':
    return skill.value.reviews || '';
  case 'Installation':
    return skill.value.installation || '';
  case 'Development':
    return skill.value.advancedView || '';
  case 'Details': {
    const parts = [
      skill.value.overview || '',
      skill.value.faq ? `\n\nFAQ\n\n${skill.value.faq}` : '',
      skill.value.screenshots ? `\n\nScreenshots\n\n${skill.value.screenshots}` : '',
      skill.value.changelog ? `\n\nChangelog\n\n${skill.value.changelog}` : '',
    ].filter(Boolean);

    return parts.join('');
  }
  default:
    return '';
  }
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

const formatBigNumber = (n: number): string => {
  return new Intl.NumberFormat('en-US').format(n);
};
</script>
