<script setup>
defineProps({
  icon: String,
  title: String,
  description: String,
  pageId: String,
});
const emit = defineEmits(['navigate']);
</script>

<template>
  <button
    @click="$emit('navigate', pageId)"
    class="bg-card border border-zinc-800 rounded-2xl p-5 text-left hover:border-orange-500/40 hover:bg-zinc-900 transition-all group w-full"
  >
    <div class="text-2xl mb-3">{{ icon }}</div>
    <h3 class="font-bold text-white text-sm mb-1 group-hover:text-orange-400 transition-colors">{{ title }}</h3>
    <p class="text-xs text-zinc-500 leading-relaxed">{{ description }}</p>
    <div class="mt-3 text-xs text-orange-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
      Read more →
    </div>
  </button>
</template>
