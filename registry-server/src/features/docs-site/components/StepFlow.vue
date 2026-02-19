<script setup>
import { ref } from 'vue';

defineProps({
  steps: {
    type: Array,
    required: true,
  }
});

const copied = ref(null);

const copyCode = async (code, index) => {
  try {
    await navigator.clipboard.writeText(code);
    copied.value = index;
    setTimeout(() => { copied.value = null; }, 2000);
  } catch (e) {
    console.error('Copy failed:', e);
  }
};
</script>

<template>
  <div class="my-8 space-y-0">
    <div 
      v-for="(step, index) in steps" 
      :key="index"
      class="relative flex gap-6"
    >
      <!-- Left: Number + Connector Line -->
      <div class="flex flex-col items-center">
        <div class="w-9 h-9 rounded-full lobster-gradient flex items-center justify-center text-black font-black text-sm flex-shrink-0 shadow-lg shadow-orange-500/20 z-10">
          {{ step.number || index + 1 }}
        </div>
        <div 
          v-if="index < steps.length - 1"
          class="w-px flex-1 bg-gradient-to-b from-orange-500/40 to-zinc-800 mt-1 mb-1 min-h-[2rem]"
        ></div>
      </div>

      <!-- Right: Content -->
      <div class="flex-1 pb-8">
        <h4 class="font-bold text-white text-base mb-2">{{ step.title }}</h4>
        <p v-if="step.description" class="text-zinc-400 text-sm leading-relaxed mb-3">{{ step.description }}</p>
        
        <div v-if="step.code" class="relative">
          <div class="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div class="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-black/40">
              <span class="text-[10px] font-bold text-zinc-500 mono uppercase tracking-widest">bash</span>
              <button 
                @click="copyCode(step.code, index)"
                class="text-[10px] text-zinc-500 hover:text-white transition-colors mono"
              >
                {{ copied === index ? '✓ Copied' : 'Copy' }}
              </button>
            </div>
            <pre class="p-4 text-sm text-emerald-400 mono overflow-x-auto leading-relaxed whitespace-pre-wrap">{{ step.code }}</pre>
          </div>
        </div>

        <div v-if="step.note" class="mt-3 flex items-start gap-2 text-xs text-zinc-500">
          <span class="text-amber-500 mt-0.5 flex-shrink-0">⚠</span>
          <span>{{ step.note }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
