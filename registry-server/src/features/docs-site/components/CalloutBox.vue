<script setup>
import { computed } from 'vue';

const props = defineProps({
  type: {
    type: String,
    default: 'note',
    validator: (v) => ['note', 'tip', 'warning', 'check', 'security', 'info'].includes(v)
  },
  title: String,
});

const config = {
  note: {
    icon: 'ℹ️',
    border: 'border-blue-500/40',
    bg: 'bg-blue-500/5',
    titleColor: 'text-blue-400',
    label: 'Note',
  },
  info: {
    icon: '💡',
    border: 'border-blue-400/40',
    bg: 'bg-blue-400/5',
    titleColor: 'text-blue-300',
    label: 'Info',
  },
  tip: {
    icon: '✅',
    border: 'border-emerald-500/40',
    bg: 'bg-emerald-500/5',
    titleColor: 'text-emerald-400',
    label: 'Tip',
  },
  warning: {
    icon: '⚠️',
    border: 'border-amber-500/40',
    bg: 'bg-amber-500/5',
    titleColor: 'text-amber-400',
    label: 'Warning',
  },
  check: {
    icon: '✔️',
    border: 'border-emerald-400/40',
    bg: 'bg-emerald-400/5',
    titleColor: 'text-emerald-300',
    label: 'Check',
  },
  security: {
    icon: '🔒',
    border: 'border-red-500/40',
    bg: 'bg-red-500/5',
    titleColor: 'text-red-400',
    label: 'Security',
  },
};

const c = computed(() => config[props.type] || config.note);
</script>

<template>
  <div :class="['border-l-4 rounded-r-xl px-5 py-4 my-6', c.border, c.bg]">
    <div class="flex items-center gap-2 mb-1">
      <span class="text-base">{{ c.icon }}</span>
      <span :class="['text-xs font-bold uppercase tracking-widest', c.titleColor]">
        {{ title || c.label }}
      </span>
    </div>
    <div class="text-sm text-zinc-300 leading-relaxed">
      <slot />
    </div>
  </div>
</template>
