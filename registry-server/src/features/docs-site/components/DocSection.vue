<script setup>
defineProps({
  id: String,
  title: String,
  eyebrow: String,
});
</script>

<template>
  <section :id="id" class="mb-12 scroll-mt-8">
    <p v-if="eyebrow" class="text-[10px] font-bold text-orange-500 uppercase tracking-widest mb-2">{{ eyebrow }}</p>
    <h2 v-if="title" class="text-2xl font-bold text-white mb-6 pb-3 border-b border-zinc-800">{{ title }}</h2>
    <slot />
  </section>
</template>
