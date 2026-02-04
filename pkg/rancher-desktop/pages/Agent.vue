<template>
  <div class="h-screen overflow-hidden bg-white text-[#0d0d0d] dark:bg-slate-900 dark:text-neutral-50 font-sans" :class="{ dark: isDark }">
    <div class="flex h-screen flex-col">

      <AgentHeader :is-dark="isDark" :toggle-theme="toggleTheme" />

    <!-- Loading overlay while system boots -->
    <div
      v-if="showOverlay"
      class="fixed inset-0 z-50 flex items-center justify-center bg-white/10 backdrop-blur-sm"
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
    <div ref="chatScrollContainer" id="chat-scroll-container" class="flex min-h-0 flex-1 overflow-y-auto" :class="{ 'blur-sm pointer-events-none select-none': showOverlay }">
      <div class="flex min-h-0 min-w-0 flex-1 flex-col">
        <div v-if="hasMessages" class="relative mx-auto flex w-full max-w-8xl flex-1 justify-center sm:px-2 lg:px-8 xl:px-12">
          <div class="hidden lg:relative lg:block lg:flex-none">
            <div class="absolute inset-y-0 right-0 w-[50vw] bg-slate-50 dark:hidden"></div>
            <div class="absolute top-16 right-0 bottom-0 hidden h-12 w-px bg-linear-to-t from-slate-800 dark:block"></div>
            <div class="absolute top-28 right-0 bottom-0 hidden w-px bg-slate-800 dark:block"></div>
            <div class="sticky top-[5rem] -ml-0.5 h-[calc(100vh-5rem)] w-64 overflow-x-hidden overflow-y-auto py-16 pr-8 pl-0.5 xl:w-72 xl:pr-16"></div>
          </div>

          <div class="max-w-2xl min-w-0 flex-auto px-4 py-16 lg:max-w-none lg:pr-0 lg:pl-8 xl:px-16">
            <div ref="transcriptEl" id="chat-messages-list" class="pb-40">
              <div
                v-for="m in messages"
                :key="m.id"
                class="mb-8"
              >
                <div v-if="m.role === 'user'" class="flex justify-end">
                  <div class="max-w-[min(760px,92%)] rounded-3xl p-6 bg-sky-50 dark:bg-slate-800/60 dark:ring-1 dark:ring-slate-300/10">
                    <div class="whitespace-pre-wrap text-sky-900 dark:text-slate-100">{{ m.content }}</div>
                  </div>
                </div>

                <div v-else-if="m.kind === 'tool'" class="max-w-[min(760px,92%)]">
                  <div v-if="m.toolCard" class="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                    <div class="mb-2 flex items-center gap-2">
                      <span class="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">{{ m.toolCard.toolName }}</span>
                      <span 
                        class="rounded-full px-2 py-0.5 text-xs font-medium"
                        :class="m.toolCard.status === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : m.toolCard.status === 'failed' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'"
                      >
                        {{ m.toolCard.status }}
                      </span>
                    </div>
                    <div v-if="m.toolCard.args && Object.keys(m.toolCard.args).length > 0" class="mb-2">
                      <div class="text-xs font-semibold text-slate-600 dark:text-slate-400">Arguments:</div>
                      <pre class="mt-1 overflow-x-auto rounded bg-slate-100 p-2 text-xs dark:bg-slate-900/50"><code>{{ JSON.stringify(m.toolCard.args, null, 2) }}</code></pre>
                    </div>
                    <div v-if="m.toolCard.result !== undefined" class="mb-2">
                      <div class="text-xs font-semibold text-slate-600 dark:text-slate-400">Result:</div>
                      <pre class="mt-1 overflow-x-auto rounded bg-slate-100 p-2 text-xs dark:bg-slate-900/50"><code>{{ typeof m.toolCard.result === 'string' ? m.toolCard.result : JSON.stringify(m.toolCard.result, null, 2) }}</code></pre>
                    </div>
                    <div v-if="m.toolCard.error" class="text-xs text-red-600 dark:text-red-400">
                      Error: {{ m.toolCard.error }}
                    </div>
                  </div>
                  <pre v-else class="prism-code language-shell"><code><span class="token plain">{{ m.content }}</span>
 </code></pre>
                </div>

                <div v-else class="max-w-[min(760px,92%)]">
                  <div v-if="m.image" class="space-y-2">
                    <img
                      :src="m.image.dataUrl"
                      :alt="m.image.alt || ''"
                      class="block h-auto max-w-full rounded-xl border border-black/10 dark:border-white/10"
                    >
                    <div v-if="m.image.alt" class="text-xs text-[#0d0d0d]/60 dark:text-white/60">
                      {{ m.image.alt }}
                    </div>
                  </div>
                  <div v-else class="prose max-w-none prose-slate dark:text-slate-400 dark:prose-invert" v-html="renderMarkdown(m.content)" />
                </div>
              </div>
              <div
                v-if="loading"
                class="mb-3 flex justify-start"
              >
                <div class="relative max-w-[min(760px,92%)] whitespace-pre-wrap rounded-xl px-4 py-3 text-sm leading-6 text-neutral-900 dark:text-neutral-100">
                  <div class="absolute -inset-px rounded-xl border-2 border-transparent [background:linear-gradient(var(--quick-links-hover-bg,var(--color-sky-50)),var(--quick-links-hover-bg,var(--color-sky-50)))_padding-box,linear-gradient(to_top,var(--color-indigo-400),var(--color-cyan-400),var(--color-sky-500))_border-box] dark:[--quick-links-hover-bg:var(--color-slate-800)]"></div>
                  <div class="relative">Thinking...</div>
                </div>
              </div>
            </div>
          </div>

          <div class="hidden xl:sticky xl:top-0 xl:-mr-6 xl:block xl:h-screen xl:flex-none xl:overflow-y-auto xl:py-16 xl:pr-6">
            <div class="w-72">
              <div v-if="latestChatError" class="my-8 flex rounded-3xl p-6 bg-amber-50 dark:bg-slate-800/60 dark:ring-1 dark:ring-slate-300/10">
                <svg aria-hidden="true" viewBox="0 0 32 32" fill="none" class="h-8 w-8 flex-none [--icon-foreground:var(--color-amber-900)] [--icon-background:var(--color-amber-100)]">
                  <defs>
                    <radialGradient cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" id="_ChatWarn-gradient" gradientTransform="rotate(65.924 1.519 20.92) scale(25.7391)">
                      <stop stop-color="#FDE68A" offset=".08"></stop>
                      <stop stop-color="#F59E0B" offset=".837"></stop>
                    </radialGradient>
                    <radialGradient cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" id="_ChatWarn-gradient-dark" gradientTransform="matrix(0 24.5 -24.5 0 16 5.5)">
                      <stop stop-color="#FDE68A" offset=".08"></stop>
                      <stop stop-color="#F59E0B" offset=".837"></stop>
                    </radialGradient>
                  </defs>
                  <g class="dark:hidden">
                    <circle cx="20" cy="20" r="12" fill="url(#_ChatWarn-gradient)"></circle>
                    <path d="M3 16c0 7.18 5.82 13 13 13s13-5.82 13-13S23.18 3 16 3 3 8.82 3 16Z" fill-opacity="0.5" class="fill-(--icon-background) stroke-(--icon-foreground)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
                    <path d="m15.408 16.509-1.04-5.543a1.66 1.66 0 1 1 3.263 0l-1.039 5.543a.602.602 0 0 1-1.184 0Z" class="fill-(--icon-foreground) stroke-(--icon-foreground)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
                    <path d="M16 23a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" fill-opacity="0.5" stroke="currentColor" class="fill-(--icon-background) stroke-(--icon-foreground)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
                  </g>
                  <g class="hidden dark:inline">
                    <path fill-rule="evenodd" clip-rule="evenodd" d="M2 16C2 8.268 8.268 2 16 2s14 6.268 14 14-6.268 14-14 14S2 23.732 2 16Zm11.386-4.85a2.66 2.66 0 1 1 5.228 0l-1.039 5.543a1.602 1.602 0 0 1-3.15 0l-1.04-5.543ZM16 20a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" fill="url(#_ChatWarn-gradient-dark)"></path>
                  </g>
                </svg>
                <div class="ml-4 flex-auto">
                  <p class="not-prose font-display text-xl text-amber-900 dark:text-amber-500">Oh no! Something bad happened!</p>
                  <div class="prose mt-2.5 text-amber-800 [--tw-prose-underline:var(--color-amber-400)] [--tw-prose-background:var(--color-amber-50)] prose-a:text-amber-900 prose-code:text-amber-900 dark:text-slate-300 dark:[--tw-prose-underline:var(--color-sky-700)] dark:prose-code:text-slate-300">
                    <p>{{ latestChatError }}</p>
                  </div>
                </div>
              </div>

              <nav class="text-base lg:text-sm">
                <div class="mb-3">
                  <h2 class="font-display font-medium text-slate-900 dark:text-white">Goals & plan</h2>
                  <div v-if="activePlanGoal" class="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    {{ activePlanGoal }}
                  </div>
                  <div v-else class="mt-2 text-sm text-slate-500 dark:text-slate-400">No active plan.</div>
                </div>

                <ul role="list" class="mt-2 space-y-2 border-l-2 border-slate-100 lg:mt-4 lg:space-y-4 lg:border-slate-200 dark:border-slate-800">
                  <li v-for="t in activePlanTodos" :key="t.key" class="relative">
                    <div
                      class="block w-full pl-3.5 before:pointer-events-none before:absolute before:top-1/2 before:-left-1 before:h-1.5 before:w-1.5 before:-translate-y-1/2 before:rounded-full"
                      :class="t.status === 'in_progress'
                        ? 'font-semibold text-sky-500 before:bg-sky-500'
                        : t.status === 'done'
                          ? 'text-slate-500 line-through before:bg-slate-300 dark:text-slate-500 dark:before:bg-slate-700'
                          : 'text-slate-500 before:hidden before:bg-slate-300 hover:text-slate-600 hover:before:block dark:text-slate-400 dark:before:bg-slate-700 dark:hover:text-slate-300'"
                    >
                      {{ t.title }}
                      <div class="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{{ t.statusLabel }}</div>
                    </div>
                  </li>
                </ul>
              </nav>
            </div>
          </div>
        </div>

        <div
          :class="hasMessages ? 'fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/80 pt-6 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80' : 'flex flex-1 items-center justify-center bg-white dark:bg-slate-900'"
        >
          <div v-if="hasMessages" class="relative mx-auto flex w-full max-w-8xl justify-center sm:px-2 lg:px-8 xl:px-12">
            <div class="max-w-2xl min-w-0 flex-auto px-4 lg:max-w-none lg:pr-0 lg:pl-8 xl:px-16">
              <div class="pb-3">
                <div class="flex h-full flex-col items-center">
                  <form
                    class="group/composer mx-auto mb-3 w-full"
                    :data-empty="!query.trim()"
                    :data-running="loading"
                    @submit.prevent
                  >
                    <div class="relative overflow-visible rounded-lg bg-white/95 shadow-sm ring-1 ring-slate-200 transition-shadow focus-within:ring-slate-300 dark:bg-slate-800/75 dark:ring-white/5 dark:ring-inset dark:focus-within:ring-white/20">
                      <div class="absolute -top-px right-11 left-20 h-[2px] bg-linear-to-r from-sky-300/0 via-sky-300/70 to-sky-300/0"></div>
                      <div class="absolute right-20 -bottom-px left-11 h-[2px] bg-linear-to-r from-blue-400/0 via-blue-400 to-blue-400/0"></div>
                      <div class="flex flex-wrap items-end gap-1 p-2">
                        <button
                          type="button"
                          class="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#0d0d0d] transition-colors hover:bg-[#f0f0f0] disabled:opacity-60 dark:text-white dark:hover:bg-white/10"
                          aria-label="Attach"
                          :disabled="showOverlay"
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
                          @input="updateComposerLayout"
                          @keydown.enter.exact.prevent="sendOrStop"
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
                              :disabled="showOverlay"
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
                              class="agent-model-selector-menu absolute bottom-12 right-0 z-[9999] w-72 overflow-visible rounded-2xl border border-black/10 bg-white shadow-xl dark:border-white/10 dark:bg-slate-900"
                            >
                            <div class="flex items-center justify-between px-3 py-2">
                              <div class="text-xs font-semibold tracking-wide text-[#0d0d0d]/60 dark:text-white/60">
                                Local
                              </div>
                              <button
                                type="button"
                                class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[#0d0d0d]/60 hover:bg-[#f4f4f4] hover:text-[#0d0d0d] dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white"
                                @click="modelSelector.hideModelMenu"
                                aria-label="Close model selector"
                              >
                                <svg width="12" height="12" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" class="shrink-0">
                                  <path d="M11.7816 4.03157C12.0724 3.74081 12.0724 3.25991 11.7816 2.96915C11.4909 2.67839 11.0099 2.67839 10.7192 2.96915L7.50005 6.18827L4.28091 2.96915C3.99015 2.67839 3.50925 2.67839 3.21849 2.96915C2.92773 3.25991 2.92773 3.74081 3.21849 4.03157L6.43761 7.25071L3.21849 10.4698C2.92773 10.7606 2.92773 11.2415 3.21849 11.5323C3.50925 11.823 3.99015 11.823 4.28091 11.5323L7.50005 8.31315L10.7192 11.5323C11.0099 11.823 11.4909 11.823 11.7816 11.5323C12.0724 11.2415 12.0724 10.7606 11.7816 10.4698L8.56248 7.25071L11.7816 4.03157Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" />
                                </svg>
                              </button>
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
                            <button
                              type="button"
                              class="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0d0d0d] text-white disabled:opacity-60 disabled:cursor-not-allowed dark:bg-white dark:text-[#0d0d0d]"
                              :aria-label="loading ? 'Stop' : (query.trim() ? 'Send' : 'Voice')"
                              :disabled="showOverlay || (!loading && false)"
                              @click="handlePrimaryAction"
                            >
                              <svg v-if="loading" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                <rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" />
                              </svg>
                              <svg v-else-if="query.trim()" width="18" height="18" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                <path d="M7.14645 2.14645C7.34171 1.95118 7.65829 1.95118 7.85355 2.14645L11.8536 6.14645C12.0488 6.34171 12.0488 6.65829 11.8536 6.85355C11.6583 7.04882 11.3417 7.04882 11.1464 6.85355L8 3.70711L8 12.5C8 12.7761 7.77614 13 7.5 13C7.22386 13 7 12.7761 7 12.5L7 3.70711L3.85355 6.85355C3.65829 7.04882 3.34171 7.04882 3.14645 6.85355C2.95118 6.65829 2.95118 6.34171 3.14645 6.14645L7.14645 2.14645Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" />
                              </svg>
                              <svg v-else xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                <path d="M12 19v3" />
                                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                <rect x="9" y="2" width="6" height="13" rx="3" />
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

          <div v-else class="w-full px-4">
            <div class="flex h-full flex-col items-center justify-center">
              <form
                class="group/composer mx-auto mb-3 w-full max-w-3xl"
                :data-empty="!query.trim()"
                :data-running="loading"
                @submit.prevent
              >
                <div class="relative overflow-visible rounded-lg bg-white/95 shadow-sm ring-1 ring-slate-200 transition-shadow focus-within:ring-slate-300 dark:bg-slate-800/75 dark:ring-white/5 dark:ring-inset dark:focus-within:ring-white/20 z-10">
                  <div class="absolute -top-px right-11 left-20 h-[2px] bg-linear-to-r from-sky-300/0 via-sky-300/70 to-sky-300/0"></div>
                  <div class="absolute right-20 -bottom-px left-11 h-[2px] bg-linear-to-r from-blue-400/0 via-blue-400 to-blue-400/0"></div>
                  <div class="flex flex-wrap items-end gap-1 p-2">
                    <button
                      type="button"
                      class="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#0d0d0d] transition-colors hover:bg-[#f0f0f0] disabled:opacity-60 dark:text-white dark:hover:bg-white/10"
                      aria-label="Attach"
                      :disabled="showOverlay"
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
                      @input="updateComposerLayout"
                      @keydown.enter.exact.prevent="sendOrStop"
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
                          :disabled="showOverlay"
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
                          class="agent-model-selector-menu absolute bottom-12 right-0 z-[9999] w-72 overflow-visible rounded-2xl border border-black/10 bg-white shadow-xl dark:border-white/10 dark:bg-slate-900"
                        >
                        <div class="flex items-center justify-between px-3 py-2">
                          <div class="text-xs font-semibold tracking-wide text-[#0d0d0d]/60 dark:text-white/60">
                            Local
                          </div>
                          <button
                            type="button"
                            class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[#0d0d0d]/60 hover:bg-[#f4f4f4] hover:text-[#0d0d0d] dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white"
                            @click="modelSelector.hideModelMenu"
                            aria-label="Close model selector"
                          >
                            <svg width="12" height="12" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" class="shrink-0">
                              <path d="M11.7816 4.03157C12.0724 3.74081 12.0724 3.25991 11.7816 2.96915C11.4909 2.67839 11.0099 2.67839 10.7192 2.96915L7.50005 6.18827L4.28091 2.96915C3.99015 2.67839 3.50925 2.67839 3.21849 2.96915C2.92773 3.25991 2.92773 3.74081 3.21849 4.03157L6.43761 7.25071L3.21849 10.4698C2.92773 10.7606 2.92773 11.2415 3.21849 11.5323C3.50925 11.823 3.99015 11.823 4.28091 11.5323L7.50005 8.31315L10.7192 11.5323C11.0099 11.823 11.4909 11.823 11.7816 11.5323C12.0724 11.2415 12.0724 10.7606 11.7816 10.4698L8.56248 7.25071L11.7816 4.03157Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" />
                            </svg>
                          </button>
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
                        <button
                          type="button"
                          class="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0d0d0d] text-white disabled:opacity-60 disabled:cursor-not-allowed dark:bg-white dark:text-[#0d0d0d]"
                          :aria-label="loading ? 'Stop' : (query.trim() ? 'Send' : 'Voice')"
                          :disabled="showOverlay || (!loading && false)"
                          @click="handlePrimaryAction"
                        >
                          <svg v-if="loading" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                            <rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" />
                          </svg>
                          <svg v-else-if="query.trim()" width="18" height="18" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                            <path d="M7.14645 2.14645C7.34171 1.95118 7.65829 1.95118 7.85355 2.14645L11.8536 6.14645C12.0488 6.34171 12.0488 6.65829 11.8536 6.85355C11.6583 7.04882 11.3417 7.04882 11.1464 6.85355L8 3.70711L8 12.5C8 12.7761 7.77614 13 7.5 13C7.22386 13 7 12.7761 7 12.5L7 3.70711L3.85355 6.85355C3.65829 7.04882 3.34171 7.04882 3.14645 6.85355C2.95118 6.65829 2.95118 6.34171 3.14645 6.14645L7.14645 2.14645Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" />
                          </svg>
                          <svg v-else xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <path d="M12 19v3" />
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                            <rect x="9" y="2" width="6" height="13" rx="3" />
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
import AgentHeader from './agent/AgentHeader.vue';

import { computed, ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useRoute } from 'vue-router';
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
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|data:image\/(?:png|gif|jpe?g|webp);base64,|\/|\.|#)/i,
  });
};

const route = useRoute();

const THEME_STORAGE_KEY = 'agentTheme';
const isDark = ref(false);

const currentThreadId = ref<string | null>(null);

const composerTextareaEl = ref<HTMLTextAreaElement | null>(null);
const isComposerMultiline = ref(false);

let composerMirrorEl: HTMLDivElement | null = null;
let composerMeasureCanvas: HTMLCanvasElement | null = null;

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

  if (!composerMeasureCanvas) {
    composerMeasureCanvas = document.createElement('canvas');
  }
  const ctx = composerMeasureCanvas.getContext('2d');
  const font = style.font ? style.font : `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  if (ctx) {
    ctx.font = font;
  }

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

  const typed = el.value || '';
  const typedWidthPx = ctx ? ctx.measureText(typed).width : 0;
  const earlyMultiline = typedWidthPx > (el.clientWidth * 0.5);

  const multiline = measuredHeight > (singleLineHeight + 1) || typed.includes('\n') || earlyMultiline;
  isComposerMultiline.value = multiline;

  const maxPx = 400;
  if (!multiline) {
    el.style.height = `${singleLineHeight}px`;
    return;
  }

  // Now allow it to expand to fit content (capped).
  el.style.height = 'auto';
  const minMultilineHeight = Math.ceil(singleLineHeight * 2);
  const nextHeight = Math.min(Math.max(el.scrollHeight, minMultilineHeight), maxPx);
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
  showOverlay,
  modelDownloading,
  modelName,
  modelDownloadProgress,
  modelDownloadTotal,
  modelDownloadStatus,
  modelMode,
  progressPercent,
} = startupState;

const startupProgress = new StartupProgressController(startupState);

const settingsController = new AgentSettingsController(
  {
    modelName,
    modelMode,
  },
  updateAgentConfigFull,
);

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

const chatScrollContainer = ref<HTMLElement | null>(null);
const autoScrollEnabled = ref(true);
const autoScrollThreshold = 140; // pixels from bottom to re-enable
let isUserScrolling = false;
let scrollTimeout: NodeJS.Timeout | null = null;

// Track user-initiated scrolling with mouse/touch events
onMounted(() => {
  const container = chatScrollContainer.value;
  if (!container) return;

  // Detect when user starts scrolling
  const startUserScroll = () => {
    isUserScrolling = true;
    console.log('[Auto-Scroll] User scroll detected');
  };

  // Detect when user stops scrolling
  const endUserScroll = () => {
    if (scrollTimeout) clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      isUserScrolling = false;
      console.log('[Auto-Scroll] User scroll ended');
    }, 150);
  };

  // Mouse wheel events
  container.addEventListener('wheel', startUserScroll, { passive: true });
  container.addEventListener('wheel', endUserScroll, { passive: true });

  // Touch events for mobile
  container.addEventListener('touchstart', startUserScroll, { passive: true });
  container.addEventListener('touchend', endUserScroll, { passive: true });

  // Track scroll position changes (only when user is scrolling)
  container.addEventListener('scroll', () => {
    if (!isUserScrolling) return;
    
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    const wasEnabled = autoScrollEnabled.value;
    autoScrollEnabled.value = distanceFromBottom <= autoScrollThreshold;
    
    if (wasEnabled !== autoScrollEnabled.value) {
      console.log('[Auto-Scroll] State changed:', autoScrollEnabled.value ? 'ENABLED' : 'DISABLED', 
                  `(${Math.round(distanceFromBottom)}px from bottom)`);
    }
  }, { passive: true });

  console.log('[Auto-Scroll] User scroll detection attached');
});

// Auto-scroll to bottom when messages change (only if enabled)
watch(() => messages.value.length, async () => {
  await nextTick();
  const container = chatScrollContainer.value;
  if (!container) {
    console.warn('[Auto-Scroll] Container not found');
    return;
  }
  
  if (!autoScrollEnabled.value) {
    console.log('[Auto-Scroll] SKIPPED - user scrolled up, messages count:', messages.value.length);
    return;
  }
  
  console.log('[Auto-Scroll] Scrolling to bottom, messages count:', messages.value.length);
  container.scrollTop = container.scrollHeight; // Instant scroll, no smooth behavior
}, { flush: 'post' });

const latestChatError = computed(() => {
  for (let i = messages.value.length - 1; i >= 0; i--) {
    const m = messages.value[i];
    if (m.role === 'error') {
      return m.content;
    }
  }
  return '';
});

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

  // Connect WebSocket to listen for backend messages
  console.log('[Agent] Connecting WebSocket for chat controller...');
  chatController.connectWebSocket();
});

onUnmounted(() => {
  startupProgress.dispose();
  settingsController.dispose();
  modelSelector.dispose();
  chatController.dispose();
});

const sendOrStop = () => {
  if (loading.value) {
    chatController.stop();
    return;
  }
  chatController.send();
};

const handlePrimaryAction = () => {
  if (loading.value) {
    sendOrStop();
    return;
  }

  if (query.value.trim()) {
    sendOrStop();
    return;
  }

  // Voice mode is a UI affordance for now; actual voice wiring can be added later.
};

watch(query, async () => {
  await nextTick();
  updateComposerLayout();
});

const toggleTheme = () => {
  isDark.value = !isDark.value;
  localStorage.setItem(THEME_STORAGE_KEY, isDark.value ? 'dark' : 'light');
};
</script>

