<script setup>
import { ref, computed } from 'vue';
import DocsSidebar from './DocsSidebar.vue';
import DocsContent from './DocsContent.vue';
import DocsTOC from './DocsTOC.vue';

// Import all doc page components
import DocsOverview from './pages/DocsOverview.vue';
import DocsGettingStarted from './pages/DocsGettingStarted.vue';
import DocsBotKitAPI from './pages/DocsBotKitAPI.vue';
import DocsAgentSafety from './pages/DocsAgentSafety.vue';
import DocsConfiguration from './pages/DocsConfiguration.vue';
import DocsCLIReference from './pages/DocsCLIReference.vue';
import DocsSkillCloudSync from './pages/DocsSkillCloudSync.vue';

const emit = defineEmits(['back', 'view-repo']);

// Active page state
const activePage = ref('overview');

// Doc registry — defines sidebar structure and page components
const docRegistry = {
  overview: { component: DocsOverview, title: 'Overview', section: 'home' },
  'getting-started': { component: DocsGettingStarted, title: 'Getting Started', section: 'first-steps' },
  'skill-cloud-sync': { component: DocsSkillCloudSync, title: 'Skill Cloud Sync', section: 'first-steps' },
  'botkit-api': { component: DocsBotKitAPI, title: 'BotKit API', section: 'reference' },
  'agent-safety': { component: DocsAgentSafety, title: 'Agent Safety', section: 'guides' },
  'configuration': { component: DocsConfiguration, title: 'Configuration', section: 'reference' },
  'cli-reference': { component: DocsCLIReference, title: 'CLI Reference', section: 'reference' },
};

const currentDoc = computed(() => docRegistry[activePage.value]);

const navigateTo = (pageId) => {
  activePage.value = pageId;
  // Scroll content area to top
  const content = document.getElementById('docs-content-area');
  if (content) content.scrollTop = 0;
};
</script>

<template>
  <div class="fixed inset-0 top-16 flex bg-[#09090b] z-40">
    <!-- Left Sidebar -->
    <DocsSidebar 
      :active-page="activePage" 
      @navigate="navigateTo"
      @back="$emit('back')"
    />

    <!-- Main Content -->
    <main id="docs-content-area" class="flex-1 overflow-y-auto">
      <DocsContent>
        <component :is="currentDoc.component" @navigate="navigateTo" @view-repo="$emit('view-repo', $event)" />
      </DocsContent>
    </main>

    <!-- Right TOC -->
    <DocsTOC :page-id="activePage" />
  </div>
</template>
