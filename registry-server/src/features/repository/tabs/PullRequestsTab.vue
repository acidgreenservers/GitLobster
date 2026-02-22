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

const pulls = ref([]);
const loading = ref(true);
const stateFilter = ref('open');
const viewMode = ref('list');
const branches = ref([]);

const newPull = ref({ title: '', body: '', base: 'main', head: '' });

// Agent Mediation
const showAgentModal = ref(false);
const agentCommand = ref('');
const agentDescription = ref('');
const pendingAction = ref(null);

const fetchPulls = async () => {
    loading.value = true;
    pulls.value = await repositoryApi.getPulls(props.repo.name, stateFilter.value);
    loading.value = false;
};

const fetchBranches = async () => {
    branches.value = await repositoryApi.getBranches(props.repo.name);
    if (branches.value.length > 0) newPull.value.head = branches.value[0];
};

const openPull = (pull) => {
    router.push({
        name: 'pull-detail',
        params: {
            agent: route.params.agent,
            repo: route.params.repo,
            id: pull.number
        }
    });
};

const promptCreatePull = () => {
    if (!newPull.value.title || !newPull.value.head) return;

    // Agent command
    const safeTitle = JSON.stringify(newPull.value.title);
    const safeBody = JSON.stringify(newPull.value.body);
    agentCommand.value = `botkit pr create --repo ${props.repo.name} --title ${safeTitle} --body ${safeBody} --base ${newPull.value.base} --head ${newPull.value.head}`;
    agentDescription.value = 'Instruct your agent to open this pull request.';

    pendingAction.value = async () => {
        await repositoryApi.createPull(props.repo.name, newPull.value.title, newPull.value.body, newPull.value.base, newPull.value.head);
        newPull.value = { title: '', body: '', base: 'main', head: '' };
        viewMode.value = 'list';
        fetchPulls();
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

onMounted(async () => {
    await fetchPulls();
    await fetchBranches();
});
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
                <button @click="stateFilter = 'open'; fetchPulls()" :class="stateFilter === 'open' ? 'font-bold text-white' : 'text-zinc-500'">Open</button>
                <button @click="stateFilter = 'closed'; fetchPulls()" :class="stateFilter === 'closed' ? 'font-bold text-white' : 'text-zinc-500'">Closed</button>
            </div>
            <button @click="viewMode = 'create'" class="px-4 py-2 bg-emerald-600 rounded-lg text-sm font-bold text-white">New Pull Request</button>
        </div>

        <div class="border border-zinc-800 rounded-lg overflow-hidden">
            <div v-if="pulls.length === 0" class="p-8 text-center text-zinc-500">
                No pull requests found.
            </div>
            <div v-else class="divide-y divide-zinc-800 bg-black/20">
                <div v-for="pull in pulls" :key="pull.id" class="p-4 hover:bg-zinc-900/50 flex gap-3 cursor-pointer group transition-all duration-200" @click="openPull(pull)">
                    <span class="text-emerald-500 text-lg group-hover:scale-110 transition-transform">⛙</span>
                    <div class="flex-1">
                        <div class="font-bold text-white mb-1 group-hover:text-emerald-400 transition-colors">{{ pull.title }}</div>
                        <div class="text-xs text-zinc-500">
                            #{{ pull.number }} opened {{ formatTime(pull.created_at) }} by <span class="text-zinc-400">{{ pull.author_name }}</span> • {{ pull.head_branch }} into {{ pull.base_branch }}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Create View -->
    <div v-if="viewMode === 'create'" class="max-w-4xl mx-auto">
        <h2 class="text-xl font-bold mb-6">Create New Pull Request</h2>
        <div class="border border-zinc-800 rounded-lg p-6 bg-black/20">
            <div class="flex gap-4 mb-4">
                <div class="flex-1">
                    <label class="block text-xs font-bold text-zinc-500 mb-1">Base Branch</label>
                    <select v-model="newPull.base" class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 focus:outline-none focus:border-emerald-500 text-white">
                        <option v-for="b in branches" :key="b" :value="b">{{ b }}</option>
                    </select>
                </div>
                <div class="flex-1">
                    <label class="block text-xs font-bold text-zinc-500 mb-1">Head Branch</label>
                    <select v-model="newPull.head" class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 focus:outline-none focus:border-emerald-500 text-white">
                        <option v-for="b in branches" :key="b" :value="b">{{ b }}</option>
                    </select>
                </div>
            </div>
            <input v-model="newPull.title" placeholder="Title" class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 mb-4 focus:outline-none focus:border-emerald-500 text-white">
            <textarea v-model="newPull.body" placeholder="Describe your changes..." rows="10" class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 mb-4 focus:outline-none focus:border-emerald-500 text-white"></textarea>
            <div class="flex justify-end gap-2">
                <button @click="viewMode = 'list'" class="px-4 py-2 text-zinc-400 hover:text-white">Cancel</button>
                <button @click="promptCreatePull" class="px-4 py-2 bg-emerald-600 rounded-lg text-sm font-bold text-white">Create Pull Request</button>
            </div>
        </div>
    </div>
  </div>
</template>
