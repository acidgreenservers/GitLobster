<script setup>
import { ref, onMounted } from 'vue';
import { repositoryApi } from '../repository.api';
import { marked } from 'marked';
import { formatDistanceToNow } from 'date-fns';
import AgentActionModal from '../../modals/AgentActionModal.vue';

const props = defineProps({
    repo: { type: Object, required: true }
});

const pages = ref([]);
const currentPage = ref(null); // { slug, title, content, updated_at }
const viewMode = ref('list'); // 'list', 'view', 'edit', 'new'
const loading = ref(false);

const form = ref({ title: '', content: '' });

// Agent Mediation
const showAgentModal = ref(false);
const agentCommand = ref('');
const agentDescription = ref('');
const pendingAction = ref(null);

const fetchPages = async () => {
    loading.value = true;
    pages.value = await repositoryApi.getWikiPages(props.repo.name);
    loading.value = false;
};

const openPage = async (slug) => {
    loading.value = true;
    const page = await repositoryApi.getWikiPage(props.repo.name, slug);
    if (page) {
        currentPage.value = page;
        viewMode.value = 'view';
    }
    loading.value = false;
};

const startEdit = () => {
    form.value = { title: currentPage.value.title, content: currentPage.value.content };
    viewMode.value = 'edit';
};

const promptSavePage = () => {
    if (!form.value.title || !form.value.content) return;

    // Construct slug for command prediction
    const slug = viewMode.value === 'new'
        ? form.value.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
        : currentPage.value.slug;

    const safeTitle = JSON.stringify(form.value.title);

    agentCommand.value = `botkit wiki update --repo ${props.repo.name} --slug ${slug} --title ${safeTitle}`;
    agentDescription.value = 'Instruct your agent to update this wiki page. Content should be provided via file or pipe to the agent.';

    pendingAction.value = async () => {
        loading.value = true;
        try {
            if (viewMode.value === 'new') {
                await repositoryApi.createWikiPage(props.repo.name, { ...form.value, slug });
                await fetchPages();
                await openPage(slug);
            } else {
                await repositoryApi.updateWikiPage(props.repo.name, currentPage.value.slug, form.value);
                await fetchPages();
                await openPage(currentPage.value.slug);
            }
        } catch (e) {
            console.error(e);
            alert('Failed to save page: ' + e.message);
            loading.value = false;
        }
    };
    showAgentModal.value = true;
};

const executePendingAction = async () => {
    if (pendingAction.value) {
        await pendingAction.value();
        showAgentModal.value = false;
    }
};

const startNew = () => {
    form.value = { title: '', content: '' };
    viewMode.value = 'new';
};

const formatTime = (iso) => {
    if (!iso) return '';
    try {
        return formatDistanceToNow(new Date(iso), { addSuffix: true });
    } catch { return iso; }
};

onMounted(fetchPages);
</script>

<template>
  <div class="flex gap-8 flex-col md:flex-row">
    <!-- Sidebar -->
    <div class="w-full md:w-64 border-r border-zinc-800 pr-0 md:pr-4">
        <div class="flex justify-between items-center mb-4">
            <h3 class="font-bold text-sm text-zinc-400">Pages</h3>
            <button @click="startNew" class="text-xs bg-zinc-800 hover:bg-zinc-700 px-2 py-1 rounded text-white">New Page</button>
        </div>
        <div class="space-y-1">
            <button v-for="page in pages" :key="page.slug"
                    @click="openPage(page.slug)"
                    class="w-full text-left px-3 py-2 rounded text-sm hover:bg-zinc-800 transition-colors truncate"
                    :class="currentPage?.slug === page.slug ? 'bg-zinc-800 font-bold text-white' : 'text-zinc-400'">
                {{ page.title }}
            </button>
            <div v-if="pages.length === 0" class="text-xs text-zinc-600 italic px-2">No pages yet</div>
        </div>
    </div>

    <!-- Content -->
    <div class="flex-1">
        <div v-if="loading" class="text-center py-12 text-zinc-500">Loading...</div>

        <div v-else-if="viewMode === 'list'" class="text-center py-12">
            <div class="text-4xl mb-4 opacity-30">📖</div>
            <h2 class="text-xl font-bold mb-2">Welcome to the Wiki</h2>
            <p class="text-zinc-500 mb-6">Create and share documentation for your project.</p>
            <button @click="startNew" class="px-6 py-2 bg-emerald-600 rounded-lg font-bold text-white">Create the first page</button>
        </div>

        <div v-else-if="viewMode === 'view' && currentPage">
            <div class="flex justify-between items-start mb-6 pb-6 border-b border-zinc-800">
                <div>
                    <h1 class="text-3xl font-bold mb-2">{{ currentPage.title }}</h1>
                    <div class="text-sm text-zinc-500">
                        Last edited {{ formatTime(currentPage.updated_at) }} by {{ currentPage.author_name || 'unknown' }}
                    </div>
                </div>
                <button @click="startEdit" class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-bold text-white">Edit Page</button>
            </div>
            <div class="prose prose-invert max-w-none" v-html="marked.parse(currentPage.content || '')"></div>
        </div>

        <div v-else-if="viewMode === 'edit' || viewMode === 'new'">
            <h2 class="text-xl font-bold mb-6">{{ viewMode === 'new' ? 'New Page' : 'Edit Page' }}</h2>
            <div class="space-y-4">
                <input v-model="form.title" placeholder="Page Title" class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 focus:outline-none focus:border-emerald-500 text-white font-bold text-lg">
                <div class="border border-zinc-700 rounded-lg overflow-hidden bg-black/20">
                    <div class="bg-zinc-900/50 p-2 border-b border-zinc-700 text-xs text-zinc-500 flex justify-end gap-2">
                        <span>Markdown supported</span>
                    </div>
                    <textarea v-model="form.content" placeholder="Write your content here..." rows="20" class="w-full bg-transparent p-4 focus:outline-none text-zinc-300 font-mono text-sm resize-none"></textarea>
                </div>
                <div class="flex justify-end gap-3">
                    <button @click="viewMode = currentPage ? 'view' : 'list'" class="px-4 py-2 text-zinc-400 hover:text-white">Cancel</button>
                    <button @click="promptSavePage" class="px-6 py-2 bg-emerald-600 rounded-lg font-bold text-white">Save Page</button>
                </div>
            </div>
        </div>
    </div>

    <AgentActionModal
        :visible="showAgentModal"
        :command="agentCommand"
        :description="agentDescription"
        @close="showAgentModal = false"
        @execute="executePendingAction"
    />
  </div>
</template>
