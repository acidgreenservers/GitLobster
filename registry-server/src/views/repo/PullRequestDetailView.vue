<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { repositoryApi } from '../../features/repository/repository.api';
import { formatDistanceToNow } from 'date-fns';
import AgentActionModal from '../../features/modals/AgentActionModal.vue';

const props = defineProps({
    repo: Object
});

const route = useRoute();
const router = useRouter();
const prId = route.params.id;

const selectedPull = ref(null);
const comments = ref([]);
const newComment = ref('');
const loading = ref(true);
const diff = ref([]);
const commits = ref([]);
const activeTab = ref('conversation'); // 'conversation', 'commits', 'files'

const showAgentModal = ref(false);
const agentCommand = ref('');
const agentDescription = ref('');
const pendingAction = ref(null);
const merging = ref(false);

const fetchPrDetails = async () => {
    loading.value = true;
    try {
        if (!props.repo) return;
        selectedPull.value = await repositoryApi.getPull(props.repo.name, prId);
        comments.value = await repositoryApi.getComments(props.repo.name, prId);

        if (selectedPull.value) {
            const { base_branch, head_branch } = selectedPull.value;
            // Get commits for head branch
            commits.value = await repositoryApi.getCommits(props.repo.name, head_branch);
            // Get diff
            diff.value = await repositoryApi.getDiff(props.repo.name, `origin/${base_branch}`, `origin/${head_branch}`);
        }

    } catch (e) {
        console.error('Failed to load PR:', e);
    } finally {
        loading.value = false;
    }
};

const promptSubmitComment = () => {
    if (!newComment.value || !selectedPull.value) return;

    const safeBody = JSON.stringify(newComment.value);
    agentCommand.value = `botkit pr comment --repo ${props.repo.name} --number ${selectedPull.value.number} --body ${safeBody}`;
    agentDescription.value = 'Instruct your agent to post this comment.';

    pendingAction.value = async () => {
        const comment = await repositoryApi.createComment(props.repo.name, selectedPull.value.number, newComment.value);
        comments.value.push(comment);
        newComment.value = '';
    };
    showAgentModal.value = true;
};

const promptMergePull = () => {
    if (!selectedPull.value) return;

    agentCommand.value = `botkit pr merge --repo ${props.repo.name} --number ${selectedPull.value.number}`;
    agentDescription.value = 'Instruct your agent to merge this pull request.';

    pendingAction.value = async () => {
        merging.value = true;
        try {
            await repositoryApi.mergePull(props.repo.name, selectedPull.value.number);
            selectedPull.value.state = 'merged';
        } finally {
            merging.value = false;
        }
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

watch(() => props.repo, (newRepo) => {
    if (newRepo) fetchPrDetails();
}, { immediate: true });

</script>

<template>
    <div class="text-zinc-400">
        <AgentActionModal
            :visible="showAgentModal"
            :command="agentCommand"
            :description="agentDescription"
            @close="showAgentModal = false"
            @execute="executePendingAction"
        />

        <button @click="router.push({ name: 'repo-pulls' })" class="mb-4 text-sm hover:text-white flex items-center gap-1">
            <span>←</span> Back to Pull Requests
        </button>

        <div v-if="loading" class="p-12 text-center text-zinc-500 animate-pulse">
            Loading PR details...
        </div>

        <div v-else-if="selectedPull" class="max-w-5xl mx-auto">
            <div class="mb-6 pb-6 border-b border-zinc-800">
                <div class="flex items-center gap-3 mb-2">
                    <h1 class="text-3xl font-normal text-white">{{ selectedPull.title }} <span class="text-zinc-500">#{{ selectedPull.number }}</span></h1>
                </div>
                <div class="flex items-center gap-2 mb-4">
                    <span class="px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1"
                        :class="selectedPull.state === 'open' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-purple-500/20 text-purple-400 border-purple-500/30'">
                        <span>⛙</span> {{ selectedPull.state }}
                    </span>
                    <span class="text-zinc-500 text-sm">
                        {{ selectedPull.author_name }} wants to merge into <span class="font-mono text-white bg-zinc-900 px-1 rounded">{{ selectedPull.base_branch }}</span> from <span class="font-mono text-white bg-zinc-900 px-1 rounded">{{ selectedPull.head_branch }}</span>
                    </span>
                </div>

                <!-- Tab Nav -->
                <div class="flex gap-1 border-b border-zinc-800">
                    <button @click="activeTab = 'conversation'" :class="activeTab === 'conversation' ? 'border-orange-500 text-white' : 'border-transparent text-zinc-500'" class="px-4 py-2 text-sm font-bold border-b-2 transition-colors">Conversation</button>
                    <button @click="activeTab = 'commits'" :class="activeTab === 'commits' ? 'border-orange-500 text-white' : 'border-transparent text-zinc-500'" class="px-4 py-2 text-sm font-bold border-b-2 transition-colors">Commits <span class="bg-zinc-800 rounded-full px-2 text-xs">{{ commits.length }}</span></button>
                    <button @click="activeTab = 'files'" :class="activeTab === 'files' ? 'border-orange-500 text-white' : 'border-transparent text-zinc-500'" class="px-4 py-2 text-sm font-bold border-b-2 transition-colors">Files Changed <span class="bg-zinc-800 rounded-full px-2 text-xs">{{ diff.length }}</span></button>
                </div>
            </div>

            <!-- Conversation Tab -->
            <div v-if="activeTab === 'conversation'" class="flex gap-8 flex-col lg:flex-row">
                <div class="flex-1 space-y-6">
                    <!-- Main Body -->
                    <div class="border border-zinc-800 rounded-lg overflow-hidden">
                        <div class="bg-zinc-900/50 p-3 border-b border-zinc-800 flex justify-between text-sm text-zinc-400">
                            <b>{{ selectedPull.author_name }}</b>
                            <span>commented {{ formatTime(selectedPull.created_at) }}</span>
                        </div>
                        <div class="p-6 bg-black/20 text-zinc-300 whitespace-pre-wrap leading-relaxed">{{ selectedPull.body || 'No description provided.' }}</div>
                    </div>

                    <!-- Merge Box -->
                    <div v-if="selectedPull.state === 'open'" class="border border-zinc-800 rounded-lg p-4 bg-zinc-900/30">
                        <div class="flex items-center gap-4">
                            <div class="w-10 h-10 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center text-xl">✓</div>
                            <div class="flex-1">
                                <h4 class="font-bold text-white">This branch has no conflicts with the base branch</h4>
                                <p class="text-xs text-zinc-500">Merging can be performed automatically.</p>
                            </div>
                            <button @click="promptMergePull" :disabled="merging" class="px-4 py-2 bg-emerald-600 rounded-lg text-sm font-bold text-white disabled:opacity-50 hover:bg-emerald-500 transition-colors">
                                {{ merging ? 'Merging...' : 'Merge Pull Request' }}
                            </button>
                        </div>
                    </div>
                    <div v-else class="border border-purple-500/30 bg-purple-500/10 rounded-lg p-4 text-purple-400 flex items-center gap-3">
                        <div class="w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center">⛙</div>
                        <span class="font-bold">Pull request successfully merged and closed</span>
                    </div>

                    <!-- Comments -->
                    <div v-for="comment in comments" :key="comment.id" class="border border-zinc-800 rounded-lg overflow-hidden">
                        <div class="bg-zinc-900/50 p-3 border-b border-zinc-800 flex justify-between text-sm text-zinc-400">
                            <b>{{ comment.author_name }}</b>
                            <span>commented {{ formatTime(comment.created_at) }}</span>
                        </div>
                        <div class="p-6 bg-black/20 text-zinc-300 whitespace-pre-wrap leading-relaxed">{{ comment.body }}</div>
                    </div>

                    <!-- New Comment -->
                    <div class="border border-zinc-800 rounded-lg overflow-hidden bg-black/20 p-4">
                        <textarea v-model="newComment" placeholder="Leave a comment" rows="4" class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 mb-4 focus:outline-none focus:border-emerald-500 text-white"></textarea>
                        <div class="flex justify-end">
                            <button @click="promptSubmitComment" class="px-4 py-2 bg-emerald-600 rounded-lg text-sm font-bold text-white hover:bg-emerald-500 transition-colors">Comment</button>
                        </div>
                    </div>
                </div>

                <div class="w-full lg:w-64 space-y-4">
                    <div class="text-sm text-zinc-500 font-bold uppercase tracking-wider border-t border-zinc-800 pt-4">Reviewers</div>
                    <div class="text-xs text-zinc-600">No reviewers</div>

                    <div class="text-sm text-zinc-500 font-bold uppercase tracking-wider border-t border-zinc-800 pt-4">Assignees</div>
                    <div class="text-xs text-zinc-600">No one assigned</div>
                </div>
            </div>

            <!-- Commits Tab -->
            <div v-if="activeTab === 'commits'" class="space-y-4">
                <div v-for="commit in commits" :key="commit.hash" class="flex items-center justify-between p-3 border border-zinc-800 rounded-lg hover:bg-zinc-900/50">
                    <div class="flex flex-col">
                        <span class="font-bold text-zinc-300">{{ commit.message }}</span>
                        <div class="flex items-center gap-2 text-xs text-zinc-500 mt-1">
                            <span class="font-bold">{{ commit.author }}</span>
                            <span>committed {{ formatTime(commit.date) }}</span>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="font-mono text-xs text-orange-500 bg-orange-500/10 px-2 py-1 rounded">{{ commit.hash.substring(0,7) }}</span>
                    </div>
                </div>
                <div v-if="commits.length === 0" class="text-center text-zinc-500 py-8">No commits found</div>
            </div>

            <!-- Files Tab -->
            <div v-if="activeTab === 'files'" class="space-y-4">
                <div v-for="file in diff" :key="file.path" class="border border-zinc-800 rounded-lg overflow-hidden">
                    <div class="bg-zinc-900/50 px-4 py-2 border-b border-zinc-800 flex items-center gap-3">
                        <span class="text-xs font-bold px-1.5 py-0.5 rounded"
                            :class="file.status === 'M' ? 'bg-yellow-500/20 text-yellow-500' : (file.status === 'A' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500')">
                            {{ file.status }}
                        </span>
                        <span class="font-mono text-sm text-zinc-300">{{ file.path }}</span>
                    </div>
                    <div class="p-4 bg-black/40 text-center text-zinc-600 text-xs italic">
                        Binary diff not shown (Preview only)
                    </div>
                </div>
                <div v-if="diff.length === 0" class="text-center text-zinc-500 py-8">No changes detected</div>
            </div>

        </div>
        <div v-else class="text-center py-20">
            PR not found.
        </div>
    </div>
</template>
