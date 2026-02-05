<template>
  <div class="relative w-full h-full bg-black rounded-lg overflow-hidden">
    <!-- YouTube Thumbnail -->
    <div 
      class="absolute inset-0 flex items-center justify-center cursor-pointer group"
      @click="openYouTube"
    >
      <img 
        :src="thumbnailUrl" 
        :alt="alt"
        class="w-full h-full object-cover"
      />
      <!-- Play Button Overlay -->
      <div class="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
        <div class="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
          <svg class="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z"/>
          </svg>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  videoId: string;
  title: string;
  alt?: string;
}

const props = withDefaults(defineProps<Props>(), {
  alt: ''
});

const thumbnailUrl = computed(() => {
  return `https://img.youtube.com/vi/${props.videoId}/hqdefault.jpg`;
});

const openYouTube = () => {
  const youtubeUrl = `https://www.youtube.com/watch?v=${props.videoId}`;
  window.open(youtubeUrl, '_blank');
};
</script>

<style scoped>
.aspect-video {
  aspect-ratio: 16 / 9;
}
</style>
