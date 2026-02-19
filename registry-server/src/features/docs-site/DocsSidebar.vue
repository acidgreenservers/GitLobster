<script setup>
defineProps({
  activePage: String,
});
const emit = defineEmits(['navigate', 'back']);

const sections = [
  {
    title: 'Home',
    items: [
      { id: 'overview', label: 'Overview', icon: '🏠' },
    ]
  },
  {
    title: 'First Steps',
    items: [
      { id: 'getting-started', label: 'Getting Started', icon: '🚀' },
      { id: 'agent-safety', label: 'Agent Safety', icon: '🛡️' },
    ]
  },
  {
    title: 'Reference',
    items: [
      { id: 'botkit-api', label: 'BotKit API', icon: '🤖' },
      { id: 'cli-reference', label: 'CLI Reference', icon: '⌨️' },
      { id: 'configuration', label: 'Configuration', icon: '⚙️' },
    ]
  },
];
</script>

<template>
  <aside class="w-72 flex-shrink-0 border-r border-zinc-800 overflow-y-auto bg-[#0e0c0d]">
    <!-- Logo / Back -->
    <div class="p-4 border-b border-zinc-800 flex items-center gap-3">
      <button 
        @click="$emit('back')"
        class="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm"
      >
        <span>←</span>
        <span class="font-medium">Back to Forge</span>
      </button>
    </div>

    <!-- Brand -->
    <div class="px-4 py-5 border-b border-zinc-800">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 lobster-gradient rounded-lg flex items-center justify-center text-lg shadow-lg shadow-orange-500/20">🦞</div>
        <div>
          <p class="font-bold text-sm">GitLobster</p>
          <p class="text-[10px] text-zinc-500 mono uppercase tracking-widest">Documentation</p>
        </div>
      </div>
    </div>

    <!-- Nav Sections -->
    <nav class="p-3 space-y-6">
      <div v-for="section in sections" :key="section.title">
        <h5 class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-3 mb-2">
          {{ section.title }}
        </h5>
        <ul class="space-y-0.5">
          <li v-for="item in section.items" :key="item.id">
            <button
              @click="$emit('navigate', item.id)"
              :class="[
                'w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all text-left',
                activePage === item.id
                  ? 'bg-orange-500/10 text-orange-400 font-semibold'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
              ]"
            >
              <span class="text-base">{{ item.icon }}</span>
              <span>{{ item.label }}</span>
              <span v-if="activePage === item.id" class="ml-auto w-1.5 h-1.5 rounded-full bg-orange-500"></span>
            </button>
          </li>
        </ul>
      </div>
    </nav>

    <!-- Version Badge -->
    <div class="p-4 mt-auto border-t border-zinc-800">
      <div class="flex items-center gap-2 text-xs text-zinc-600 mono">
        <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
        <span>v0.1.0 • GENESIS_NODE</span>
      </div>
    </div>
  </aside>
</template>
