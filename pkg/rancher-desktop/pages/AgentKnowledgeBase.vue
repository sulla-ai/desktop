<template>
  <div class="h-screen overflow-hidden bg-white text-[#0d0d0d] dark:bg-neutral-950 dark:text-neutral-50 font-sans" :class="{ dark: isDark }">
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
              to="/KnowledgeBase"
              class="text-sm font-semibold"
              :class="route.path === '/KnowledgeBase' ? 'text-[#0d0d0d] dark:text-white' : 'text-[#0d0d0d]/60 hover:text-[#0d0d0d] dark:text-white/60 dark:hover:text-white'"
            >
              KnowledgeBase
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
              class="flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white/70 text-[#0d0d0d] shadow-sm backdrop-blur hover:bg-white/90 dark:border-white/10 dark:bg-neutral-950/70 dark:text-white dark:hover:bg-neutral-950/90"
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
              class="flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white/70 text-[#0d0d0d] shadow-sm backdrop-blur hover:bg-white/90 dark:border-white/10 dark:bg-neutral-950/70 dark:text-white dark:hover:bg-neutral-950/90"
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
                <path d="m4.93 19.07 1.41-1.41" />
                <path d="m17.66 6.34 1.41-1.41" />
              </svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div class="flex min-h-0 flex-1 overflow-hidden">
        <aside class="hidden w-[280px] shrink-0 border-r border-black/10 bg-white/60 backdrop-blur dark:border-white/10 dark:bg-neutral-950/40 lg:block">
          <div class="h-full overflow-y-auto px-4 py-6">
            <div class="mb-6">
              <div class="relative">
                <input
                  v-model="query"
                  type="text"
                  placeholder="Search"
                  class="h-9 w-full rounded-full border border-black/10 bg-white/80 px-3 text-sm text-[#0d0d0d] shadow-sm outline-none ring-0 placeholder:text-[#0d0d0d]/50 focus:border-black/20 dark:border-white/10 dark:bg-neutral-900/60 dark:text-neutral-50 dark:placeholder:text-white/40 dark:focus:border-white/20"
                >
              </div>
            </div>

            <nav class="text-sm">
              <ul role="list" class="flex flex-col gap-y-7">
                <li v-if="loadingPages" class="text-sm text-[#0d0d0d]/60 dark:text-white/60">Loading…</li>
                <li v-else-if="nav.length === 0" class="text-sm text-[#0d0d0d]/60 dark:text-white/60">No KnowledgeBase pages found.</li>
                <li v-for="group in nav" :key="group.tag">
                  <div class="text-[11px] font-semibold uppercase tracking-wide text-[#0d0d0d]/50 dark:text-white/40">{{ group.tag }}</div>

                  <ul role="list" class="-mx-2 mt-2 space-y-1">
                    <li v-for="p in group.pages" :key="p.slug">
                      <button
                        type="button"
                        class="w-full truncate rounded-md px-2 py-2 text-left text-sm font-semibold"
                        :class="activeSlug === p.slug
                          ? 'bg-black/5 text-[#0d0d0d] dark:bg-white/10 dark:text-white'
                          : 'text-[#0d0d0d]/70 hover:bg-black/5 hover:text-[#0d0d0d] dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white'"
                        @click="selectPage(p.slug)"
                      >
                        {{ p.title }}
                      </button>
                    </li>
                  </ul>
                </li>
              </ul>
            </nav>
          </div>
        </aside>

        <main class="min-w-0 flex-1 overflow-y-auto">
          <div class="mx-auto w-full max-w-4xl px-6 py-10">
            <div class="mb-8">
              <div class="text-[12px] font-semibold text-[#0d0d0d]/60 dark:text-white/60">KnowledgeBase</div>
              <h1 class="mt-2 text-3xl font-semibold tracking-tight">{{ activePage?.title || 'KnowledgeBase' }}</h1>
              <p v-if="activePage && activePage.tags.length > 0" class="mt-3 text-sm leading-6 text-[#0d0d0d]/70 dark:text-white/70">
                {{ activePage.tags.join(' / ') }}
              </p>
            </div>

            <div v-if="loadingPage" class="text-sm text-[#0d0d0d]/60 dark:text-white/60">Loading…</div>
            <div v-else-if="!activePage" class="text-sm text-[#0d0d0d]/60 dark:text-white/60">Select a page from the left.</div>
            <div v-else class="prose prose-sm dark:prose-invert max-w-none">
              <div v-for="section in activePage.article.sections" :key="section.section_id" class="mb-8">
                <h2>{{ section.title }}</h2>
                <div v-html="renderMarkdown(section.content)" />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import DOMPurify from 'dompurify';
import { marked } from 'marked';

import type { KnowledgeBaseNav, KnowledgeBasePage, KnowledgeBasePageSummary } from '@pkg/agent/services/KnowledgeBaseService';
import { getKnowledgeBaseService } from '@pkg/agent/services/KnowledgeBaseService';

const route = useRoute();
const isDark = ref(document.documentElement.classList.contains('dark'));
const query = ref('');

const loadingPages = ref(false);
const pages = ref<KnowledgeBasePageSummary[]>([]);
const activeSlug = ref<string | null>(null);
const activePage = ref<KnowledgeBasePage | null>(null);
const loadingPage = ref(false);

const filteredPages = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) {
    return pages.value;
  }
  return pages.value.filter(p => (p.title || '').toLowerCase().includes(q));
});

const nav = computed<KnowledgeBaseNav>(() => {
  const svc = getKnowledgeBaseService();
  return svc.buildNav(filteredPages.value);
});

const renderMarkdown = (markdown: string): string => {
  const raw = typeof markdown === 'string' ? markdown : String(markdown || '');
  const html = (marked(raw) as string) || '';
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|data:image\/(?:png|gif|jpe?g|webp);base64,|\/|\.|#)/i,
  });
};

const selectPage = async(slug: string) => {
  const id = String(slug || '').trim();
  if (!id) {
    return;
  }
  activeSlug.value = id;
  loadingPage.value = true;
  try {
    activePage.value = await getKnowledgeBaseService().getPage(id);
  } finally {
    loadingPage.value = false;
  }
};

onMounted(async() => {
  loadingPages.value = true;
  try {
    pages.value = await getKnowledgeBaseService().listPages(500);
  } finally {
    loadingPages.value = false;
  }

  if (!activeSlug.value && pages.value.length > 0) {
    const first = pages.value[0];
    if (first?.slug) {
      await selectPage(first.slug);
    }
  }
});

watch(() => query.value, async() => {
  if (activeSlug.value) {
    const stillVisible = filteredPages.value.some(p => p.slug === activeSlug.value);
    if (!stillVisible) {
      activeSlug.value = null;
      activePage.value = null;
    }
  }
});

function toggleTheme() {
  isDark.value = !isDark.value;
  document.documentElement.classList.toggle('dark', isDark.value);
}
</script>
