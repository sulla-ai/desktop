<template>
  <div class="min-h-screen bg-white text-sm text-[#0d0d0d] dark:bg-slate-900 dark:text-neutral-50 font-sans" :class="{ dark: isDark }">
    <div class="flex min-h-screen flex-col">
      <AgentHeader :is-dark="isDark" :toggle-theme="toggleTheme" />

      <div class="flex-1 overflow-auto">
        <div class="mx-auto max-w-6xl px-4 py-8">
          <!-- Back button -->
          <button
            @click="$router.push('/Integrations')"
            class="mb-6 flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
            Back to Integrations
          </button>

          <div v-if="integration" class="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <!-- Main Content -->
            <div class="lg:col-span-2 space-y-8">
              <!-- Media -->
              <div v-if="integration.media && integration.media.length > 0" class="space-y-4">
                <div class="relative">
                  <!-- Carousel Container -->
                  <div class="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                    <div class="relative">
                      <!-- Main Media -->
                      <div class="aspect-video">
                        <!-- YouTube Video -->
                        <YouTubePlayer
                          v-if="integration.media[currentImageIndex].type === 'youtube'"
                          :video-id="integration.media[currentImageIndex].url"
                          :title="integration.media[currentImageIndex].alt"
                          :alt="integration.media[currentImageIndex].alt"
                        />
                        <!-- Image -->
                        <img
                          v-else
                          :src="integration.media[currentImageIndex].url.startsWith('http') ? integration.media[currentImageIndex].url : require(`@pkg/assets/images/${integration.media[currentImageIndex].url}`)"
                          :alt="integration.media[currentImageIndex].alt"
                          class="h-full w-full object-cover"
                        >
                        <div v-if="integration.media[currentImageIndex].caption" class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                          <p class="text-sm text-white">{{ integration.media[currentImageIndex].caption }}</p>
                        </div>
                      </div>
                      
                      <!-- Navigation Arrows -->
                      <button
                        v-if="integration.media.length > 1"
                        @click="previousImage"
                        class="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 transition-colors"
                      >
                        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <button
                        v-if="integration.media.length > 1"
                        @click="nextImage"
                        class="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 transition-colors"
                      >
                        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  
                  <!-- Thumbnail Navigation -->
                  <div v-if="integration.media.length > 1" class="mt-4 flex gap-2 overflow-x-auto justify-end">
                    <button
                      v-for="(image, index) in integration.media"
                      :key="index"
                      @click="currentImageIndex = index"
                      class="flex-shrink-0 overflow-hidden rounded-lg border-2 transition-all"
                      :class="currentImageIndex === index ? 'border-blue-500' : 'border-gray-200 dark:border-gray-700'"
                    >
                      <img
                        :src="image.type === 'youtube' ? `https://img.youtube.com/vi/${image.url}/hqdefault.jpg` : (image.url.startsWith('http') ? image.url : require(`@pkg/assets/images/${image.url}`))"
                        :alt="image.alt"
                        class="h-16 w-24 object-cover"
                      >
                    </button>
                  </div>
                </div>
              </div>

              <!-- Header -->
              <div class="flex items-start gap-6">
                <div class="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                  <img
                    v-if="integration.icon.endsWith('.svg')"
                    :src="require(`@pkg/assets/images/${integration.icon}`)"
                    :alt="integration.name"
                    class="h-12 w-12 object-contain"
                  >
                  <span v-else class="text-3xl">{{ integration.icon }}</span>
                </div>
                <div class="flex-1">
                  <h1 class="text-3xl font-bold text-slate-900 dark:text-white mb-2">
                    {{ integration.name }}
                  </h1>
                  <p class="text-lg text-slate-600 dark:text-slate-300 mb-4">
                    {{ integration.description }}
                  </p>
                  <div class="flex items-center gap-4">
                    <span class="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-800 dark:bg-slate-700 dark:text-slate-200">
                      {{ integration.category }}
                    </span>
                    <div class="flex items-center gap-2">
                      <div
                        class="h-2 w-2 rounded-full"
                        :class="integration.connected ? 'bg-green-500' : 'bg-gray-300'"
                      ></div>
                      <span class="text-sm text-slate-500 dark:text-slate-400">
                        {{ integration.connected ? 'Connected' : 'Not Connected' }}
                      </span>
                    </div>
                    <div class="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
                      <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Updated {{ formatFuzzyTime(integration.lastUpdated) }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Features -->
              <!-- <div class="space-y-4">
                <h2 class="text-xl font-semibold text-slate-900 dark:text-white">Features</h2>
                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div
                    v-for="feature in integration.features"
                    :key="feature.title"
                    class="flex gap-3 rounded-lg border border-gray-200 p-4 dark:border-gray-700"
                  >
                    <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                      <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <h3 class="font-medium text-slate-900 dark:text-white">{{ feature.title }}</h3>
                      <p class="text-sm text-slate-600 dark:text-slate-400">{{ feature.description }}</p>
                    </div>
                  </div>
                </div>
              </div> -->

              <!-- Connect/Disconnect Card -->
              <div class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-slate-800">
                <h3 class="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                  {{ integration.connected ? 'Manage Connection' : 'Connect Integration' }}
                </h3>
                
                <!-- Form Guide -->
                <div v-if="integration.formGuide && !integration.connected" class="mb-6">
                  <p class="text-sm text-slate-600 dark:text-slate-400">
                    <span class="font-medium">Where to find this information:</span> {{ integration.formGuide }}
                  </p>
                </div>
                
                <!-- Configuration Form -->
                <div v-if="!integration.connected && integration.properties && integration.properties.length > 0" class="space-y-4 mb-6">
                  <div v-for="property in integration.properties" :key="property.key" class="space-y-2">
                    <label :for="property.key" class="block text-sm font-medium text-slate-700 dark:text-slate-300">
                      {{ property.title }}
                      <span v-if="property.required" class="text-red-500">*</span>
                    </label>
                    <input
                      :id="property.key"
                      :type="property.type"
                      v-model="formData[property.key]"
                      :placeholder="property.placeholder"
                      :required="property.required"
                      class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-slate-700 dark:text-white"
                      :class="{ 'border-red-500': errors[property.key] }"
                    >
                    <p v-if="property.hint" class="text-xs text-slate-500 dark:text-slate-400">
                      {{ property.hint }}
                    </p>
                    <p v-if="errors[property.key]" class="text-xs text-red-500">
                      {{ errors[property.key] }}
                    </p>
                  </div>
                </div>
                
                <div class="space-y-4">
                  <button
                    @click="integration.connected ? disconnectIntegration() : handleConnect()"
                    :disabled="isLoading"
                    class="w-full rounded-lg px-4 py-2 text-sm font-medium transition-colors flex items-center justify-center"
                    :class="integration.connected 
                      ? 'bg-red-600 text-white hover:bg-red-700' 
                      : 'bg-blue-600 text-white hover:bg-blue-700'"
                  >
                    <svg v-if="isLoading" class="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a8 8 0 01-16 0v4a8 8 0 0016 0z"></path>
                    </svg>
                    {{ isLoading ? 'Processing...' : (integration.connected ? 'Disconnect' : 'Connect Now') }}
                  </button>
                  <p class="text-xs text-slate-500 dark:text-slate-400">
                    {{ integration.connected 
                      ? 'Disconnecting will remove access to your account' 
                      : 'Connect your account to start using this integration' }}
                  </p>
                </div>
              </div>

              <!-- Guide Links -->
              <!-- <div v-if="integration.guideLinks && integration.guideLinks.length > 0" class="space-y-4">
                <h2 class="text-xl font-semibold text-slate-900 dark:text-white">Guides & Documentation</h2>
                <div class="space-y-3">
                  <a
                    v-for="link in integration.guideLinks"
                    :key="link.url"
                    :href="link.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="flex items-center justify-between rounded-lg border border-gray-200 p-4 hover:bg-slate-50 dark:border-gray-700 dark:hover:bg-slate-800"
                  >
                    <div class="flex items-center gap-3">
                      <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700">
                        <svg class="h-4 w-4 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div>
                        <h3 class="font-medium text-slate-900 dark:text-white">{{ link.title }}</h3>
                        <p class="text-sm text-slate-600 dark:text-slate-400">{{ link.description }}</p>
                      </div>
                    </div>
                    <svg class="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div> -->
            </div>

            <!-- Sidebar -->
            <div class="lg:col-span-2 space-y-8">
              <!-- Installation Guide and Resources Row -->
              <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <!-- Installation Guide - 70% width (8 columns) -->
                <div class="lg:col-span-8">
                  <div v-if="integration.installationGuide" class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-slate-800">
                    <h3 class="text-lg font-semibold text-slate-900 dark:text-white mb-4">{{ integration.installationGuide.title }}</h3>
                    <p class="text-sm text-slate-600 dark:text-slate-300 mb-6">{{ integration.installationGuide.description }}</p>
                    
                    <div class="space-y-6">
                      <div
                        v-for="(step, index) in integration.installationGuide.steps"
                        :key="index"
                        class="border-l-2 border-blue-200 dark:border-blue-800 pl-4"
                      >
                        <div class="flex items-center gap-2 mb-2">
                          <div class="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-medium">
                            {{ index + 1 }}
                          </div>
                          <h4 class="font-medium text-slate-900 dark:text-white">{{ step.title }}</h4>
                        </div>
                        <div class="prose prose-sm max-w-none dark:prose-invert">
                          <div class="whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{{ step.content }}</div>
                        </div>
                      </div>
                    </div>
                    
                    <div v-if="integration.installationGuide.importantNotes && integration.installationGuide.importantNotes.length > 0" class="mt-6 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                      <h5 class="font-medium text-amber-900 dark:text-amber-100 mb-2">Important Notes</h5>
                      <ul class="space-y-1 text-sm text-amber-800 dark:text-amber-200">
                        <li v-for="(note, index) in integration.installationGuide.importantNotes" :key="index" class="flex items-start gap-2">
                          <svg class="h-4 w-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                          </svg>
                          {{ note }}
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                <!-- Right Column - 30% width (4 columns) -->
                <div class="lg:col-span-4 space-y-8">
                  <!-- Additional Resources -->
                  <div v-if="integration.guideLinks && integration.guideLinks.length > 0" class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-slate-800">
                    <h3 class="text-lg font-semibold text-slate-900 dark:text-white mb-4">Additional Resources</h3>
                    <div class="space-y-3">
                      <a
                        v-for="link in integration.guideLinks"
                        :key="link.url"
                        :href="link.url"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="flex items-center justify-between rounded-lg border border-gray-200 p-4 hover:bg-slate-50 dark:border-gray-700 dark:hover:bg-slate-800"
                      >
                        <div class="flex items-center gap-3">
                          <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700">
                            <svg class="h-4 w-4 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div>
                            <h4 class="font-medium text-slate-900 dark:text-white text-sm">{{ link.title }}</h4>
                            <p class="text-xs text-slate-600 dark:text-slate-400">{{ link.description }}</p>
                          </div>
                        </div>
                        <svg class="h-4 w-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </div>
                  </div>

                  <!-- Quick Info -->
                  <div class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-slate-800">
                    <h3 class="text-lg font-semibold text-slate-900 dark:text-white mb-4">Quick Info</h3>
                    <div class="space-y-3">
                      <div>
                        <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Category</p>
                        <p class="text-sm text-slate-900 dark:text-white">{{ integration.category }}</p>
                      </div>
                      <div>
                        <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Version</p>
                        <p class="text-sm text-slate-900 dark:text-white">{{ integration.version || '1.0.0' }}</p>
                      </div>
                      <div>
                        <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Last Updated</p>
                        <p class="text-sm text-slate-900 dark:text-white capitalize">{{ formatFuzzyTime(integration.lastUpdated) }}</p>
                      </div>
                      <div>
                        <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Developer</p>
                        <p class="text-sm text-slate-900 dark:text-white">{{ integration.developer }}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Support -->
              <!-- <div class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-slate-800">
                <h3 class="text-lg font-semibold text-slate-900 dark:text-white mb-4">Need Help?</h3>
                <div class="space-y-3">
                  <a
                    href="#"
                    class="flex items-center gap-3 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  >
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Help Center
                  </a>
                  <a
                    href="#"
                    class="flex items-center gap-3 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  >
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Contact Support
                  </a>
                </div>
              </div> -->
            </div>
          </div>

          <!-- Loading State -->
          <div v-else class="flex h-64 items-center justify-center">
            <div class="text-center">
              <div class="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600"></div>
              <p class="text-sm text-slate-600 dark:text-slate-400">Loading integration details...</p>
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
import YouTubePlayer from '@pkg/components/YouTubePlayer.vue';
import { getIntegrationService } from '@pkg/agent/services/IntegrationService';
import { formatFuzzyTime } from '@pkg/utils/dateFormat';

import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const THEME_STORAGE_KEY = 'agentTheme';
const isDark = ref(false);
const route = useRoute();
const router = useRouter();
const integrationService = getIntegrationService();

const integration = ref<Integration | null>(null);
const currentImageIndex = ref(0);
const formData = ref<Record<string, string>>({});
const errors = ref<Record<string, string>>({});
const isLoading = ref(false);

// Carousel functions
const nextImage = () => {
  if (integration.value && integration.value.media) {
    currentImageIndex.value = (currentImageIndex.value + 1) % integration.value.media.length;
  }
};

const previousImage = () => {
  if (integration.value && integration.value.media) {
    currentImageIndex.value = currentImageIndex.value === 0 
      ? integration.value.media.length - 1 
      : currentImageIndex.value - 1;
  }
};

const toggleTheme = () => {
  isDark.value = !isDark.value;
  localStorage.setItem(THEME_STORAGE_KEY, isDark.value ? 'dark' : 'light');
};

const connectIntegration = async () => {
  if (integration.value) {
    isLoading.value = true;
    try {
      await integrationService.setConnectionStatus(integration.value.id, true);
      integration.value.connected = true;
      integrations[integration.value.id].connected = true;
    } catch (error) {
      console.error('Failed to connect integration:', error);
    } finally {
      isLoading.value = false;
    }
  }
};

const disconnectIntegration = async () => {
  if (integration.value) {
    isLoading.value = true;
    try {
      await integrationService.setConnectionStatus(integration.value.id, false);
      integration.value.connected = false;
      integrations[integration.value.id].connected = false;
    } catch (error) {
      console.error('Failed to disconnect integration:', error);
    } finally {
      isLoading.value = false;
    }
  }
};

// Validation functions
const validateField = (property: any, value: string): string | null => {
  if (property.required && (!value || value.trim() === '')) {
    return `${property.title} is required`;
  }
  
  if (!value) return null;
  
  if (property.validation) {
    const { pattern, minLength, maxLength, min, max } = property.validation;
    
    if (pattern && !new RegExp(pattern).test(value)) {
      return `${property.title} format is invalid`;
    }
    
    if (minLength && value.length < minLength) {
      return `${property.title} must be at least ${minLength} characters`;
    }
    
    if (maxLength && value.length > maxLength) {
      return `${property.title} must be no more than ${maxLength} characters`;
    }
    
    if (property.type === 'number') {
      const numValue = Number(value);
      if (min !== undefined && numValue < min) {
        return `${property.title} must be at least ${min}`;
      }
      if (max !== undefined && numValue > max) {
        return `${property.title} must be no more than ${max}`;
      }
    }
  }
  
  return null;
};

const validateForm = (): boolean => {
  if (!integration.value?.properties) return true;
  
  errors.value = {};
  let isValid = true;
  
  for (const property of integration.value.properties) {
    const error = validateField(property, formData.value[property.key] || '');
    if (error) {
      errors.value[property.key] = error;
      isValid = false;
    }
  }
  
  return isValid;
};

const handleConnect = async () => {
  if (!integration.value?.properties || integration.value.properties.length === 0) {
    await connectIntegration();
    return;
  }
  
  if (validateForm()) {
    isLoading.value = true;
    try {
      // Save form data to database
      const formInputs = Object.entries(formData.value).map(([key, value]) => ({
        integration_id: integration.value!.id,
        property: key,
        value: value
      }));
      
      await integrationService.setFormValues(formInputs);
      console.log('Integration configuration saved:', formData.value);
      
      // Update connection status
      await integrationService.setConnectionStatus(integration.value.id, true);
      integration.value.connected = true;
      integrations[integration.value.id].connected = true;
    } catch (error) {
      console.error('Failed to save integration configuration:', error);
    } finally {
      isLoading.value = false;
    }
  }
};

onMounted(async () => {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    isDark.value = saved === 'dark';
  } catch {
    isDark.value = false;
  }

  // Initialize integration service
  await integrationService.initialize();

  // Load integration data based on route parameter
  const integrationId = route.params.id as string;
  integration.value = integrations[integrationId] || null;

  // If integration not found, redirect back to integrations list
  if (!integration.value) {
    router.push('/Integrations');
    return;
  }

  // Load form data from database
  try {
    const formValues = await integrationService.getFormValues(integrationId);
    const formDataObj: Record<string, string> = {};
    formValues.forEach(value => {
      formDataObj[value.property] = value.value;
    });
    formData.value = formDataObj;
    
    // Load connection status
    const connectionStatus = await integrationService.getConnectionStatus(integrationId);
    integration.value.connected = connectionStatus.connected;
    integrations[integrationId].connected = connectionStatus.connected;
  } catch (error) {
    console.error('Failed to load integration data:', error);
  }
});
</script>

<style scoped>
/* Custom styles for integration detail page */
.aspect-video {
  aspect-ratio: 16 / 9;
}
</style>
