<script setup>
import { ref, onMounted } from 'vue';
import { repositoryApi } from '../../repository.api';
import { formatDistanceToNow } from 'date-fns';

const props = defineProps({
    repo: { type: Object, required: true }
});

const issues = ref([]);
const loading = ref(true);
const stateFilter = ref('open'); // 'open' or 'closed'
const viewMode = ref('list'); // 'list', 'create', 'detail'
const selectedIssue = ref(null);
const comments = ref([]);

// New Issue Form
const newIssue = ref({ title: '', body: '' });
const newComment = ref('');

const fetchIssues = async () => {
    loading.value = true;
    issues.value = await repositoryApi.getIssues(props.repo.name, stateFilter.value);
    loading.value = false;
};

const openIssue = async (issue) => {
    selectedIssue.value = issue;
    viewMode.value = 'detail';
    comments.value = await repositoryApi.getComments(props.repo.name, issue.number);
};

const createIssue = async () => {
    if (!newIssue.value.title) return;
    const issue = await repositoryApi.createIssue(props.repo.name, newIssue.value.title, newIssue.value.body);
    newIssue.value = { title: '', body: '' };
    viewMode.value = 'list';
    fetchIssues();
};

const submitComment = async () => {
    if (!newComment.value || !selectedIssue.value) return;
    const comment = await repositoryApi.createComment(props.repo.name, selectedIssue.value.number, newComment.value);
    comments.value.push(comment);
    newComment.value = '';
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
                <div v-for="issue in issues" :key="issue.id" class="p-4 hover:bg-zinc-900/50 flex gap-3 cursor-pointer" @click="openIssue(issue)">
                    <span class="text-emerald-500 text-lg">⊙</span>
                    <div class="flex-1">
                        <div class="font-bold text-white mb-1">{{ issue.title }}</div>
                        <div class="text-xs text-zinc-500">
                            #{{ issue.number }} opened {{ formatTime(issue.created_at) }} by {{ issue.author_name }}
                        </div>
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
                <button @click="createIssue" class="px-4 py-2 bg-emerald-600 rounded-lg text-sm font-bold text-white">Submit New Issue</button>
            </div>
        </div>
    </div>

    <!-- Detail View -->
    <div v-if="viewMode === 'detail' && selectedIssue" class="max-w-5xl mx-auto">
        <div class="mb-6 pb-6 border-b border-zinc-800">
            <div class="flex items-center gap-3 mb-2">
                <h1 class="text-3xl font-normal text-white">{{ selectedIssue.title }} <span class="text-zinc-500">#{{ selectedIssue.number }}</span></h1>
            </div>
            <div class="flex items-center gap-2">
                <span class="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-xs font-bold border border-emerald-500/30 flex items-center gap-1">
                    <span>⊙</span> Open
                </span>
                <span class="text-zinc-500 text-sm">{{ selectedIssue.author_name }} opened this issue {{ formatTime(selectedIssue.created_at) }}</span>
            </div>
        </div>

        <div class="flex gap-8 flex-col lg:flex-row">
            <div class="flex-1 space-y-6">
                <!-- Main Body -->
                <div class="border border-zinc-800 rounded-lg overflow-hidden">
                    <div class="bg-zinc-900/50 p-3 border-b border-zinc-800 flex justify-between text-sm text-zinc-400">
                        <b>{{ selectedIssue.author_name }}</b>
                        <span>commented {{ formatTime(selectedIssue.created_at) }}</span>
                    </div>
                    <div class="p-6 bg-black/20 text-zinc-300 whitespace-pre-wrap">
                        {{ selectedIssue.body || 'No description provided.' }}
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
                <button @click="viewMode = 'list'" class="text-sm text-zinc-500 hover:text-white">← Back to issues</button>
                <div class="text-sm text-zinc-500 font-bold uppercase tracking-wider border-t border-zinc-800 pt-4">Assignees</div>
                <div class="text-xs text-zinc-600">No one assigned</div>

                <div class="text-sm text-zinc-500 font-bold uppercase tracking-wider border-t border-zinc-800 pt-4">Labels</div>
                <div class="text-xs text-zinc-600">None yet</div>
            </div>
        </div>
    </div>
  </div>
</template>
