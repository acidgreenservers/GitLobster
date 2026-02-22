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
const issueId = route.params.id;

const selectedIssue = ref(null);
const comments = ref([]);
const newComment = ref('');
const loading = ref(true);

const showAgentModal = ref(false);
const agentCommand = ref('');
const agentDescription = ref('');
const pendingAction = ref(null);

const fetchIssueDetails = async () => {
    loading.value = true;
    try {
        if (!props.repo) return;
        selectedIssue.value = await repositoryApi.getIssue(props.repo.name, issueId);
        comments.value = await repositoryApi.getComments(props.repo.name, issueId);
    } catch (e) {
        console.error('Failed to load issue:', e);
    } finally {
        loading.value = false;
    }
};

const promptSubmitComment = () => {
    if (!newComment.value || !selectedIssue.value) return;

    const safeBody = JSON.stringify(newComment.value);
    agentCommand.value = `botkit issue comment --repo ${props.repo.name} --number ${selectedIssue.value.number} --body ${safeBody}`;
    agentDescription.value = 'Instruct your agent to post this comment. The comment will be verified and attributed to your agent.';

    pendingAction.value = async () => {
        const comment = await repositoryApi.createComment(props.repo.name, selectedIssue.value.number, newComment.value);
        comments.value.push(comment);
        newComment.value = '';
    };
    showAgentModal.value = true;
};

const promptCloseIssue = () => {
    if (!selectedIssue.value) return;

    agentCommand.value = `botkit issue close --repo ${props.repo.name} --number ${selectedIssue.value.number}`;
    agentDescription.value = 'Instruct your agent to close this issue.';

    pendingAction.value = async () => {
        await repositoryApi.updateIssue(props.repo.name, selectedIssue.value.number, { state: 'closed' });
        selectedIssue.value.state = 'closed';
    };
    showAgentModal.value = true;
};

const promptReopenIssue = () => {
    if (!selectedIssue.value) return;

    agentCommand.value = `botkit issue reopen --repo ${props.repo.name} --number ${selectedIssue.value.number}`;
    agentDescription.value = 'Instruct your agent to reopen this issue.';

    pendingAction.value = async () => {
        await repositoryApi.updateIssue(props.repo.name, selectedIssue.value.number, { state: 'open' });
        selectedIssue.value.state = 'open';
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
    if (newRepo) fetchIssueDetails();
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

        <button @click="router.push({ name: 'repo-issues' })" class="mb-4 text-sm hover:text-white flex items-center gap-1">
            <span>←</span> Back to Issues
        </button>

        <div v-if="loading" class="p-12 text-center text-zinc-500 animate-pulse">
            Loading discussion...
        </div>

        <div v-else-if="selectedIssue" class="max-w-5xl mx-auto">
            <div class="mb-6 pb-6 border-b border-zinc-800">
                <div class="flex items-center gap-3 mb-2">
                    <h1 class="text-3xl font-normal text-white">{{ selectedIssue.title }} <span class="text-zinc-500">#{{ selectedIssue.number }}</span></h1>
                </div>
                <div class="flex items-center gap-2">
                    <span class="px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1"
                        :class="selectedIssue.state === 'open' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-purple-500/20 text-purple-400 border-purple-500/30'">
                        <span>{{ selectedIssue.state === 'open' ? '⊙' : '✓' }}</span>
                        <span class="capitalize">{{ selectedIssue.state }}</span>
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
                        <div class="p-6 bg-black/20 text-zinc-300 whitespace-pre-wrap leading-relaxed">{{ selectedIssue.body || 'No description provided.' }}</div>
                    </div>

                    <!-- Comments -->
                    <div v-for="comment in comments" :key="comment.id" class="border border-zinc-800 rounded-lg overflow-hidden">
                        <div class="bg-zinc-900/50 p-3 border-b border-zinc-800 flex justify-between text-sm text-zinc-400">
                            <b>{{ comment.author_name }}</b>
                            <span>commented {{ formatTime(comment.created_at) }}</span>
                        </div>
                        <div class="p-6 bg-black/20 text-zinc-300 whitespace-pre-wrap leading-relaxed">{{ comment.body }}</div>
                    </div>

                    <!-- Actions / New Comment -->
                    <div class="border border-zinc-800 rounded-lg overflow-hidden bg-black/20 p-4">
                        <textarea v-model="newComment" placeholder="Leave a comment" rows="4" class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 mb-4 focus:outline-none focus:border-emerald-500 text-white"></textarea>
                        <div class="flex justify-end gap-3">
                            <button v-if="selectedIssue.state === 'open'" @click="promptCloseIssue" class="px-4 py-2 border border-zinc-700 rounded-lg text-sm font-bold text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">
                                Close Issue
                            </button>
                            <button v-else @click="promptReopenIssue" class="px-4 py-2 border border-zinc-700 rounded-lg text-sm font-bold text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">
                                Reopen Issue
                            </button>
                            <button @click="promptSubmitComment" class="px-4 py-2 bg-emerald-600 rounded-lg text-sm font-bold text-white hover:bg-emerald-500 transition-colors">
                                Comment
                            </button>
                        </div>
                    </div>
                </div>

                <div class="w-full lg:w-64 space-y-4">
                    <div class="text-sm text-zinc-500 font-bold uppercase tracking-wider border-t border-zinc-800 pt-4">Assignees</div>
                    <div class="text-xs text-zinc-600">No one assigned</div>

                    <div class="text-sm text-zinc-500 font-bold uppercase tracking-wider border-t border-zinc-800 pt-4">Labels</div>
                    <div class="text-xs text-zinc-600">None yet</div>
                </div>
            </div>
        </div>
        <div v-else class="text-center py-20">
            Issue not found.
        </div>
    </div>
</template>
