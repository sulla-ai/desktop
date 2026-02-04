<template>
  <div class="min-h-screen bg-white text-[#0d0d0d] dark:bg-slate-900 dark:text-neutral-50 font-sans"
    :class="{ dark: isDark }">
    <div class="flex min-h-screen flex-col">
      <AgentHeader :is-dark="isDark" :toggle-theme="toggleTheme" />

      <div class="flex w-full flex-col">
        <div class="overflow-hidden bg-slate-900 dark:-mt-19 dark:-mb-32 dark:pt-19 dark:pb-32">
          <div class="py-16 sm:px-2 lg:relative lg:px-0 lg:py-20">
            <div
              class="mx-auto grid max-w-2xl grid-cols-1 items-center gap-x-8 gap-y-16 px-4 lg:max-w-8xl lg:grid-cols-2 lg:px-8 xl:gap-x-16 xl:px-12">
              <div class="relative z-10 md:text-center lg:text-left">
                <img alt="" width="530" height="530" decoding="async" data-nimg="1"
                  class="absolute right-full bottom-full -mr-72 -mb-56 opacity-50" style="color:transparent"
                  :src="splashUrl">
                <div class="relative">
                  <p
                    class="inline bg-linear-to-r from-indigo-200 via-sky-400 to-indigo-200 bg-clip-text font-display text-5xl tracking-tight text-transparent">
                    Sulla KnowledgeBase.</p>
                  <p class="mt-3 text-2xl tracking-tight text-slate-400">
                    Long-term memories Sulla has collected and organized through dreaming.
                  </p>
                  <div class="mt-8 flex gap-4 md:justify-center lg:justify-start">
                    <a
                      class="rounded-full bg-sky-300 py-2 px-4 text-sm font-semibold text-slate-900 hover:bg-sky-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300/50 active:bg-sky-500"
                      href="#quick-start"
                    >
                      Getting started
                    </a>
                    <a
                      class="rounded-full bg-slate-800 py-2 px-4 text-sm font-medium text-white hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50 active:text-slate-400"
                      href="https://github.com/rancher-sandbox/rancher-desktop"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View on GitHub
                    </a>
                  </div>
                </div>
              </div>
              <div class="relative lg:static xl:pl-10">
                <div
                  class="absolute inset-x-[-50vw] -top-32 -bottom-48 mask-[linear-gradient(transparent,white,white)] lg:-top-32 lg:right-0 lg:-bottom-32 lg:left-[calc(50%+14rem)] lg:mask-none dark:mask-[linear-gradient(transparent,white,transparent)] lg:dark:mask-[linear-gradient(white,white,transparent)]">
                  <svg aria-hidden="true" viewBox="0 0 668 1069" width="668" height="1069" fill="none"
                    class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 lg:left-0 lg:translate-x-0 lg:translate-y-[-60%]">
                    <defs>
                      <clipPath id="clip">
                        <path fill="#fff" transform="rotate(-180 334 534.5)" d="M0 0h668v1069H0z" />
                      </clipPath>
                    </defs>
                    <g opacity="0.45" clip-path="url(#clip)" stroke-width="3.5">
                      <!-- Vertical lines (dendrites/axons) with more density -->
                      <path opacity="0.35"
                        d="M80 50v969 M140 50v969 M200 50v969 M260 50v969 M320 50v969 M380 50v969 M440 50v969 M500 50v969 M560 50v969 M620 50v969"
                        stroke="#334155" />

                      <!-- More organic curved connections + branches -->
                      <path stroke="#0EA5E9" stroke-opacity="0.6" d="
                        M100 150 Q180 220 120 320 Q80 380 160 450
                        M200 180 L280 250 Q340 300 260 420 L320 480
                        M400 120 Q480 200 420 340 Q380 420 460 500
                        M520 180 Q580 260 540 380 Q600 440 520 520
                        M300 600 Q380 680 320 780 Q280 840 360 920
                        M180 700 L260 780 Q320 850 240 950
                        M500 650 Q560 720 500 820 Q460 880 540 980
                      " />

                      <!-- Nodes: more, varied sizes, glowing highlights -->
                      <circle cx="120" cy="180" r="12" fill="#0EA5E9" fill-opacity="0.5" stroke="#0EA5E9" />
                      <circle cx="280" cy="320" r="14" fill="#1E293B" stroke="#334155" />
                      <circle cx="420" cy="450" r="10" fill="#0EA5E9" fill-opacity="0.55" stroke="#0EA5E9" />
                      <circle cx="180" cy="520" r="11" fill="#1E293B" stroke="#334155" />
                      <circle cx="340" cy="680" r="15" fill="#0EA5E9" fill-opacity="0.6" stroke="#0EA5E9" />
                      <circle cx="500" cy="750" r="13" fill="#1E293B" stroke="#334155" />
                      <circle cx="260" cy="820" r="9" fill="#0EA5E9" fill-opacity="0.5" stroke="#0EA5E9" />
                      <circle cx="380" cy="900" r="12" fill="#1E293B" stroke="#334155" />
                      <circle cx="540" cy="950" r="14" fill="#0EA5E9" fill-opacity="0.65" stroke="#0EA5E9" />

                      <!-- Extra subtle connections for depth -->
                      <path stroke="#334155" stroke-opacity="0.4" d="
                        M140 300 Q220 380 180 480
                        M360 400 L440 480 Q500 540 420 620
                        M220 550 Q300 620 240 720
                        M480 700 Q560 780 500 880
                      " />
                    </g>
                  </svg>
                </div>
                <div class="relative">
                  <img alt="" width="530" height="530" decoding="async" data-nimg="1" class="absolute -top-64 -right-64"
                    style="color:transparent" :src="splashUrl">
                  <img alt="" width="567" height="567" decoding="async" data-nimg="1"
                    class="absolute -right-44 -bottom-40" style="color:transparent" :src="splash2Url">
                  <div
                    class="absolute inset-0 rounded-2xl bg-linear-to-tr from-sky-300 via-sky-300/70 to-blue-300 opacity-10 blur-lg">
                  </div>
                  <div
                    class="absolute inset-0 rounded-2xl bg-linear-to-tr from-sky-300 via-sky-300/70 to-blue-300 opacity-10">
                  </div>
                  <div class="relative rounded-2xl bg-[#0A101F]/80 ring-1 ring-white/10 backdrop-blur-sm">
                    <div
                      class="absolute -top-px right-11 left-20 h-px bg-linear-to-r from-sky-300/0 via-sky-300/70 to-sky-300/0">
                    </div>
                    <div
                      class="absolute right-20 -bottom-px left-11 h-px bg-linear-to-r from-blue-400/0 via-blue-400 to-blue-400/0">
                    </div>
                    <div class="pt-4 pl-4">
                      <svg aria-hidden="true" viewBox="0 0 42 10" fill="none" class="h-2.5 w-auto stroke-slate-500/30">
                        <circle cx="5" cy="5" r="4.5"></circle>
                        <circle cx="21" cy="5" r="4.5"></circle>
                        <circle cx="37" cy="5" r="4.5"></circle>
                      </svg>
                      <div class="mt-4 flex space-x-2 text-xs">
                        <div class="flex h-6 rounded-full bg-linear-to-r from-sky-400/30 via-sky-400 to-sky-400/30 p-px font-medium text-sky-300">
                          <div class="flex items-center rounded-full px-2.5 bg-slate-800">sulla.config.js</div>
                        </div>
                        <div class="flex h-6 rounded-full text-slate-500">
                          <div class="flex items-center rounded-full px-2.5">awareness.json</div>
                        </div>
                      </div>
                      <div class="mt-6 flex items-start px-1 text-sm">
                        <div aria-hidden="true" class="border-r border-slate-300/5 pr-4 font-mono text-slate-600 select-none">01<br>02<br>03<br>04<br>05<br>06<br>07<br></div>
                        <pre class="prism-code language-javascript flex overflow-x-auto pb-6"><code class="px-4"><div class="token-line"><span class="token comment">// sulla.config.js</span></div><div class="token-line"><span class="token keyword module">export</span><span class="token plain"> </span><span class="token keyword module">default</span><span class="token plain"> </span><span class="token punctuation">{</span><span class="token plain"></span></div><div class="token-line"><span class="token plain">  </span><span class="token literal-property property">soul</span><span class="token operator">:</span><span class="token plain"> </span><span class="token string">'curious_engineer'</span><span class="token punctuation">,</span><span class="token plain"></span></div><div class="token-line"><span class="token plain">  </span><span class="token literal-property property">memory</span><span class="token operator">:</span><span class="token plain"> </span><span class="token punctuation">{</span><span class="token plain"> </span><span class="token literal-property property">provider</span><span class="token operator">:</span><span class="token plain"> </span><span class="token string">'chroma'</span><span class="token punctuation">,</span><span class="token plain"> </span><span class="token literal-property property">persist</span><span class="token operator">:</span><span class="token plain"> </span><span class="token boolean">true</span><span class="token plain"> </span><span class="token punctuation">}</span><span class="token punctuation">,</span><span class="token plain"></span></div><div class="token-line"><span class="token plain">  </span><span class="token literal-property property">memoriesStored</span><span class="token operator">:</span><span class="token plain"> </span><span class="token number">47</span><span class="token punctuation">,</span><span class="token plain"></span></div><div class="token-line"><span class="token plain">  </span><span class="token literal-property property">lastDream</span><span class="token operator">:</span><span class="token plain"> </span><span class="token string">'2026-02-02T03:00:00Z'</span><span class="token punctuation">,</span><span class="token plain"></span></div><div class="token-line"><span class="token punctuation">}</span></div></code></pre>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="relative mx-auto flex w-full max-w-8xl flex-auto justify-center sm:px-2 lg:px-8 xl:px-12">
          <div class="hidden lg:relative lg:block lg:flex-none">
            <div class="absolute inset-y-0 right-0 w-[50vw] bg-slate-50 dark:hidden"></div>
            <div class="absolute top-16 right-0 bottom-0 hidden h-12 w-px bg-linear-to-t from-slate-800 dark:block"></div>
            <div class="absolute top-28 right-0 bottom-0 hidden w-px bg-slate-800 dark:block"></div>
            <div class="sticky top-19 -ml-0.5 h-[calc(100vh-4.75rem)] w-64 overflow-x-hidden overflow-y-auto py-16 pr-8 pl-0.5 xl:w-72 xl:pr-16">
              <nav class="text-base lg:text-sm">
                <ul role="list" class="space-y-9">
                  <li v-if="loadingPages" class="text-sm text-slate-500 dark:text-slate-400">Loading…</li>
                  <li v-else-if="nav.length === 0" class="text-sm text-slate-500 dark:text-slate-400">No KnowledgeBase pages found.</li>
                  <li v-for="group in nav" :key="group.tag">
                    <h2 class="font-display font-medium text-slate-900 dark:text-white">{{ group.tag }}</h2>
                    <ul role="list" class="mt-2 space-y-2 border-l-2 border-slate-100 lg:mt-4 lg:space-y-4 lg:border-slate-200 dark:border-slate-800">
                      <li v-for="p in group.pages" :key="p.slug" class="relative">
                        <a
                          href="#"
                          class="block w-full pl-3.5 before:pointer-events-none before:absolute before:top-1/2 before:-left-1 before:h-1.5 before:w-1.5 before:-translate-y-1/2 before:rounded-full"
                          :class="activeSlug === p.slug
                            ? 'font-semibold text-sky-500 before:bg-sky-500'
                            : 'text-slate-500 before:hidden before:bg-slate-300 hover:text-slate-600 hover:before:block dark:text-slate-400 dark:before:bg-slate-700 dark:hover:text-slate-300'"
                          @click.prevent="selectPage(p.slug)"
                        >
                          {{ p.title }}
                        </a>
                      </li>
                    </ul>
                  </li>
                </ul>
              </nav>
            </div>
          </div>

          <div class="max-w-2xl min-w-0 flex-auto px-4 py-16 lg:max-w-none lg:pr-0 lg:pl-8 xl:px-16">
            <article v-if="activePage">
              <header class="mb-9 space-y-1">
                <p class="font-display text-sm font-medium text-sky-500">{{ (activePage.tags && activePage.tags[0]) || 'Memory' }}</p>
                <h1 class="font-display text-3xl tracking-tight text-slate-900 dark:text-white">{{ activePage.title }}</h1>
              </header>
              <div
                ref="articleContentEl"
                class="prose max-w-none prose-slate dark:text-slate-400 dark:prose-invert prose-headings:scroll-mt-28 prose-headings:font-display prose-headings:font-normal lg:prose-headings:scroll-mt-34 prose-lead:text-slate-500 dark:prose-lead:text-slate-400 prose-a:font-semibold dark:prose-a:text-sky-400 dark:[--tw-prose-background:var(--color-slate-900)] prose-a:no-underline prose-a:shadow-[inset_0_-2px_0_0_var(--tw-prose-background,#fff),inset_0_calc(-1*(var(--tw-prose-underline-size,4px)+2px))_0_0_var(--tw-prose-underline,var(--color-sky-300))] prose-a:hover:[--tw-prose-underline-size:6px] dark:prose-a:shadow-[inset_0_calc(-1*var(--tw-prose-underline-size,2px))_0_0_var(--tw-prose-underline,var(--color-sky-800))] dark:prose-a:hover:[--tw-prose-underline-size:6px] prose-pre:rounded-xl prose-pre:bg-slate-900 prose-pre:shadow-lg dark:prose-pre:bg-slate-800/60 dark:prose-pre:shadow-none dark:prose-pre:ring-1 dark:prose-pre:ring-slate-300/10 dark:prose-hr:border-slate-800"
                v-html="renderedContent"></div>

              <dl v-if="prevPage || nextPage" class="mt-12 flex border-t border-slate-200 pt-6 dark:border-slate-800">
                <div v-if="prevPage">
                  <dt class="font-display text-sm font-medium text-slate-900 dark:text-white">Previous</dt>
                  <dd class="mt-1">
                    <a
                      class="flex items-center gap-x-1 text-base font-semibold text-slate-500 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300 flex-row-reverse"
                      href="#"
                      @click.prevent="selectPage(prevPage.slug)"
                    >
                      {{ prevPage.title }}
                      <svg viewBox="0 0 16 16" aria-hidden="true" class="h-4 w-4 flex-none fill-current -scale-x-100">
                        <path d="m9.182 13.423-1.17-1.16 3.505-3.505H3V7.065h8.517l-3.506-3.5L9.181 2.4l5.512 5.511-5.511 5.512Z"></path>
                      </svg>
                    </a>
                  </dd>
                </div>
                <div v-if="nextPage" class="ml-auto text-right">
                  <dt class="font-display text-sm font-medium text-slate-900 dark:text-white">Next</dt>
                  <dd class="mt-1">
                    <a
                      class="flex items-center gap-x-1 text-base font-semibold text-slate-500 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300"
                      href="#"
                      @click.prevent="selectPage(nextPage.slug)"
                    >
                      {{ nextPage.title }}
                      <svg viewBox="0 0 16 16" aria-hidden="true" class="h-4 w-4 flex-none fill-current">
                        <path d="m9.182 13.423-1.17-1.16 3.505-3.505H3V7.065h8.517l-3.506-3.5L9.181 2.4l5.512 5.511-5.511 5.512Z"></path>
                      </svg>
                    </a>
                  </dd>
                </div>
              </dl>
            </article>
            <article v-else-if="loadingPage" class="py-16 text-center text-slate-500 dark:text-slate-400">
              Loading...
            </article>
            <article v-else class="py-16 text-center text-slate-500 dark:text-slate-400">
              Select an article from the sidebar.
            </article>
          </div>
          <div
            class="hidden xl:sticky xl:top-19 xl:-mr-6 xl:block xl:h-[calc(100vh-4.75rem)] xl:flex-none xl:overflow-y-auto xl:py-16 xl:pr-6">
            <nav aria-labelledby="on-this-page-title" class="w-56">
              <h2 id="on-this-page-title" class="font-display text-sm font-medium text-slate-900 dark:text-white">On
                this page</h2>
              <ol role="list" class="mt-4 space-y-3 text-sm">
                <li v-for="heading in tableOfContents" :key="heading.id">
                  <h3 v-if="heading.level === 1">
                    <a class="text-sky-500" :href="'#' + heading.id" @click.prevent="scrollToHeading(heading.id)">{{ heading.text }}</a>
                  </h3>
                  <a v-else
                    class="font-normal text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
                    :class="{ 'pl-4': heading.level === 2 }"
                    :href="'#' + heading.id" @click.prevent="scrollToHeading(heading.id)">{{ heading.text }}</a>
                </li>
              </ol>
            </nav>
          </div>
          <!--$--><!--/$-->
        </div>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import AgentHeader from './agent/AgentHeader.vue';

import { computed, onMounted, ref, watch } from 'vue';

import DOMPurify from 'dompurify';
import { marked } from 'marked';

import './assets/AgentKnowledgeBase.css';

import type { KnowledgeBaseNav, KnowledgeBasePage, KnowledgeBasePageSummary } from '@pkg/agent/services/KnowledgeBaseService';
import { getKnowledgeBaseService } from '@pkg/agent/services/KnowledgeBaseService';
const THEME_STORAGE_KEY = 'agentTheme';
const isDark = ref(false);
const query = ref('');

const splashUrl = new URL('./assets/splash.png', import.meta.url).toString();
const splash2Url = new URL('./assets/splash2.png', import.meta.url).toString();

const loadingPages = ref(false);
const pages = ref<KnowledgeBasePageSummary[]>([]);
const activeSlug = ref<string | null>(null);
const activePage = ref<KnowledgeBasePage | null>(null);
const loadingPage = ref(false);
const articleContentEl = ref<HTMLElement | null>(null);

interface TocHeading {
  id: string;
  text: string;
  level: number;
}

function slugifyHeading(text: string): string {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '');
}

function scrollToHeading(id: string): void {
  const targetId = String(id || '').trim();
  if (!targetId) {
    return;
  }

  const container = articleContentEl.value;
  const el = container?.querySelector(`[id="${targetId}"]`) || document.getElementById(targetId);
  if (!el) {
    return;
  }

  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

const renderedContent = computed(() => {
  if (!activePage.value?.article) {
    return '';
  }
  const article = activePage.value.article;
  const sections = article.sections || [];

  // Build markdown from sections
  let markdown = '';
  for (const section of sections) {
    if (section.content) {
      markdown += `${section.content}\n\n`;
    }
  }

  if (!markdown.trim()) {
    return '<p class="text-slate-500">No content available.</p>';
  }

  const renderer = new marked.Renderer();
  (renderer as any).heading = ({ tokens, depth }: { tokens: any[]; depth: number }) => {
    const plainText = Array.isArray(tokens)
      ? tokens.map(t => String((t && (t.raw ?? t.text)) || '')).join('')
      : '';
    const htmlText = marked.Parser.parseInline(tokens as any);
    const id = slugifyHeading(plainText);
    return `<h${depth} id="${id}">${htmlText}</h${depth}>`;
  };

  const html = (marked(markdown, { renderer }) as string) || '';
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|data:image\/(?:png|gif|jpe?g|webp);base64,|\/|\.|#)/i,
  });
});

const tableOfContents = computed<TocHeading[]>(() => {
  if (!renderedContent.value) {
    return [];
  }
  const headings: TocHeading[] = [];
  const regex = /<h([12])[^>]*id="([^"]*)"[^>]*>([^<]*)<\/h[12]>/gi;
  let match;
  while ((match = regex.exec(renderedContent.value)) !== null) {
    headings.push({
      level: parseInt(match[1], 10),
      id: match[2],
      text: match[3].trim(),
    });
  }
  if (headings.length === 0) {
    const simpleRegex = /<h([12])[^>]*>([^<]*)<\/h[12]>/gi;
    let idx = 0;
    while ((match = simpleRegex.exec(renderedContent.value)) !== null) {
      const text = match[2].trim();
      const id = text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '') || `heading-${idx}`;
      headings.push({ level: parseInt(match[1], 10), id, text });
      idx++;
    }
  }
  return headings;
});

const filteredPages = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) {
    return pages.value;
  }
  return pages.value.filter(p => (p.title || '').toLowerCase().includes(q));
});

const sortedPagesByDate = computed(() => {
  const parseTime = (v: string | null): number => {
    if (!v) {
      return 0;
    }
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : 0;
  };

  return [...filteredPages.value].sort((a, b) => {
    const ta = parseTime(a.updated_at);
    const tb = parseTime(b.updated_at);
    if (ta !== tb) {
      return ta - tb;
    }
    if (a.order !== b.order) {
      return (a.order || 0) - (b.order || 0);
    }
    return String(a.slug).localeCompare(String(b.slug));
  });
});

const nextPage = computed<KnowledgeBasePageSummary | null>(() => {
  const slug = activeSlug.value;
  if (!slug) {
    return null;
  }
  const idx = sortedPagesByDate.value.findIndex(p => p.slug === slug);
  if (idx < 0) {
    return null;
  }
  return sortedPagesByDate.value[idx + 1] || null;
});

const prevPage = computed<KnowledgeBasePageSummary | null>(() => {
  const slug = activeSlug.value;
  if (!slug) {
    return null;
  }
  const idx = sortedPagesByDate.value.findIndex(p => p.slug === slug);
  if (idx <= 0) {
    return null;
  }
  return sortedPagesByDate.value[idx - 1] || null;
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

const selectPage = async (slug: string) => {
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

onMounted(async () => {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    isDark.value = saved === 'dark';
  } catch {
    isDark.value = false;
  }

  loadingPages.value = true;
  try {
    pages.value = await getKnowledgeBaseService().listPages();
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

watch(() => query.value, async () => {
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
  localStorage.setItem(THEME_STORAGE_KEY, isDark.value ? 'dark' : 'light');
}
</script>
