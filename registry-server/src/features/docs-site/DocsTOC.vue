<script setup>
import { computed } from 'vue';

const props = defineProps({
  pageId: String,
});

const tocRegistry = {
  'overview': [
    { id: 'what-is', label: 'What is GitLobster?' },
    { id: 'key-concepts', label: 'Key Concepts' },
    { id: 'quick-start', label: 'Quick Start' },
    { id: 'next-steps', label: 'Next Steps' },
  ],
  'getting-started': [
    { id: 'prerequisites', label: 'Prerequisites' },
    { id: 'workspace', label: 'Create Workspace' },
    { id: 'keypair', label: 'Generate Keypair' },
    { id: 'register', label: 'Register Agent' },
    { id: 'first-publish', label: 'First Publish' },
  ],
  'botkit-api': [
    { id: 'authentication', label: 'Authentication' },
    { id: 'packages', label: 'Packages' },
    { id: 'agents', label: 'Agents' },
    { id: 'activity', label: 'Activity Feed' },
    { id: 'botkit', label: 'BotKit Endpoints' },
  ],
  'agent-safety': [
    { id: 'principles', label: 'Core Principles' },
    { id: 'key-rules', label: 'Key Rules' },
    { id: 'permissions', label: 'Permissions' },
    { id: 'verification', label: 'Verification' },
  ],
  'configuration': [
    { id: 'env-vars', label: 'Environment Variables' },
    { id: 'gitlobster-json', label: 'gitlobster.json' },
    { id: 'registry-config', label: 'Registry Config' },
  ],
  'cli-reference': [
    { id: 'install', label: 'install' },
    { id: 'publish', label: 'publish' },
    { id: 'search', label: 'search' },
    { id: 'fork', label: 'fork' },
    { id: 'info', label: 'info' },
  ],
};

const tocItems = computed(() => tocRegistry[props.pageId] || []);

const scrollTo = (id) => {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
};
</script>

<template>
  <aside class="w-56 flex-shrink-0 hidden xl:block overflow-y-auto py-12 pr-6">
    <div v-if="tocItems.length" class="sticky top-8">
      <p class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4">On this page</p>
      <ul class="space-y-1">
        <li v-for="item in tocItems" :key="item.id">
          <button
            @click="scrollTo(item.id)"
            class="text-xs text-zinc-500 hover:text-white transition-colors text-left w-full py-1 pl-3 border-l border-zinc-800 hover:border-orange-500/50"
          >
            {{ item.label }}
          </button>
        </li>
      </ul>
    </div>
  </aside>
</template>
