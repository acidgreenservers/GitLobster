<script setup>
import { ref, onMounted } from 'vue';
import { repositoryApi } from '../repository.api';
import { formatDistanceToNow } from 'date-fns';

const props = defineProps({
    repo: { type: Object, required: true }
});

const pulls = ref([]);
const loading = ref(true);
const stateFilter = ref('open');
const viewMode = ref('list');
const selectedPull = ref(null);
const comments = ref([]);
const branches = ref([]);
const merging = ref(false);

const newPull = ref({ title: '', body: '', base: 'main', head: '' });
const newComment = ref('');

const fetchPulls = async () => {
    loading.value = true;
    pulls.value = await repositoryApi.getPulls(props.repo.name, stateFilter.value);
    loading.value = false;
};

const fetchBranches = async () => {
    branches.value = await repositoryApi.getBranches(props.repo.name);
    if (branches.value.length > 0) newPull.value.head = branches.value[0];
};

const openPull = async (pull) => {
    selectedPull.value = pull;
    viewMode.value = 'detail';
    comments.value = await repositoryApi.getComments(props.repo.name, pull.number);
};

const createPull = async () => {
    if (!newPull.value.title || !newPull.value.head) return;
    const pull = await repositoryApi.createPull(props.repo.name, newPull.value.title, newPull.value.body, newPull.value.base, newPull.value.head);
    newPull.value = { title: '', body: '', base: 'main', head: '' };
    viewMode.value = 'list';
    fetchPulls();
};

const submitComment = async () => {
    if (!newComment.value || !selectedPull.value) return;
    const comment = await repositoryApi.createComment(props.repo.name, selectedPull.value.number, newComment.value);
    comments.value.push(comment);
    newComment.value = '';
};

const mergePull = async () => {
    if (!selectedPull.value) return;
    merging.value = true;
    try {
        await repositoryApi.mergePull(props.repo.name, selectedPull.value.number);
        selectedPull.value.state = 'merged'; // Optimistic update
        // Optionally refresh
        await fetchPulls();
        viewMode.value = 'list';
    } catch (e) {
        console.error(e);
        alert('Merge failed: ' + e.message);
    } finally {
        merging.value = false;
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
                <div v-for="pull in pulls" :key="pull.id" class="p-4 hover:bg-zinc-900/50 flex gap-3 cursor-pointer" @click="openPull(pull)">
                    <span class="text-emerald-500 text-lg">⛙</span>
                    <div class="flex-1">
                        <div class="font-bold text-white mb-1">{{ pull.title }}</div>
                        <div class="text-xs text-zinc-500">
                            #{{ pull.number }} opened {{ formatTime(pull.created_at) }} by {{ pull.author_name }} • {{ pull.head_branch }} into {{ pull.base_branch }}
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
                <button @click="createPull" class="px-4 py-2 bg-emerald-600 rounded-lg text-sm font-bold text-white">Create Pull Request</button>
            </div>
        </div>
    </div>

    <!-- Detail View -->
    <div v-if="viewMode === 'detail' && selectedPull" class="max-w-5xl mx-auto">
        <div class="mb-6 pb-6 border-b border-zinc-800">
            <div class="flex items-center gap-3 mb-2">
                <h1 class="text-3xl font-normal text-white">{{ selectedPull.title }} <span class="text-zinc-500">#{{ selectedPull.number }}</span></h1>
            </div>
            <div class="flex items-center gap-2 mb-4">
                <span class="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-xs font-bold border border-emerald-500/30 flex items-center gap-1">
                    <span>⛙</span> Open
                </span>
                <span class="text-zinc-500 text-sm">{{ selectedPull.author_name }} wants to merge into <span class="font-mono text-white">{{ selectedPull.base_branch }}</span> from <span class="font-mono text-white">{{ selectedPull.head_branch }}</span></span>
            </div>
        </div>

        <div class="flex gap-8 flex-col lg:flex-row">
            <div class="flex-1 space-y-6">
                <!-- Main Body -->
                <div class="border border-zinc-800 rounded-lg overflow-hidden">
                    <div class="bg-zinc-900/50 p-3 border-b border-zinc-800 flex justify-between text-sm text-zinc-400">
                        <b>{{ selectedPull.author_name }}</b>
                        <span>commented {{ formatTime(selectedPull.created_at) }}</span>
                    </div>
                    <div class="p-6 bg-black/20 text-zinc-300 whitespace-pre-wrap">
                        {{ selectedPull.body || 'No description provided.' }}
                    </div>
                </div>

                <!-- Merge Button Placeholder -->
                <div class="border border-zinc-800 rounded-lg p-4 bg-zinc-900/30">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center text-xl">✓</div>
                        <div class="flex-1">
                            <h4 class="font-bold text-white">This branch has no conflicts with the base branch</h4>
                            <p class="text-xs text-zinc-500">Merging can be performed automatically.</p>
                        </div>
                        <button @click="mergePull" :disabled="merging" class="px-4 py-2 bg-emerald-600 rounded-lg text-sm font-bold text-white disabled:opacity-50">
                            {{ merging ? 'Merging...' : 'Merge Pull Request' }}
                        </button>
                    </div>
                </div>

                <!-- Comments -->
                <div v-for="comment in comments" :key="comment.id" class="border border-zinc-800 rounded-lg overflow-hidden">
                    <div class="bg-zinc-900/50 p-3 border-b border-zinc-800 flex justify-between text-sm text-zinc-400">
                        <b>{{ comment.author_name }}</b>
                        <span>commented {{ formatTime(comment.created_at) }}</span>
                    </div>
                    <div class="p-6 bg-black/20 text-zinc-300 whitespace-pre-wrap">{{ comment.body }}</div>
                </div>

                <!-- New Comment -->
                <div class="border border-zinc-800 rounded-lg overflow-hidden bg-black/20 p-4">
                    <textarea v-model="newComment" placeholder="Leave a comment" rows="4" class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 mb-4 focus:outline-none focus:border-emerald-500 text-white"></textarea>
                    <div class="flex justify-end">
                        <button @click="submitComment" class="px-4 py-2 bg-emerald-600 rounded-lg text-sm font-bold text-white">Comment</button>
                    </div>
                </div>
            </div>

            <div class="w-full lg:w-64 space-y-4">
                <button @click="viewMode = 'list'" class="text-sm text-zinc-500 hover:text-white">← Back to pull requests</button>
                <div class="text-sm text-zinc-500 font-bold uppercase tracking-wider border-t border-zinc-800 pt-4">Reviewers</div>
                <div class="text-xs text-zinc-600">No reviewers</div>

                <div class="text-sm text-zinc-500 font-bold uppercase tracking-wider border-t border-zinc-800 pt-4">Assignees</div>
                <div class="text-xs text-zinc-600">No one assigned</div>
            </div>
        </div>
    </div>
  </div>
</template>
