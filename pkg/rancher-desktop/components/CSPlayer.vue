<template>
  <div class="aspect-video bg-black rounded-lg overflow-hidden relative">
    <!-- Thumbnail Background -->
    <div 
      class="absolute inset-0 bg-cover bg-center bg-no-repeat cursor-pointer"
      :style="{ backgroundImage: `url(https://img.youtube.com/vi/${videoId}/hqdefault.jpg)` }"
      @click="playVideo"
    >
      <!-- Play Button Overlay -->
      <div class="absolute inset-0 flex items-center justify-center bg-black/30">
        <div class="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center hover:bg-white transition-colors">
          <svg class="w-8 h-8 text-gray-800" fill="currentColor" viewBox="0 0 512 512">
            <path d="M256,0.376C114.616,0.376,0,114.824,0,256s114.616,255.624,256,255.624S512,397.176,512,256 S397.384,0.376,256,0.376z M184.496,146.928l195.624,104.44L184.496,355.8V146.928z"/>
          </svg>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  videoId: string;
  title?: string;
  alt?: string;
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  alt: ''
});

const playVideo = () => {
  window.open(`https://www.youtube.com/watch?v=${props.videoId}`, '_blank');
};
</script>

<style scoped>
.aspect-video {
  aspect-ratio: 16 / 9;
}
</style>
