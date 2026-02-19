<script setup>
import { ref, onMounted, computed } from 'vue';

const props = defineProps({
  code: {
    type: String,
    required: true,
  },
  language: {
    type: String,
    default: 'bash',
  },
  filename: String,
});

const copied = ref(false);
const highlighted = ref('');

const copyCode = async () => {
  try {
    await navigator.clipboard.writeText(props.code);
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 2000);
  } catch (e) {
    console.error('Copy failed:', e);
  }
};

onMounted(() => {
  // Use highlight.js if available globally, otherwise fallback to plain text
  if (window.hljs) {
    try {
      const result = window.hljs.highlight(props.code, { language: props.language, ignoreIllegals: true });
      highlighted.value = result.value;
    } catch (e) {
      highlighted.value = escapeHtml(props.code);
    }
  } else {
    highlighted.value = escapeHtml(props.code);
  }
});

const escapeHtml = (text) => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const displayLabel = computed(() => props.filename || props.language.toUpperCase());
</script>

<template>
  <div class="my-6 rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900">
    <!-- Header bar -->
    <div class="flex items-center justify-between px-4 py-2.5 bg-black/50 border-b border-zinc-800">
      <div class="flex items-center gap-3">
        <!-- Traffic light dots -->
        <div class="flex gap-1.5">
          <div class="w-3 h-3 rounded-full bg-zinc-700"></div>
          <div class="w-3 h-3 rounded-full bg-zinc-700"></div>
          <div class="w-3 h-3 rounded-full bg-zinc-700"></div>
        </div>
        <span class="text-[10px] font-bold text-zinc-500 mono uppercase tracking-widest">{{ displayLabel }}</span>
      </div>
      <button
        @click="copyCode"
        class="flex items-center gap-1.5 text-[10px] text-zinc-500 hover:text-white transition-colors mono px-2 py-1 rounded hover:bg-zinc-800"
      >
        <span>{{ copied ? '✓' : '⎘' }}</span>
        <span>{{ copied ? 'Copied!' : 'Copy' }}</span>
      </button>
    </div>
    <!-- Code content -->
    <div class="overflow-x-auto">
      <pre class="p-5 text-sm mono leading-relaxed"><code v-if="highlighted" v-html="highlighted" class="hljs"></code><code v-else class="text-zinc-300">{{ code }}</code></pre>
    </div>
  </div>
</template>
