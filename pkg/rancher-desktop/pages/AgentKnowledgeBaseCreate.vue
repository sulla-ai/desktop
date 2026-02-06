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
                    Create KnowledgeBase Page.</p>
                  <p class="mt-3 text-2xl tracking-tight text-slate-400">
                    Add new memories and knowledge to Sulla's collection.
                  </p>
                  <div class="mt-8 flex gap-4 md:justify-center lg:justify-start">
                    <router-link
                      to="/KnowledgeBase"
                      class="text-sm font-semibold"
                      :class="['rounded-full bg-slate-600 py-2 px-4 text-sm font-semibold text-white hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500/50 active:bg-slate-800']"
                    >
                      Back to KnowledgeBase
                    </router-link>
                    <a
                      class="rounded-full bg-slate-800 py-2 px-4 text-sm font-medium text-white hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50 active:text-slate-400"
                      href="https://github.com/sulla-ai/sulla-desktop"
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
                          <div class="flex items-center rounded-full px-2.5 bg-slate-800">new-knowledge.md</div>
                        </div>
                        <div class="flex h-6 rounded-full text-slate-500">
                          <div class="flex items-center rounded-full px-2.5">draft.md</div>
                        </div>
                      </div>
                      <div class="mt-6 flex items-start px-1 text-sm">
                        <div aria-hidden="true" class="border-r border-slate-300/5 pr-4 font-mono text-slate-600 select-none">01<br>02<br>03<br>04<br>05<br>06<br>07<br></div>
                        <pre class="prism-code language-javascript flex overflow-x-auto pb-6"><code class="px-4"><div class="token-line"><span class="token comment">// Creating new knowledge...</span></div><div class="token-line"><span class="token keyword module">export</span><span class="token plain"> </span><span class="token keyword module">default</span><span class="token plain"> </span><span class="token punctuation">{</span><span class="token plain"></span></div><div class="token-line"><span class="token plain">  </span><span class="token literal-property property">title</span><span class="token operator">:</span><span class="token plain"> </span><span class="token string">'New Memory'</span><span class="token punctuation">,</span><span class="token plain"></span></div><div class="token-line"><span class="token plain">  </span><span class="token literal-property property">category</span><span class="token operator">:</span><span class="token plain"> </span><span class="token string">'knowledge'</span><span class="token punctuation">,</span><span class="token plain"></span></div><div class="token-line"><span class="token plain">  </span><span class="token literal-property property">content</span><span class="token operator">:</span><span class="token plain"> </span><span class="token string">'Loading editor...'</span><span class="token punctuation">,</span><span class="token plain"></span></div><div class="token-line"><span class="token plain">  </span><span class="token literal-property property">tags</span><span class="token operator">:</span><span class="token plain"> </span><span class="token punctuation">[</span><span class="token string">'sulla'</span><span class="token punctuation">,</span><span class="token plain"> </span><span class="token string">'memory'</span><span class="token punctuation">]</span><span class="token plain"></span></div><div class="token-line"><span class="token plain">  </span><span class="token punctuation">}</span><span class="token punctuation">;</span><span class="token plain"></span></div></code></pre>
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
                  <li>
                    <h2 class="font-display font-medium text-slate-900 dark:text-white">Page Settings</h2>
                    <div class="mt-4 space-y-4">
                      <div>
                        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Title</label>
                        <input
                          v-model="pageTitle"
                          type="text"
                          placeholder="Enter page title..."
                          class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                        />
                      </div>
                      <div>
                        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Category</label>
                        <select
                          v-model="pageCategory"
                          class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                        >
                          <option value="Memory">Memory</option>
                          <option value="Knowledge">Knowledge</option>
                          <option value="Procedure">Procedure</option>
                          <option value="Reference">Reference</option>
                        </select>
                      </div>
                      <div>
                        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Tags</label>
                        <input
                          v-model="pageTags"
                          type="text"
                          placeholder="sulla, memory, knowledge..."
                          class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                        />
                      </div>
                      <div class="pt-4 space-y-2">
                        <button
                          @click="previewPage"
                          class="w-full rounded-md bg-slate-600 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500"
                        >
                          Preview
                        </button>
                        <button
                          @click="createPage"
                          class="w-full rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
                        >
                          Create Page
                        </button>
                      </div>
                    </div>
                  </li>
                </ul>
              </nav>
            </div>
          </div>

          <div class="max-w-2xl min-w-0 flex-auto px-4 py-16 lg:max-w-none lg:pr-0 lg:pl-8 xl:px-16">
            <article>
              <header class="mb-9 space-y-1">
                <p class="font-display text-sm font-medium text-sky-500">{{ pageCategory || 'Memory' }}</p>
                <h1 class="font-display text-3xl tracking-tight text-slate-900 dark:text-white">
                  {{ pageTitle || 'New KnowledgeBase Page' }}
                </h1>
              </header>
              
              <!-- WYSIWYG Editor Area -->
              <div class="prose max-w-none prose-slate dark:text-slate-400 dark:prose-invert">
                <div class="min-h-[400px] rounded-lg border border-slate-300 dark:border-slate-600">
                  <!-- Editor Toolbar -->
                  <div class="border-b border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 px-3 py-2 flex items-center space-x-2">
                    <button
                      v-for="tool in editorTools"
                      :key="tool.name"
                      @click="applyFormat(tool.command)"
                      :class="[
                        'px-2 py-1 text-sm rounded hover:bg-slate-200 dark:hover:bg-slate-700',
                        tool.active ? 'bg-slate-200 dark:bg-slate-700' : ''
                      ]"
                      :title="tool.title"
                    >
                      {{ tool.icon }}
                    </button>
                  </div>
                  
                  <!-- Editor Content -->
                  <div
                    ref="editorEl"
                    contenteditable="true"
                    @input="onEditorInput"
                    class="p-4 min-h-[350px] focus:outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                    placeholder="Start writing your knowledge base content here..."
                  ></div>
                </div>
              </div>

              <!-- Preview Area (shown when preview is active) -->
              <div v-if="showPreview" class="mt-8">
                <h3 class="text-lg font-semibold text-slate-900 dark:text-white mb-4">Preview</h3>
                <div 
                  class="prose max-w-none prose-slate dark:text-slate-400 dark:prose-invert prose-headings:scroll-mt-28 prose-headings:font-display prose-headings:font-normal lg:prose-headings:scroll-mt-34 prose-lead:text-slate-500 dark:prose-lead:text-slate-400 prose-a:font-semibold dark:prose-a:text-sky-400 dark:[--tw-prose-background:var(--color-slate-900)] prose-a:no-underline prose-a:shadow-[inset_0_-2px_0_0_var(--tw-prose-background,#fff),inset_0_calc(-1*(var(--tw-prose-underline-size,4px)+2px))_0_0_var(--tw-prose-underline,var(--color-sky-300))] prose-a:hover:[--tw-prose-underline-size:6px] dark:prose-a:shadow-[inset_0_calc(-1*var(--tw-prose-underline-size,2px))_0_0_var(--tw-prose-underline,var(--color-sky-800))] dark:prose-a:hover:[--tw-prose-underline-size:6px] prose-pre:rounded-xl prose-pre:bg-slate-900 prose-pre:shadow-lg dark:prose-pre:bg-slate-800/60 dark:prose-pre:shadow-none dark:prose-pre:ring-1 dark:prose-pre:ring-slate-300/10 dark:prose-hr:border-slate-800"
                  v-html="renderedPreview"></div>
              </div>
            </article>
          </div>
          <div
            class="hidden xl:sticky xl:top-19 xl:-mr-6 xl:block xl:h-[calc(100vh-4.75rem)] xl:flex-none xl:overflow-y-auto xl:py-16 xl:pr-6">
            <nav aria-labelledby="on-this-page-title" class="w-56">
              <h2 id="on-this-page-title" class="font-display text-sm font-medium text-slate-900 dark:text-white">
                Writing Tips</h2>
              <ol role="list" class="mt-4 space-y-3 text-sm">
                <li class="text-slate-500 dark:text-slate-400">
                  • Use clear headings to structure your content
                </li>
                <li class="text-slate-500 dark:text-slate-400">
                  • Include code examples with proper formatting
                </li>
                <li class="text-slate-500 dark:text-slate-400">
                  • Add relevant tags for better discoverability
                </li>
                <li class="text-slate-500 dark:text-slate-400">
                  • Write in a clear, concise manner
                </li>
                <li class="text-slate-500 dark:text-slate-400">
                  • Use links to reference other knowledge base pages
                </li>
              </ol>
            </nav>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import AgentHeader from './agent/AgentHeader.vue';
import { computed, onMounted, ref } from 'vue';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

import './assets/AgentKnowledgeBase.css';

const THEME_STORAGE_KEY = 'agentTheme';
const isDark = ref(false);

const splashUrl = new URL('./assets/splash.png', import.meta.url).toString();
const splash2Url = new URL('./assets/splash2.png', import.meta.url).toString();

// Form data
const pageTitle = ref('');
const pageCategory = ref('Memory');
const pageTags = ref('');
const pageContent = ref('');

// Editor state
const editorEl = ref<HTMLElement | null>(null);
const showPreview = ref(false);

// Editor toolbar configuration
const editorTools = ref([
  { name: 'bold', icon: 'B', command: 'bold', title: 'Bold', active: false },
  { name: 'italic', icon: 'I', command: 'italic', title: 'Italic', active: false },
  { name: 'heading', icon: 'H', command: 'formatBlock', value: 'h3', title: 'Heading', active: false },
  { name: 'link', icon: '🔗', command: 'createLink', title: 'Link', active: false },
  { name: 'code', icon: '</>', command: 'formatBlock', value: 'pre', title: 'Code Block', active: false },
  { name: 'list', icon: '•', command: 'insertUnorderedList', title: 'Bullet List', active: false },
  { name: 'numberedlist', icon: '1.', command: 'insertOrderedList', title: 'Numbered List', active: false },
]);

const renderedPreview = computed(() => {
  if (!pageContent.value) {
    return '<p class="text-slate-500">Start writing to see preview...</p>';
  }
  
  const html = marked(pageContent.value) as string;
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|data:image\/(?:png|gif|jpe?g|webp);base64,|\/|\.|#)/i,
  });
});

const onEditorInput = (event: Event) => {
  const target = event.target as HTMLElement;
  pageContent.value = target.innerText || '';
};

const applyFormat = (command: string) => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  
  const range = selection.getRangeAt(0);
  const selectedText = range.toString();
  
  if (command === 'createLink') {
    const url = prompt('Enter URL:');
    if (url) {
      document.execCommand(command, false, url);
    }
  } else if (command === 'formatBlock') {
    const tool = editorTools.value.find(t => t.command === command);
    if (tool?.value) {
      document.execCommand(command, false, tool.value);
    }
  } else {
    document.execCommand(command, false);
  }
  
  // Update content after formatting
  if (editorEl.value) {
    pageContent.value = editorEl.value.innerText || '';
  }
};

const previewPage = () => {
  showPreview.value = !showPreview.value;
};

const createPage = async () => {
  if (!pageTitle.value.trim()) {
    alert('Please enter a page title');
    return;
  }
  
  if (!pageContent.value.trim()) {
    alert('Please enter some content');
    return;
  }
  
  try {
    // Here you would typically save to your backend/service
    console.log('Creating page:', {
      title: pageTitle.value,
      category: pageCategory.value,
      tags: pageTags.value.split(',').map(tag => tag.trim()).filter(tag => tag),
      content: pageContent.value
    });
    
    // Show success message
    alert('Page created successfully!');
    
    // Navigate back to KnowledgeBase
    window.location.href = '/KnowledgeBase';
  } catch (error) {
    console.error('Failed to create page:', error);
    alert('Failed to create page. Please try again.');
  }
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

<style scoped>
/* Editor styles */
[contenteditable]:empty:before {
  content: attr(placeholder);
  color: #94a3b8;
}

/* Prose styles for editor content */
.prose [contenteditable] {
  line-height: 1.75;
}

.prose [contenteditable] h1,
.prose [contenteditable] h2,
.prose [contenteditable] h3 {
  font-weight: 600;
  margin-top: 1.5em;
  margin-bottom: 0.5em;
}

.prose [contenteditable] p {
  margin-bottom: 1em;
}

.prose [contenteditable] pre {
  background-color: #1e293b;
  color: #e2e8f0;
  padding: 1em;
  border-radius: 0.5em;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  overflow-x: auto;
}

.prose [contenteditable] code {
  background-color: #f1f5f9;
  color: #0f172a;
  padding: 0.125em 0.25em;
  border-radius: 0.25em;
  font-size: 0.875em;
}

.dark .prose [contenteditable] code {
  background-color: #334155;
  color: #f1f5f9;
}
</style>
