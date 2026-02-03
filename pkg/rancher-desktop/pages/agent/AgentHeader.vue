<template>
  <header class="sticky top-0 z-50 flex flex-none flex-wrap items-center justify-between bg-white px-4 py-5 shadow-md shadow-slate-900/5 transition duration-500 sm:px-6 lg:px-8 dark:shadow-none dark:bg-slate-900/95 dark:backdrop-blur-sm dark:[@supports(backdrop-filter:blur(0))]:bg-slate-900/75">
    <div class="mr-6 flex lg:hidden">
      <button type="button" class="relative" aria-label="Open navigation">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" class="h-6 w-6 stroke-slate-500">
          <path d="M4 7h16M4 12h16M4 17h16"></path>
        </svg>
      </button>
    </div>
    <div class="relative flex grow basis-0 items-center">
      <a aria-label="Home page" href="/">
        <svg aria-hidden="true" viewBox="0 0 32 33" fill="none" class="h-9 w-9 lg:hidden">
          <g fill="none" stroke="#38BDF8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" transform="translate(0,4)">
            <rect x="8" y="6" width="16" height="20" rx="8" />
            <line x1="16" y1="6" x2="16" y2="1" />
            <circle cx="16" cy="0" r="1.5" fill="#38BDF8" />
            <rect x="11" y="12" width="10" height="4" rx="2" />
            <line x1="12" y1="20" x2="20" y2="20" stroke-width="2.5" />
          </g>
        </svg>
        <svg aria-hidden="true" viewBox="0 0 200 33" class="hidden h-9 w-auto text-slate-900 lg:block dark:text-white">
          <g fill="none" stroke="#38BDF8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" transform="translate(0,4)">
            <rect x="8" y="6" width="16" height="20" rx="8" />
            <line x1="16" y1="6" x2="16" y2="1" />
            <circle cx="16" cy="0" r="1.5" fill="#38BDF8" />
            <rect x="11" y="12" width="10" height="4" rx="2" />
            <line x1="12" y1="20" x2="20" y2="20" stroke-width="2.5" />
          </g>

          <text x="33" y="26" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="currentColor">SULLA</text>
          <text x="33" y="26" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="currentColor" dx="70">DESKTOP</text>
        </svg>
      </a>
    </div>
    <div class="-my-5 mr-6 sm:mr-8 md:mr-0">
      <nav class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-x-6">
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
    </div>
    <div class="relative flex basis-0 justify-end gap-6 sm:gap-8">
      <div class="relative z-10" data-headlessui-state="">
        <label class="sr-only" for="headlessui-listbox-button-_r_a_" id="headlessui-label-_r_9_" data-headlessui-state="">Theme</label>
        <button
          class="flex h-6 w-6 items-center justify-center rounded-lg shadow-md ring-1 shadow-black/5 ring-black/5 dark:bg-slate-700 dark:ring-white/5 dark:ring-inset"
          type="button"
          :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
          @click="toggleTheme"
        >
          <svg v-if="isDark" aria-hidden="true" viewBox="0 0 16 16" class="h-4 w-4 fill-sky-400">
            <path fill-rule="evenodd" clip-rule="evenodd" d="M7 1a1 1 0 0 1 2 0v1a1 1 0 1 1-2 0V1Zm4 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm2.657-5.657a1 1 0 0 0-1.414 0l-.707.707a1 1 0 0 0 1.414 1.414l.707-.707a1 1 0 0 0 0-1.414Zm-1.415 11.313-.707-.707a1 1 0 0 1 1.415-1.415l.707.708a1 1 0 0 1-1.415 1.414ZM16 7.999a1 1 0 0 0-1-1h-1a1 1 0 1 0 0 2h1a1 1 0 0 0 1-1ZM7 14a1 1 0 1 1 2 0v1a1 1 0 1 1-2 0v-1Zm-2.536-2.464a1 1 0 0 0-1.414 0l-.707.707a1 1 0 0 0 1.414 1.414l.707-.707a1 1 0 0 0 0-1.414Zm0-8.486A1 1 0 0 1 3.05 4.464l-.707-.707a1 1 0 0 1 1.414-1.414l.707.707ZM3 8a1 1 0 0 0-1-1H1a1 1 0 0 0 0 2h1a1 1 0 0 0 1-1Z" />
          </svg>
          <svg v-else aria-hidden="true" viewBox="0 0 16 16" class="h-4 w-4 fill-sky-400">
            <path fill-rule="evenodd" clip-rule="evenodd" d="M7.23 3.333C7.757 2.905 7.68 2 7 2a6 6 0 1 0 0 12c.68 0 .758-.905.23-1.332A5.989 5.989 0 0 1 5 8c0-1.885.87-3.568 2.23-4.668ZM12 5a1 1 0 0 1 1 1 1 1 0 0 0 1 1 1 1 0 1 1 0 2 1 1 0 0 0-1 1 1 1 0 1 1-2 0 1 1 0 0 0-1-1 1 1 0 1 1 0-2 1 1 0 0 0 1-1 1 1 0 0 1 1-1Z" />
          </svg>
        </button>
      </div>
      <a class="group" aria-label="GitHub" href="https://github.com/sulla-ai/desktop">
        <svg aria-hidden="true" viewBox="0 0 16 16" class="h-6 w-6 fill-slate-400 group-hover:fill-slate-500 dark:group-hover:fill-slate-300">
          <path d="M8 0C3.58 0 0 3.58 0 8C0 11.54 2.29 14.53 5.47 15.59C5.87 15.66 6.02 15.42 6.02 15.21C6.02 15.02 6.01 14.39 6.01 13.72C4 14.09 3.48 13.23 3.32 12.78C3.23 12.55 2.84 11.84 2.5 11.65C2.22 11.5 1.82 11.13 2.49 11.12C3.12 11.11 3.57 11.7 3.72 11.94C4.44 13.15 5.59 12.81 6.05 12.6C6.12 12.08 6.33 11.73 6.56 11.53C4.78 11.33 2.92 10.64 2.92 7.58C2.92 6.71 3.23 5.99 3.74 5.43C3.66 5.23 3.38 4.41 3.82 3.31C3.82 3.31 4.49 3.1 6.02 4.13C6.66 3.95 7.34 3.86 8.02 3.86C8.7 3.86 9.38 3.95 10.02 4.13C11.55 3.09 12.22 3.31 12.22 3.31C12.66 4.41 12.38 5.23 12.3 5.43C12.81 5.99 13.12 6.7 13.12 7.58C13.12 10.65 11.25 11.33 9.47 11.53C9.76 11.78 10.01 12.26 10.01 13.01C10.01 14.08 10 14.94 10 15.21C10 15.42 10.15 15.67 10.55 15.59C13.71 14.53 16 11.53 16 8C16 3.58 12.42 0 8 0Z"></path>
        </svg>
      </a>
    </div>
  </header>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router';

defineProps<{
  isDark: boolean;
  toggleTheme: () => void;
}>();

const route = useRoute();
</script>
