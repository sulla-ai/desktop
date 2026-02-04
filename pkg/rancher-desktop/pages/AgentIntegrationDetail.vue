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
              <!-- Header -->
              <div class="flex items-start gap-6">
                <div class="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-3xl dark:bg-slate-800">
                  {{ integration.icon }}
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
                  </div>
                </div>
              </div>

              <!-- Media -->
              <div v-if="integration.images && integration.images.length > 0" class="space-y-4">
                <h2 class="text-xl font-semibold text-slate-900 dark:text-white">Media</h2>
                <div class="relative">
                  <!-- Carousel Container -->
                  <div class="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                    <div class="relative">
                      <!-- Main Image -->
                      <div class="aspect-video">
                        <img
                          :src="integration.images[currentImageIndex].url"
                          :alt="integration.images[currentImageIndex].alt"
                          class="h-full w-full object-cover"
                        >
                        <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                          <p class="text-sm text-white">{{ integration.images[currentImageIndex].caption }}</p>
                        </div>
                      </div>
                      
                      <!-- Navigation Arrows -->
                      <button
                        v-if="integration.images.length > 1"
                        @click="previousImage"
                        class="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 transition-colors"
                      >
                        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <button
                        v-if="integration.images.length > 1"
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
                  <div v-if="integration.images.length > 1" class="mt-4 flex gap-2 overflow-x-auto">
                    <button
                      v-for="(image, index) in integration.images"
                      :key="index"
                      @click="currentImageIndex = index"
                      class="flex-shrink-0 overflow-hidden rounded-lg border-2 transition-all"
                      :class="currentImageIndex === index ? 'border-blue-500' : 'border-gray-200 dark:border-gray-700'"
                    >
                      <img
                        :src="image.url"
                        :alt="image.alt"
                        class="h-16 w-24 object-cover"
                      >
                    </button>
                  </div>
                </div>
              </div>

              <!-- Features -->
              <div class="space-y-4">
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
              </div>

              <!-- Connect/Disconnect Card -->
              <div class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-slate-800">
                <h3 class="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                  {{ integration.connected ? 'Manage Connection' : 'Connect Integration' }}
                </h3>
                <div class="space-y-4">
                  <button
                    @click="integration.connected ? disconnectIntegration() : connectIntegration()"
                    class="w-full rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                    :class="integration.connected 
                      ? 'bg-red-600 text-white hover:bg-red-700' 
                      : 'bg-blue-600 text-white hover:bg-blue-700'"
                  >
                    {{ integration.connected ? 'Disconnect' : 'Connect Now' }}
                  </button>
                  <p class="text-xs text-slate-500 dark:text-slate-400">
                    {{ integration.connected 
                      ? 'Disconnecting will remove access to your account' 
                      : 'Connect your account to start using this integration' }}
                  </p>
                </div>
              </div>

              <!-- Guide Links -->
              <div v-if="integration.guideLinks && integration.guideLinks.length > 0" class="space-y-4">
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
              </div>
            </div>

            <!-- Sidebar -->
            <div class="space-y-6">
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
                    <p class="text-sm text-slate-900 dark:text-white">{{ integration.lastUpdated || '2 days ago' }}</p>
                  </div>
                  <div>
                    <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Developer</p>
                    <p class="text-sm text-slate-900 dark:text-white">{{ integration.developer || 'Sulla Team' }}</p>
                  </div>
                </div>
              </div>

              <!-- Support -->
              <div class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-slate-800">
                <h3 class="text-lg font-semibold text-slate-900 dark:text-white mb-4">Need Help?</h3>
                <div class="space-y-3">
                  <a
                    href="#"
                    class="flex items-center gap-3 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  >
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Documentation
                  </a>
                  <a
                    href="#"
                    class="flex items-center gap-3 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  >
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                    </svg>
                    Support Chat
                  </a>
                </div>
              </div>
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
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

interface Integration {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  connected: boolean;
  version?: string;
  lastUpdated?: string;
  developer?: string;
  images?: Array<{
    url: string;
    alt: string;
    caption: string;
  }>;
  features?: Array<{
    title: string;
    description: string;
  }>;
  guideLinks?: Array<{
    title: string;
    description: string;
    url: string;
  }>;
}

const THEME_STORAGE_KEY = 'agentTheme';
const isDark = ref(false);
const route = useRoute();
const router = useRouter();

const integration = ref<Integration | null>(null);
const currentImageIndex = ref(0);

// Carousel functions
const nextImage = () => {
  if (integration.value && integration.value.images) {
    currentImageIndex.value = (currentImageIndex.value + 1) % integration.value.images.length;
  }
};

const previousImage = () => {
  if (integration.value && integration.value.images) {
    currentImageIndex.value = currentImageIndex.value === 0 
      ? integration.value.images.length - 1 
      : currentImageIndex.value - 1;
  }
};

// Mock integration data
const mockIntegrations: Record<string, Integration> = {
  intercom: {
    id: 'intercom',
    name: 'Intercom',
    description: 'Customer communication and support platform that helps you build better customer relationships through personalized, messenger-based experiences.',
    category: 'Communication',
    icon: '💬',
    connected: false,
    version: '2.1.0',
    lastUpdated: '1 day ago',
    developer: 'Intercom Inc.',
    images: [
      {
        url: 'https://via.placeholder.com/400x300/4F46E5/FFFFFF?text=Intercom+Dashboard',
        alt: 'Intercom Dashboard',
        caption: 'Main dashboard with conversation overview'
      },
      {
        url: 'https://via.placeholder.com/400x300/10B981/FFFFFF?text=Live+Chat',
        alt: 'Live Chat Interface',
        caption: 'Real-time customer chat interface'
      }
    ],
    features: [
      {
        title: 'Real-time Chat',
        description: 'Connect with customers in real-time through live chat'
      },
      {
        title: 'Automated Responses',
        description: 'Set up automated responses for common queries'
      },
      {
        title: 'Customer Analytics',
        description: 'Track customer interactions and satisfaction metrics'
      },
      {
        title: 'Multi-channel Support',
        description: 'Handle conversations across email, chat, and social media'
      }
    ],
    guideLinks: [
      {
        title: 'Getting Started Guide',
        description: 'Learn how to set up Intercom integration',
        url: 'https://docs.intercom.com'
      },
      {
        title: 'API Documentation',
        description: 'Complete API reference for developers',
        url: 'https://developers.intercom.com'
      },
      {
        title: 'Best Practices',
        description: 'Tips for effective customer communication',
        url: 'https://www.intercom.com/resources'
      }
    ]
  },
  hubspot: {
    id: 'hubspot',
    name: 'HubSpot',
    description: 'All-in-one marketing, sales, and service platform that helps businesses grow better with powerful tools for customer relationship management.',
    category: 'CRM',
    icon: '🎯',
    connected: false,
    version: '3.0.1',
    lastUpdated: '3 days ago',
    developer: 'HubSpot, Inc.',
    images: [
      {
        url: 'https://via.placeholder.com/400x300/FF6B6B/FFFFFF?text=HubSpot+CRM',
        alt: 'HubSpot CRM Dashboard',
        caption: 'Comprehensive CRM dashboard'
      },
      {
        url: 'https://via.placeholder.com/400x300/FF9F40/FFFFFF?text=Marketing+Hub',
        alt: 'Marketing Automation',
        caption: 'Marketing campaign management'
      }
    ],
    features: [
      {
        title: 'Contact Management',
        description: 'Organize and track all your customer interactions'
      },
      {
        title: 'Marketing Automation',
        description: 'Create automated marketing campaigns and workflows'
      },
      {
        title: 'Sales Pipeline',
        description: 'Track deals and manage your sales process'
      },
      {
        title: 'Analytics & Reporting',
        description: 'Get insights into your business performance'
      }
    ],
    guideLinks: [
      {
        title: 'HubSpot Academy',
        description: 'Free courses and certifications',
        url: 'https://academy.hubspot.com'
      },
      {
        title: 'API Documentation',
        description: 'Complete API reference for developers',
        url: 'https://developers.hubspot.com'
      }
    ]
  },
  slack: {
    id: 'slack',
    name: 'Slack',
    description: 'Team collaboration and messaging platform that brings all your communication together in one place.',
    category: 'Communication',
    icon: '💭',
    connected: false,
    version: '1.5.2',
    lastUpdated: '5 days ago',
    developer: 'Slack Technologies',
    images: [
      {
        url: 'https://via.placeholder.com/400x300/4A90E2/FFFFFF?text=Slack+Interface',
        alt: 'Slack Team Interface',
        caption: 'Team collaboration workspace'
      },
      {
        url: 'https://via.placeholder.com/400x300/50E3C2/FFFFFF?text=Channels',
        alt: 'Slack Channels',
        caption: 'Organized team conversations'
      }
    ],
    features: [
      {
        title: 'Channel Organization',
        description: 'Organize conversations by topic, project, or team'
      },
      {
        title: 'File Sharing',
        description: 'Share and collaborate on files with your team'
      },
      {
        title: 'App Integrations',
        description: 'Connect with thousands of third-party apps'
      },
      {
        title: 'Video Calls',
        description: 'Start video calls directly from conversations'
      }
    ],
    guideLinks: [
      {
        title: 'Slack Help Center',
        description: 'Get help with Slack features',
        url: 'https://slack.com/help'
      },
      {
        title: 'API Documentation',
        description: 'Build custom integrations with Slack API',
        url: 'https://api.slack.com'
      }
    ]
  },
  onenote: {
    id: 'onenote',
    name: 'OneNote',
    description: 'Digital note-taking app that helps you capture ideas, organize thoughts, and collaborate with others.',
    category: 'Productivity',
    icon: '📝',
    connected: false,
    version: '2.0.3',
    lastUpdated: '1 week ago',
    developer: 'Microsoft Corporation',
    images: [
      {
        url: 'https://via.placeholder.com/400x300/7719AA/FFFFFF?text=OneNote+Interface',
        alt: 'OneNote Interface',
        caption: 'Digital notebook interface'
      }
    ],
    features: [
      {
        title: 'Rich Text Editing',
        description: 'Format notes with fonts, colors, and styles'
      },
      {
        title: 'Cloud Sync',
        description: 'Access your notes from any device'
      },
      {
        title: 'Collaboration',
        description: 'Share and collaborate on notebooks'
      }
    ],
    guideLinks: [
      {
        title: 'OneNote Support',
        description: 'Get help with OneNote features',
        url: 'https://support.microsoft.com/onenote'
      }
    ]
  },
  trello: {
    id: 'trello',
    name: 'Trello',
    description: 'Visual collaboration tool that creates a shared perspective on any project using boards, lists, and cards.',
    category: 'Productivity',
    icon: '📋',
    connected: false,
    version: '1.8.0',
    lastUpdated: '2 weeks ago',
    developer: 'Atlassian',
    images: [
      {
        url: 'https://via.placeholder.com/400x300/0079BF/FFFFFF?text=Trello+Board',
        alt: 'Trello Board',
        caption: 'Kanban-style project management'
      }
    ],
    features: [
      {
        title: 'Visual Boards',
        description: 'Organize projects with visual boards and cards'
      },
      {
        title: 'Team Collaboration',
        description: 'Work together with your team in real-time'
      },
      {
        title: 'Automation',
        description: 'Automate repetitive tasks with Butler'
      }
    ],
    guideLinks: [
      {
        title: 'Trello Guide',
        description: 'Learn how to use Trello effectively',
        url: 'https://trello.com/guide'
      }
    ]
  },
  zendesk: {
    id: 'zendesk',
    name: 'Zendesk',
    description: 'Customer service and engagement platform designed to build better customer relationships.',
    category: 'Support',
    icon: '🎧',
    connected: false,
    version: '2.2.1',
    lastUpdated: '4 days ago',
    developer: 'Zendesk Inc.',
    images: [
      {
        url: 'https://via.placeholder.com/400x300/03363D/FFFFFF?text=Zendesk+Support',
        alt: 'Zendesk Support',
        caption: 'Customer support ticketing system'
      }
    ],
    features: [
      {
        title: 'Ticket Management',
        description: 'Efficiently handle customer support tickets'
      },
      {
        title: 'Knowledge Base',
        description: 'Create and manage self-service knowledge bases'
      },
      {
        title: 'Multi-channel Support',
        description: 'Handle support across email, chat, and social media'
      }
    ],
    guideLinks: [
      {
        title: 'Zendesk Help Center',
        description: 'Comprehensive documentation and guides',
        url: 'https://support.zendesk.com'
      }
    ]
  },
  evernote: {
    id: 'evernote',
    name: 'Evernote',
    description: 'Note-taking and task management application designed for archiving and creating notes.',
    category: 'Productivity',
    icon: '📔',
    connected: false,
    version: '1.9.5',
    lastUpdated: '6 days ago',
    developer: 'Evernote Corporation',
    images: [
      {
        url: 'https://via.placeholder.com/400x300/2BE661/FFFFFF?text=Evernote+Notes',
        alt: 'Evernote Interface',
        caption: 'Note organization and management'
      }
    ],
    features: [
      {
        title: 'Note Organization',
        description: 'Organize notes with notebooks and tags'
      },
      {
        title: 'Web Clipper',
        description: 'Save web pages and articles directly to Evernote'
      },
      {
        title: 'Document Scanning',
        description: 'Scan and digitize documents with your camera'
      }
    ],
    guideLinks: [
      {
        title: 'Evernote Help & Learning',
        description: 'Get started with Evernote',
        url: 'https://help.evernote.com'
      }
    ]
  },
  dropbox: {
    id: 'dropbox',
    name: 'Dropbox',
    description: 'Cloud storage service that lets you save files online and sync them with your devices.',
    category: 'Storage',
    icon: '☁️',
    connected: false,
    version: '3.1.0',
    lastUpdated: '1 week ago',
    developer: 'Dropbox Inc.',
    images: [
      {
        url: 'https://via.placeholder.com/400x300/0061FF/FFFFFF?text=Dropbox+Files',
        alt: 'Dropbox File Manager',
        caption: 'Cloud file storage and sharing'
      }
    ],
    features: [
      {
        title: 'File Syncing',
        description: 'Sync files across all your devices'
      },
      {
        title: 'File Sharing',
        description: 'Share files and folders with anyone'
      },
      {
        title: 'Version History',
        description: 'Access previous versions of your files'
      }
    ],
    guideLinks: [
      {
        title: 'Dropbox Help Center',
        description: 'Learn how to use Dropbox features',
        url: 'https://help.dropbox.com'
      }
    ]
  },
  tinder: {
    id: 'tinder',
    name: 'Tinder',
    description: 'Social discovery and dating platform that matches people based on their preferences.',
    category: 'Social',
    icon: '🔥',
    connected: false,
    version: '1.2.0',
    lastUpdated: '2 weeks ago',
    developer: 'Match Group',
    images: [
      {
        url: 'https://via.placeholder.com/400x300/FF6B6B/FFFFFF?text=Tinder+Matches',
        alt: 'Tinder Interface',
        caption: 'Social discovery and matching'
      }
    ],
    features: [
      {
        title: 'Profile Matching',
        description: 'Get matched with compatible people'
      },
      {
        title: 'Messaging',
        description: 'Chat with your matches'
      },
      {
        title: 'Social Features',
        description: 'Connect with people in your area'
      }
    ],
    guideLinks: [
      {
        title: 'Tinder Safety Center',
        description: 'Safety tips and guidelines',
        url: 'https://safety.tinder.com'
      }
    ]
  },
  framer: {
    id: 'framer',
    name: 'Framer',
    description: 'Interactive design and prototyping tool that helps you create beautiful websites and apps.',
    category: 'Design',
    icon: '🎨',
    connected: false,
    version: '2.4.1',
    lastUpdated: '3 days ago',
    developer: 'Framer B.V.',
    images: [
      {
        url: 'https://via.placeholder.com/400x300/0055FF/FFFFFF?text=Framer+Design',
        alt: 'Framer Design Interface',
        caption: 'Interactive design and prototyping'
      }
    ],
    features: [
      {
        title: 'Visual Design',
        description: 'Create stunning designs with powerful tools'
      },
      {
        title: 'Interactive Prototypes',
        description: 'Build interactive prototypes without code'
      },
      {
        title: 'Code Generation',
        description: 'Generate production-ready React code'
      }
    ],
    guideLinks: [
      {
        title: 'Framer University',
        description: 'Learn Framer with free courses',
        url: 'https://www.framer.com/learn'
      }
    ]
  }
};

const toggleTheme = () => {
  isDark.value = !isDark.value;
  localStorage.setItem(THEME_STORAGE_KEY, isDark.value ? 'dark' : 'light');
};

const connectIntegration = () => {
  if (integration.value) {
    integration.value.connected = true;
    // Update the main integrations list
    const mainIntegration = mockIntegrations[integration.value.id];
    if (mainIntegration) {
      mainIntegration.connected = true;
    }
  }
};

const disconnectIntegration = () => {
  if (integration.value) {
    integration.value.connected = false;
    // Update the main integrations list
    const mainIntegration = mockIntegrations[integration.value.id];
    if (mainIntegration) {
      mainIntegration.connected = false;
    }
  }
};

onMounted(() => {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    isDark.value = saved === 'dark';
  } catch {
    isDark.value = false;
  }

  // Load integration data based on route parameter
  const integrationId = route.params.id as string;
  integration.value = mockIntegrations[integrationId] || null;

  // If integration not found, redirect back to integrations list
  if (!integration.value) {
    router.push('/Integrations');
  }
});
</script>

<style scoped>
/* Custom styles for integration detail page */
.aspect-video {
  aspect-ratio: 16 / 9;
}
</style>
