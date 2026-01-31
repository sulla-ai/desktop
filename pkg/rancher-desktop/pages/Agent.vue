<template>
  <div class="h-screen overflow-hidden bg-white text-[#0d0d0d] dark:bg-neutral-950 dark:text-neutral-50 font-sans" :class="{ dark: isDark }">
    <div class="flex h-screen min-h-0 flex-col">
      <div class="sticky top-0 z-40 border-b border-black/10 bg-white/70 backdrop-blur dark:border-white/10 dark:bg-neutral-950/70">
        <div class="flex items-center justify-between px-4 py-3">
          <div class="text-sm font-semibold tracking-tight text-[#0d0d0d]/80 dark:text-white/80">
            Sulla Desktop by Jonathon Byrdziak
          </div>

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

    <!-- Loading overlay while system boots -->
    <div
      v-if="!systemReady"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
    >
      <div class="w-full max-w-lg rounded-2xl border border-black/10 bg-white/85 p-6 shadow-2xl dark:border-white/10 dark:bg-neutral-900/70">
        <div class="text-4xl leading-none mb-3">
          ⚙️
        </div>
        <h2 class="text-xl font-semibold tracking-tight">Starting Sulla...</h2>
        <p class="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
          {{ progressDescription || 'Initializing system...' }}
        </p>
        
        <!-- Model download progress -->
        <div
          v-if="modelDownloading"
          class="mt-4 rounded-xl border border-black/10 bg-black/5 p-4 dark:border-white/10 dark:bg-white/5"
        >
          <p class="text-sm text-neutral-800 dark:text-neutral-200">
            📦 Downloading: <strong>{{ modelName }}</strong>
          </p>
          <p class="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
            {{ modelDownloadStatus }}
          </p>
          <div
            v-if="modelDownloadTotal > 0"
            class="mt-3 h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10"
          >
            <div
              class="h-full rounded-full bg-gradient-to-r from-indigo-500/90 to-violet-500/90"
              :style="{ width: (modelDownloadProgress / modelDownloadTotal * 100) + '%' }"
            />
          </div>
          <p
            v-if="modelDownloadTotal > 0"
            class="mt-2 font-mono text-[11px] text-neutral-600 dark:text-neutral-400"
          >
            {{ Math.round(modelDownloadProgress / 1024 / 1024) }} MB / {{ Math.round(modelDownloadTotal / 1024 / 1024) }} MB
            ({{ Math.round(modelDownloadProgress / modelDownloadTotal * 100) }}%)
          </p>
        </div>
        
        <!-- K8s progress bar -->
        <div
          v-else-if="progressMax > 0"
          class="mt-4 h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10"
        >
          <div
            class="h-full rounded-full bg-black/30 dark:bg-white/30"
            :style="{ width: progressPercent + '%' }"
          />
        </div>
        <div
          v-else
          class="mt-4 h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10"
        >
          <div class="h-full w-1/3 animate-pulse rounded-full bg-black/25 dark:bg-white/25" />
        </div>
      </div>
    </div>

    <!-- Main agent interface -->
    <div class="flex min-h-0 flex-1 overflow-hidden" :class="{ 'blur-sm pointer-events-none select-none': !systemReady }">
      <div
        v-if="hasMessages"
        class="hidden w-72 shrink-0 overflow-y-auto border-r border-black/10 bg-black/2 px-4 py-6 dark:border-white/10 dark:bg-white/5 md:block"
      >
        <div v-if="activePlanGoal" class="mb-3">
          <div class="text-xs font-semibold tracking-wide text-[#0d0d0d]/60 dark:text-white/60">Goal</div>
          <div class="mt-1 text-sm font-semibold text-[#0d0d0d] dark:text-white">{{ activePlanGoal }}</div>
        </div>

        <div v-else class="mb-3 text-sm text-[#0d0d0d]/60 dark:text-white/60">
          No active plan
        </div>

        <div class="space-y-1">
          <div
            v-for="t in activePlanTodos"
            :key="t.key"
            class="group flex items-start gap-2 rounded-xl px-2 py-2"
            :class="t.status === 'in_progress' ? 'bg-black/5 dark:bg-white/10' : t.status === 'done' ? 'opacity-70' : 'hover:bg-black/5 dark:hover:bg-white/10'"
          >
            <span
              class="mt-1.5 h-2 w-2 shrink-0 rounded-full"
              :class="t.status === 'done' ? 'bg-emerald-500' : t.status === 'in_progress' ? 'bg-amber-500' : t.status === 'blocked' ? 'bg-red-500' : 'bg-neutral-400/70 dark:bg-neutral-500/70'"
            />

            <div
              v-if="t.status === 'done'"
              class="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border border-emerald-500/40 bg-emerald-500/15"
            >
              <svg width="12" height="12" viewBox="0 0 20 20" fill="none" class="text-emerald-700 dark:text-emerald-200" aria-hidden="true">
                <path d="M16.5 5.5L8.25 13.75L3.5 9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </div>
            <button
              v-else
              type="button"
              class="mt-0.5 h-4 w-4 shrink-0 rounded border border-black/20 bg-white dark:border-white/20 dark:bg-neutral-950"
            />

            <div class="min-w-0 flex-1">
              <div
                class="whitespace-normal break-words text-xs font-normal"
                :class="t.status === 'done' ? 'line-through text-[#0d0d0d]/70 dark:text-white/70' : 'text-[#0d0d0d] dark:text-white'"
              >
                {{ t.title }}
              </div>
              <div class="mt-0.5 whitespace-normal break-words text-xs text-[#0d0d0d]/60 dark:text-white/60">
                {{ t.statusLabel }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div
          v-if="hasMessages"
          ref="transcriptEl"
          class="flex-1 overflow-y-auto px-6 py-6"
        >
          <div
            v-for="m in messages"
            :key="m.id"
            class="mb-3 flex"
            :class="m.role === 'user' ? 'justify-end' : 'justify-start'"
          >
            <div
              v-if="m.role === 'system'"
              class="max-w-[min(760px,92%)] rounded-2xl px-4 py-3 text-xs leading-5 border"
              :class="m.kind === 'tool'
                ? 'bg-blue-500/10 border-blue-500/20 text-[#0d0d0d] dark:bg-blue-500/10 dark:border-blue-400/20 dark:text-neutral-50'
                : m.kind === 'planner'
                  ? 'bg-purple-500/10 border-purple-500/20 text-[#0d0d0d] dark:bg-purple-500/10 dark:border-purple-400/20 dark:text-neutral-50'
                  : m.kind === 'critic'
                    ? 'bg-amber-500/10 border-amber-500/20 text-[#0d0d0d] dark:bg-amber-500/10 dark:border-amber-400/20 dark:text-neutral-50'
                    : 'bg-black/3 border-black/10 text-neutral-900 dark:bg-white/5 dark:border-white/10 dark:text-neutral-100'"
            >
              <div v-if="m.image" class="space-y-2">
                <img
                  :src="m.image.dataUrl"
                  :alt="m.image.alt || ''"
                  class="block h-auto max-w-full rounded-xl border border-black/10 dark:border-white/10"
                >
                <div v-if="m.image.alt" class="text-[11px] text-[#0d0d0d]/60 dark:text-white/60">
                  {{ m.image.alt }}
                </div>
              </div>
              <div v-if="m.kind === 'tool' && m.toolCard" class="space-y-2">
                <div class="flex items-center justify-between gap-3">
                  <div class="min-w-0 flex items-center gap-2">
                    <span
                      class="h-2.5 w-2.5 shrink-0 rounded-full"
                      :class="m.toolCard.status === 'running'
                        ? 'bg-amber-500'
                        : m.toolCard.status === 'success'
                          ? 'bg-emerald-500'
                          : 'bg-red-500'"
                    />
                    <div class="min-w-0 truncate font-semibold">{{ m.toolCard.toolName }}</div>
                  </div>
                  <div class="shrink-0 text-[11px] text-[#0d0d0d]/60 dark:text-white/60">
                    {{ m.toolCard.status }}
                  </div>
                </div>

                <details class="rounded-xl border border-black/10 bg-white/50 px-3 py-2 dark:border-white/10 dark:bg-neutral-950/40">
                  <summary class="cursor-pointer select-none text-[11px] font-semibold text-[#0d0d0d]/70 dark:text-white/70">Details</summary>
                  <div class="mt-2 space-y-2">
                    <div v-if="m.toolCard.args" class="space-y-1">
                      <div class="text-[11px] font-semibold text-[#0d0d0d]/60 dark:text-white/60">Args</div>
                      <pre class="whitespace-pre-wrap rounded-lg bg-black/5 px-2 py-1 text-[11px] leading-4 dark:bg-white/10">{{ JSON.stringify(m.toolCard.args, null, 2) }}</pre>
                    </div>
                    <div v-if="m.toolCard.result !== undefined" class="space-y-1">
                      <div class="text-[11px] font-semibold text-[#0d0d0d]/60 dark:text-white/60">Result</div>
                      <pre class="whitespace-pre-wrap rounded-lg bg-black/5 px-2 py-1 text-[11px] leading-4 dark:bg-white/10">{{ JSON.stringify(m.toolCard.result, null, 2) }}</pre>
                    </div>
                    <div v-if="m.toolCard.error" class="space-y-1">
                      <div class="text-[11px] font-semibold text-red-700 dark:text-red-300">Error</div>
                      <pre class="whitespace-pre-wrap rounded-lg bg-red-500/10 px-2 py-1 text-[11px] leading-4 text-red-800 dark:text-red-200">{{ m.toolCard.error }}</pre>
                    </div>
                  </div>
                </details>
              </div>
              <div v-else-if="m.kind === 'tool'" class="whitespace-pre-wrap">{{ m.content }}</div>
              <div v-else class="prose prose-sm dark:prose-invert max-w-none" v-html="renderMarkdown(m.content)" />
            </div>

            <div
              v-else
              class="max-w-[min(760px,92%)] rounded-2xl px-4 py-3 text-sm leading-6 border"
              :class="m.role === 'user'
                ? 'bg-black/5 border-black/10 text-[#0d0d0d] dark:bg-white/10 dark:border-white/10 dark:text-neutral-50'
                : 'bg-black/3 border-black/10 text-neutral-900 dark:bg-white/5 dark:border-white/10 dark:text-neutral-100'"
            >
              <div v-if="m.role === 'user'" class="whitespace-pre-wrap">{{ m.content }}</div>
              <div v-else-if="m.image" class="space-y-2">
                <img
                  :src="m.image.dataUrl"
                  :alt="m.image.alt || ''"
                  class="block h-auto max-w-full rounded-xl border border-black/10 dark:border-white/10"
                >
                <div v-if="m.image.alt" class="text-xs text-[#0d0d0d]/60 dark:text-white/60">
                  {{ m.image.alt }}
                </div>
              </div>
              <div v-else class="prose prose-sm dark:prose-invert max-w-none" v-html="renderMarkdown(m.content)" />
            </div>
          </div>
          <div
            v-if="loading"
            class="mb-3 flex justify-start"
          >
            <div class="max-w-[min(760px,92%)] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 bg-black/3 border border-black/10 text-neutral-900 dark:bg-white/5 dark:border-white/10 dark:text-neutral-100">
              Thinking...
            </div>
          </div>
        </div>

        <div
          :class="hasMessages ? 'sticky bottom-0 border-t border-black/10 bg-white/75 backdrop-blur dark:border-white/10 dark:bg-neutral-950/80' : 'flex flex-1 items-center justify-center bg-white dark:bg-neutral-950'"
        >
          <div class="w-full px-4" :class="hasMessages ? 'py-3' : ''">
            <div
              class="flex h-full flex-col items-center"
              :class="hasMessages ? '' : 'justify-center'"
            >
            <form
              class="group/composer mx-auto mb-3 w-full max-w-3xl"
              :data-empty="!query.trim()"
              :data-running="loading"
              @submit.prevent
            >
              <div class="overflow-visible rounded-[32px] bg-[#f8f8f8] shadow-sm ring-1 ring-[#e5e5e5] ring-inset transition-shadow focus-within:ring-[#d0d0d0] dark:bg-neutral-900/70 dark:ring-white/10 dark:focus-within:ring-white/20">
                <div class="flex flex-wrap items-end gap-1 p-2">
                  <button
                    type="button"
                    class="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#0d0d0d] transition-colors hover:bg-[#f0f0f0] disabled:opacity-60 dark:text-white dark:hover:bg-white/10"
                    aria-label="Attach"
                    :disabled="!systemReady"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <path d="m16 6-8.414 8.586a2 2 0 0 0 2.829 2.829l8.414-8.586a4 4 0 1 0-5.657-5.657l-8.379 8.551a6 6 0 1 0 8.485 8.485l8.379-8.551" />
                    </svg>
                  </button>

                  <textarea
                    ref="composerTextareaEl"
                    v-model="query"
                    name="input"
                    placeholder="What do you want to know?"
                    class="my-2 h-6 max-h-[400px] min-w-0 flex-1 resize-none bg-transparent text-[#0d0d0d] text-base leading-6 outline-none placeholder:text-[#9a9a9a] dark:text-white dark:placeholder:text-neutral-500"
                    :class="isComposerMultiline ? 'basis-full order-2' : 'order-2'"
                    :disabled="!systemReady"
                    @input="updateComposerLayout"
                    @keydown.enter.exact.prevent="send"
                  />

                  <div
                    class="mb-0.5 flex items-center gap-2"
                    :class="isComposerMultiline ? 'order-3 w-full justify-between' : 'order-3'"
                  >
                    <div class="relative mb-0.5" ref="modelSelector.modelMenuEl">
                      <button
                        type="button"
                        class="flex h-9 shrink-0 items-center gap-2 rounded-full px-2.5 text-[#0d0d0d] hover:bg-[#f0f0f0] disabled:opacity-60 dark:text-white dark:hover:bg-white/10"
                        aria-label="Model select"
                        :disabled="!systemReady"
                        @click="modelSelector.toggleModelMenu"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0" aria-hidden="true">
                          <path d="M12 8V4" />
                          <path d="M8 4h8" />
                          <rect x="6" y="8" width="12" height="10" rx="2" />
                          <path d="M9 18v2" />
                          <path d="M15 18v2" />
                          <path d="M9.5 12h.01" />
                          <path d="M14.5 12h.01" />
                          <path d="M10 15h4" />
                        </svg>
                        <div class="flex items-center gap-1 overflow-hidden">
                          <span class="whitespace-nowrap font-semibold text-sm">{{ modelSelector.activeModelLabelValue }}</span>
                          <svg width="16" height="16" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" class="shrink-0" aria-hidden="true">
                            <path d="M3.13523 6.15803C3.3241 5.95657 3.64052 5.94637 3.84197 6.13523L7.5 9.56464L11.158 6.13523C11.3595 5.94637 11.6759 5.95657 11.8648 6.15803C12.0536 6.35949 12.0434 6.67591 11.842 6.86477L7.84197 10.6148C7.64964 10.7951 7.35036 10.7951 7.15803 10.6148L3.15803 6.86477C2.95657 6.67591 2.94637 6.35949 3.13523 6.15803Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" />
                          </svg>
                        </div>
                      </button>

                      <div
                        v-if="modelSelector.showModelMenuValue"
                        class="agent-model-selector-menu absolute bottom-12 right-0 z-50 w-72 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-xl dark:border-white/10 dark:bg-neutral-950"
                      >
                      <div class="px-3 py-2 text-xs font-semibold tracking-wide text-[#0d0d0d]/60 dark:text-white/60">
                        Local
                      </div>

                      <div v-if="modelSelector.loadingLocalModelsValue" class="px-3 py-2 text-sm text-[#0d0d0d]/70 dark:text-white/70">
                        Loading...
                      </div>
                      <button
                        v-for="m in modelSelector.localModelOptionsValue"
                        :key="m.value"
                        type="button"
                        class="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-[#0d0d0d] hover:bg-[#f4f4f4] dark:text-white dark:hover:bg-white/10"
                        @click="modelSelector.selectModel(m)"
                      >
                        <span class="min-w-0 flex-1 truncate">{{ m.label }}</span>
                        <span v-if="m.isActive" class="shrink-0 text-xs font-semibold text-[#0d0d0d]/60 dark:text-white/60">Active</span>
                      </button>

                      <div class="border-t border-black/10 dark:border-white/10" />

                      <div class="px-3 py-2 text-xs font-semibold tracking-wide text-[#0d0d0d]/60 dark:text-white/60">
                        Remote
                      </div>
                      <div v-if="!modelSelector.remoteOptionValue" class="px-3 py-2 text-sm text-[#0d0d0d]/70 dark:text-white/70">
                        No validated remote provider
                      </div>
                      <button
                        v-else
                        type="button"
                        class="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-[#0d0d0d] hover:bg-[#f4f4f4] dark:text-white dark:hover:bg-white/10"
                        @click="modelSelector.remoteOptionValue && modelSelector.selectModel(modelSelector.remoteOptionValue)"
                      >
                        <span class="min-w-0 flex-1 truncate">{{ modelSelector.remoteOptionValue?.label }}</span>
                        <span v-if="modelSelector.remoteOptionValue?.isActive" class="shrink-0 text-xs font-semibold text-[#0d0d0d]/60 dark:text-white/60">Active</span>
                      </button>
                      </div>
                    </div>

                    <div class="flex items-center gap-2">
                      <div class="relative h-9 w-9 shrink-0 rounded-full bg-[#0d0d0d] text-white dark:bg-white dark:text-[#0d0d0d]">
                        <button
                          type="button"
                          class="absolute inset-0 flex items-center justify-center"
                          aria-label="Voice mode"
                          :disabled="!systemReady"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <path d="M12 19v3" />
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                            <rect x="9" y="2" width="6" height="13" rx="3" />
                          </svg>
                        </button>
                      </div>

                      <button
                        type="button"
                        class="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0d0d0d] text-white disabled:opacity-60 disabled:cursor-not-allowed dark:bg-white dark:text-[#0d0d0d]"
                        aria-label="Submit"
                        :disabled="!systemReady || !query.trim()"
                        @click="send"
                      >
                        <svg width="18" height="18" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                          <path d="M7.14645 2.14645C7.34171 1.95118 7.65829 1.95118 7.85355 2.14645L11.8536 6.14645C12.0488 6.34171 12.0488 6.65829 11.8536 6.85355C11.6583 7.04882 11.3417 7.04882 11.1464 6.85355L8 3.70711L8 12.5C8 12.7761 7.77614 13 7.5 13C7.22386 13 7 12.7761 7 12.5L7 3.70711L3.85355 6.85355C3.65829 7.04882 3.34171 7.04882 3.14645 6.85355C2.95118 6.65829 2.95118 6.34171 3.14645 6.14645L7.14645 2.14645Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
      </div>
    </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import {
  getSensory,
  getContextDetector,
  getThread,
  getResponseHandler,
} from '@pkg/agent';
import type { AgentResponse } from '@pkg/agent/types';
import { updateAgentConfigFull } from '@pkg/agent/services/ConfigService';
import { StartupProgressController } from './agent/StartupProgressController';
import { AgentSettingsController } from './agent/AgentSettingsController';
import { AgentChatController } from './agent/AgentChatController';
import { AgentModelSelectorController } from './agent/AgentModelSelectorController';
import './agent/AgentModelSelector.css';

const renderMarkdown = (markdown: string): string => {
  const raw = typeof markdown === 'string' ? markdown : String(markdown || '');
  const html = (marked(raw) as string) || '';
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
};

const THEME_STORAGE_KEY = 'agentTheme';
const isDark = ref(false);

const currentThreadId = ref<string | null>(null);

const composerTextareaEl = ref<HTMLTextAreaElement | null>(null);
const isComposerMultiline = ref(false);

let composerMirrorEl: HTMLDivElement | null = null;

function getComposerMirrorEl(): HTMLDivElement {
  if (composerMirrorEl) {
    return composerMirrorEl;
  }
  const el = document.createElement('div');
  el.style.position = 'fixed';
  el.style.left = '-99999px';
  el.style.top = '0';
  el.style.visibility = 'hidden';
  el.style.whiteSpace = 'pre-wrap';
  el.style.wordBreak = 'break-word';
  el.style.overflowWrap = 'break-word';
  el.style.pointerEvents = 'none';
  document.body.appendChild(el);
  composerMirrorEl = el;
  return el;
}

function updateComposerLayout(): void {
  const el = composerTextareaEl.value;
  if (!el) {
    return;
  }

  const style = window.getComputedStyle(el);
  const lineHeight = Number.parseFloat(style.lineHeight || '24');
  const paddingTop = Number.parseFloat(style.paddingTop || '0');
  const paddingBottom = Number.parseFloat(style.paddingBottom || '0');
  const singleLineHeight = Math.ceil(lineHeight + paddingTop + paddingBottom);

  const mirror = getComposerMirrorEl();
  mirror.style.boxSizing = style.boxSizing;
  mirror.style.fontFamily = style.fontFamily;
  mirror.style.fontSize = style.fontSize;
  mirror.style.fontWeight = style.fontWeight;
  mirror.style.fontStyle = style.fontStyle;
  mirror.style.letterSpacing = style.letterSpacing;
  mirror.style.textTransform = style.textTransform;
  mirror.style.lineHeight = style.lineHeight;
  mirror.style.padding = style.padding;
  mirror.style.border = style.border;
  mirror.style.width = `${el.clientWidth}px`;

  // Add a trailing newline to ensure the last line's height is counted accurately.
  mirror.textContent = `${el.value || ''}\n`;
  const measuredHeight = mirror.scrollHeight;

  const multiline = measuredHeight > (singleLineHeight + 1) || el.value.includes('\n');
  isComposerMultiline.value = multiline;

  const maxPx = 400;
  if (!multiline) {
    el.style.height = `${singleLineHeight}px`;
    return;
  }

  // Now allow it to expand to fit content (capped).
  el.style.height = 'auto';
  const nextHeight = Math.min(el.scrollHeight, maxPx);
  el.style.height = `${nextHeight}px`;
}

// Initialize agent components
const sensory = getSensory();
const contextDetector = getContextDetector();
const responseHandler = getResponseHandler();

const startupState = StartupProgressController.createState();
const {
  systemReady,
  progressCurrent,
  progressMax,
  progressDescription,
  startupPhase,
  modelDownloading,
  modelName,
  modelDownloadProgress,
  modelDownloadTotal,
  modelDownloadStatus,
  modelMode,
  progressPercent,
} = startupState;

// Ollama memory error recovery
const ollamaRestarting = ref(false);
const memoryErrorCount = ref(0);
const MAX_MEMORY_ERROR_RETRIES = 3;

const startupProgress = new StartupProgressController(startupState);

const settingsController = new AgentSettingsController(
  {
    modelName,
    modelMode,
  },
  updateAgentConfigFull,
);

startupProgress.setMemoryErrorRefs({
  ollamaRestarting,
  memoryErrorCount,
  maxRetries: MAX_MEMORY_ERROR_RETRIES,
});

type SidebarTodoStatus = 'pending' | 'in_progress' | 'done' | 'blocked';
type SidebarTodo = {
  key: string;
  title: string;
  status: SidebarTodoStatus;
  statusLabel: string;
};

const activePlanId = ref<number | null>(null);
const activePlanGoal = ref<string | null>(null);

const planTodoOrder = ref<number[]>([]);
const planTodoStateByKey = ref<Record<number, { title: string; status: SidebarTodoStatus; orderIndex: number }>>({});

function makeStatusLabel(status: SidebarTodoStatus): string {
  switch (status) {
  case 'in_progress':
    return 'In progress';
  case 'done':
    return 'Completed';
  case 'blocked':
    return 'Blocked';
  default:
    return 'Pending';
  }
}

const activePlanTodos = computed<SidebarTodo[]>(() => {
  return planTodoOrder.value
    .map((key) => {
      const entry = planTodoStateByKey.value[key];
      if (!entry) {
        return null;
      }

      return {
        key: String(key),
        title: entry.title,
        status: entry.status,
        statusLabel: makeStatusLabel(entry.status),
      };
    })
    .filter((x): x is SidebarTodo => !!x);
});

function resetPlanFromTitles(titles: string[], nextPlanId: number | null, goal: string | null) {
  activePlanId.value = nextPlanId;
  activePlanGoal.value = goal;
  const ids = titles.map((_, idx) => idx + 1);
  planTodoOrder.value = ids;
  planTodoStateByKey.value = ids.reduce<Record<number, { title: string; status: SidebarTodoStatus; orderIndex: number }>>((acc, id, idx) => {
    acc[id] = { title: titles[idx], status: 'pending', orderIndex: idx };
    return acc;
  }, {});
}

function normalizeStatus(status: string): SidebarTodoStatus {
  if (status === 'in_progress' || status === 'done' || status === 'blocked') {
    return status;
  }
  return 'pending';
}

function sortTodoOrder() {
  planTodoOrder.value = [...planTodoOrder.value].sort((a, b) => {
    const ea = planTodoStateByKey.value[a];
    const eb = planTodoStateByKey.value[b];
    const ia = ea ? ea.orderIndex : 0;
    const ib = eb ? eb.orderIndex : 0;
    return ia - ib;
  });
}

function resetPlanFromStreaming(planId: number | null, goal: string | null) {
  activePlanId.value = planId;
  activePlanGoal.value = goal;
  planTodoOrder.value = [];
  planTodoStateByKey.value = {};
}

function upsertTodoFromStreaming(params: { planId: number; todoId: number; title?: string; orderIndex?: number; status?: string }) {
  if (activePlanId.value !== params.planId) {
    return;
  }
  const todoId = params.todoId;
  const existing = planTodoStateByKey.value[todoId];
  const nextTitle = typeof params.title === 'string' && params.title ? params.title : existing?.title || '';
  const nextOrderIndex = Number.isFinite(Number(params.orderIndex)) ? Number(params.orderIndex) : (existing?.orderIndex ?? planTodoOrder.value.length);
  const nextStatus = params.status ? normalizeStatus(params.status) : (existing?.status ?? 'pending');

  if (!existing) {
    planTodoOrder.value = [...planTodoOrder.value, todoId];
  }
  planTodoStateByKey.value = {
    ...planTodoStateByKey.value,
    [todoId]: { title: nextTitle, status: nextStatus, orderIndex: nextOrderIndex },
  };
  sortTodoOrder();
}

function deleteTodoFromStreaming(params: { planId: number; todoId: number }) {
  if (activePlanId.value !== params.planId) {
    return;
  }
  const todoId = params.todoId;
  const next = { ...planTodoStateByKey.value };
  delete next[todoId];
  planTodoStateByKey.value = next;
  planTodoOrder.value = planTodoOrder.value.filter(id => id !== todoId);
}

function upsertTodoStatusByTitle(title: string, status: SidebarTodoStatus) {
  if (!title) {
    return;
  }
  // Snapshot fallback uses title-keys; to avoid mixing key types, ignore if streaming is active.
  if (activePlanId.value !== null && planTodoOrder.value.some(id => Number.isFinite(Number(id)))) {
    return;
  }
}

const onAgentResponse = (resp: AgentResponse) => {
  const metadata = (resp?.metadata || {}) as Record<string, any>;
  const nextPlanId = typeof metadata.activePlanId === 'number' ? metadata.activePlanId : null;

  const hasStreamingTodos = planTodoOrder.value.length > 0;
  if (hasStreamingTodos) {
    return;
  }

  const fullPlan = metadata.plan?.fullPlan;
  const goal = typeof fullPlan?.goal === 'string' ? fullPlan.goal : null;
  const todosFromFullPlan = Array.isArray(fullPlan?.todos)
    ? fullPlan.todos
        .map((t: any) => (typeof t?.title === 'string' ? t.title : null))
        .filter((t: string | null): t is string => !!t)
    : null;

  const titles = (todosFromFullPlan && todosFromFullPlan.length > 0)
    ? todosFromFullPlan
    : (Array.isArray(metadata.plan?.todos) ? metadata.plan.todos.filter((t: any) => typeof t === 'string') : []);

  if (goal && titles.length > 0) {
    if (activePlanId.value !== nextPlanId || activePlanGoal.value !== goal || planTodoOrder.value.length === 0) {
      resetPlanFromTitles(titles, nextPlanId, goal);
    } else {
      // Keep ordering in sync if planner revised the todo list.
      resetPlanFromTitles(titles, nextPlanId, goal);
    }
  }

  const activeTodoTitle = typeof metadata.activeTodo?.title === 'string' ? metadata.activeTodo.title : null;
  if (activeTodoTitle) {
    upsertTodoStatusByTitle(activeTodoTitle, 'in_progress');
  }

  // When the executor reports completion/progress, apply it to the current active todo.
  const executionStatus = metadata.todoExecution?.status as SidebarTodoStatus | undefined;
  if (activeTodoTitle && executionStatus && (executionStatus === 'done' || executionStatus === 'blocked' || executionStatus === 'in_progress')) {
    upsertTodoStatusByTitle(activeTodoTitle, executionStatus);
  }
};

const onAgentEvent = (event: { type: string; threadId: string; data: any; timestamp: number }) => {
  if (event.type !== 'progress') {
    return;
  }
  const phase = event.data?.phase;
  if (!phase) {
    return;
  }

  if (phase === 'plan_created') {
    const planId = Number(event.data.planId);
    const goal = typeof event.data.goal === 'string' ? event.data.goal : null;
    if (Number.isFinite(planId)) {
      resetPlanFromStreaming(planId, goal);
    }
    return;
  }

  if (phase === 'plan_revised') {
    const planId = Number(event.data.planId);
    const goal = typeof event.data.goal === 'string' ? event.data.goal : null;
    if (Number.isFinite(planId)) {
      if (activePlanId.value !== planId) {
        resetPlanFromStreaming(planId, goal);
      } else {
        activePlanGoal.value = goal;
      }
    }
    return;
  }

  if (phase === 'todo_created') {
    const planId = Number(event.data.planId);
    const todoId = Number(event.data.todoId);
    const title = typeof event.data.title === 'string' ? event.data.title : '';
    const orderIndex = event.data.orderIndex !== undefined ? Number(event.data.orderIndex) : undefined;
    const status = typeof event.data.status === 'string' ? event.data.status : 'pending';
    if (Number.isFinite(planId) && Number.isFinite(todoId)) {
      if (activePlanId.value !== planId) {
        resetPlanFromStreaming(planId, activePlanGoal.value);
      }
      upsertTodoFromStreaming({ planId, todoId, title, orderIndex, status });
    }
    return;
  }

  if (phase === 'todo_updated') {
    const planId = Number(event.data.planId);
    const todoId = Number(event.data.todoId);
    const title = typeof event.data.title === 'string' ? event.data.title : '';
    const orderIndex = event.data.orderIndex !== undefined ? Number(event.data.orderIndex) : undefined;
    const status = typeof event.data.status === 'string' ? event.data.status : undefined;
    if (Number.isFinite(planId) && Number.isFinite(todoId)) {
      if (activePlanId.value !== planId) {
        resetPlanFromStreaming(planId, activePlanGoal.value);
      }
      upsertTodoFromStreaming({ planId, todoId, title, orderIndex, status });
    }
    return;
  }

  if (phase === 'todo_deleted') {
    const planId = Number(event.data.planId);
    const todoId = Number(event.data.todoId);
    if (Number.isFinite(planId) && Number.isFinite(todoId)) {
      if (activePlanId.value !== planId) {
        resetPlanFromStreaming(planId, activePlanGoal.value);
      }
      deleteTodoFromStreaming({ planId, todoId });
    }
    return;
  }

  if (phase === 'todo_status') {
    const planId = Number(event.data.planId);
    const todoId = Number(event.data.todoId);
    const title = typeof event.data.title === 'string' ? event.data.title : undefined;
    const status = typeof event.data.status === 'string' ? event.data.status : undefined;
    if (Number.isFinite(planId) && Number.isFinite(todoId) && status) {
      if (activePlanId.value !== planId) {
        resetPlanFromStreaming(planId, activePlanGoal.value);
      }
      upsertTodoFromStreaming({ planId, todoId, title, status });
    }
  }
};

const chatController = new AgentChatController({
  systemReady,
  currentThreadId,
  sensory,
  contextDetector,
  getThread,
  responseHandler,
  onAgentResponse,
  onAgentEvent,
  startupProgress,
});

const {
  query,
  loading,
  messages,
  transcriptEl,
  hasMessages,
} = chatController;

const modelSelector = new AgentModelSelectorController({
  systemReady,
  loading,
  modelName,
  modelMode,
});

onMounted(async () => {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);

  if (stored === 'dark') {
    isDark.value = true;
  } else if (stored === 'light') {
    isDark.value = false;
  } else {
    isDark.value = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  }

  startupProgress.start();

  settingsController.start();

  await modelSelector.start();

  await startupProgress.initializeFromBackend();
});

onUnmounted(() => {
  startupProgress.dispose();
  settingsController.dispose();
  modelSelector.dispose();
});

const send = () => chatController.send();

watch(query, async () => {
  await nextTick();
  updateComposerLayout();
});

const toggleTheme = () => {
  isDark.value = !isDark.value;
  localStorage.setItem(THEME_STORAGE_KEY, isDark.value ? 'dark' : 'light');
};
</script>

