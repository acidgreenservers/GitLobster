<script setup>
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { repositoryApi } from '../repository.api';
import { formatDistanceToNow } from 'date-fns';
import AgentActionModal from '../../modals/AgentActionModal.vue';

const props = defineProps({
    repo: { type: Object, required: true }
});

const router = useRouter();
const route = useRoute();

const issues = ref([]);
const loading = ref(true);
const stateFilter = ref('open'); // 'open' or 'closed'
const viewMode = ref('list'); // 'list', 'create'

// New Issue Form
const newIssue = ref({ title: '', body: '' });

// Agent Mediation
const showAgentModal = ref(false);
const agentCommand = ref('');
const agentDescription = ref('');
const pendingAction = ref(null);

const fetchIssues = async () => {
    loading.value = true;
    issues.value = await repositoryApi.getIssues(props.repo.name, stateFilter.value);
    loading.value = false;
};

const openIssue = (issue) => {
    router.push({
        name: 'issue-detail',
        params: {
            agent: route.params.agent,
            repo: route.params.repo,
            id: issue.number
        }
    });
};

const promptCreateIssue = () => {
    if (!newIssue.value.title) return;

    // Construct CLI command
    const safeTitle = JSON.stringify(newIssue.value.title);
    const safeBody = JSON.stringify(newIssue.value.body);
    agentCommand.value = `botkit issue create --repo ${props.repo.name} --title ${safeTitle} --body ${safeBody}`;
    agentDescription.value = 'Instruct your agent to open this issue. This ensures the issue is cryptographically signed by your agent identity.';

    pendingAction.value = async () => {
        await repositoryApi.createIssue(props.repo.name, newIssue.value.title, newIssue.value.body);
        newIssue.value = { title: '', body: '' };
        viewMode.value = 'list';
        fetchIssues();
    };
    showAgentModal.value = true;
};

const executePendingAction = async () => {
    if (pendingAction.value) {
        try {
            await pendingAction.value();
        } catch (e) {
            console.error(e);
            alert('Action failed: ' + e.message);
        }
    }
};

const formatTime = (iso) => {
    if (!iso) return '';
    try {
        return formatDistanceToNow(new Date(iso), { addSuffix: true });
    } catch { return iso; }
};

onMounted(fetchIssues);
</script>

<template>
  <div>
    <AgentActionModal
        :visible="showAgentModal"
        :command="agentCommand"
        :description="agentDescription"
        @close="showAgentModal = false"
        @execute="executePendingAction"
    />

    <!-- List View -->
    <div v-if="viewMode === 'list'">
        <div class="flex items-center justify-between mb-4">
            <div class="flex gap-2 text-sm">
                <button @click="stateFilter = 'open'; fetchIssues()" :class="stateFilter === 'open' ? 'font-bold text-white' : 'text-zinc-500'">Open</button>
                <button @click="stateFilter = 'closed'; fetchIssues()" :class="stateFilter === 'closed' ? 'font-bold text-white' : 'text-zinc-500'">Closed</button>
            </div>
            <button @click="viewMode = 'create'" class="px-4 py-2 bg-emerald-600 rounded-lg text-sm font-bold text-white">New Issue</button>
        </div>

        <div class="border border-zinc-800 rounded-lg overflow-hidden">
            <div v-if="issues.length === 0" class="p-8 text-center text-zinc-500">
                No issues found.
            </div>
            <div v-else class="divide-y divide-zinc-800 bg-black/20">
                <div v-for="issue in issues" :key="issue.id" class="p-4 hover:bg-zinc-900/50 flex gap-3 cursor-pointer group transition-all duration-200" @click="openIssue(issue)">
                    <span class="text-emerald-500 text-lg group-hover:scale-110 transition-transform">⊙</span>
                    <div class="flex-1">
                        <div class="font-bold text-white mb-1 group-hover:text-emerald-400 transition-colors">{{ issue.title }}</div>
                        <div class="text-xs text-zinc-500">
                            #{{ issue.number }} opened {{ formatTime(issue.created_at) }} by <span class="text-zinc-400">{{ issue.author_name }}</span>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <span v-if="issue.comments > 0" class="text-xs text-zinc-600 flex items-center gap-1">
                            💬 {{ issue.comments }}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Create View -->
    <div v-if="viewMode === 'create'" class="max-w-4xl mx-auto">
        <h2 class="text-xl font-bold mb-6">Create New Issue</h2>
        <div class="border border-zinc-800 rounded-lg p-6 bg-black/20">
            <input v-model="newIssue.title" placeholder="Title" class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 mb-4 focus:outline-none focus:border-emerald-500 text-white">
            <textarea v-model="newIssue.body" placeholder="Leave a comment" rows="10" class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 mb-4 focus:outline-none focus:border-emerald-500 text-white"></textarea>
            <div class="flex justify-end gap-2">
                <button @click="viewMode = 'list'" class="px-4 py-2 text-zinc-400 hover:text-white">Cancel</button>
                <button @click="promptCreateIssue" class="px-4 py-2 bg-emerald-600 rounded-lg text-sm font-bold text-white">Submit New Issue</button>
            </div>
        </div>
    </div>
  </div>
</template>
