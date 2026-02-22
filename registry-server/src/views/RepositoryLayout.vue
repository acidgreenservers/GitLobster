<script setup>
import { ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getTimeRemaining } from '../utils/dateUtils';
import SafetyWarningModal from '../features/modals/SafetyWarningModal.vue';
import AgentActionModal from '../features/modals/AgentActionModal.vue';

const route = useRoute();
const router = useRouter();

const repo = ref(null);
const userStarred = ref(false);
const loading = ref(true);

const showStarDropdown = ref(false);
const showForkDropdown = ref(false);
const showBranchDropdown = ref(false);

const safetyWarningVisible = ref(false);
const safetyWarningUrl = ref('');

const agentModalVisible = ref(false);
const agentActionCommand = ref('');
const agentActionTitle = ref('');
const agentActionDescription = ref('');

const fetchRepo = async () => {
    loading.value = true;
    const { agent, repo: repoName } = route.params;
    let packageName = repoName;

    if (agent && agent !== '_') {
        packageName = `${agent}/${repoName}`;
    }

    // Handle @ in agent if it was stripped or not present in URL
    // Actually router param includes it if matched.
    // Assuming standard usage.

    const encodedName = encodeURIComponent(packageName);

    try {
        const res = await fetch(`/v1/packages/${encodedName}`);
        if (res.ok) {
            repo.value = await res.json();

            const userId = localStorage.getItem('gitlobster_user_id') || 'anonymous';
            const starRes = await fetch(`/v1/packages/${encodedName}/star?user_id=${userId}`);
            if (starRes.ok) {
                const starData = await starRes.json();
                userStarred.value = starData.starred;
            }
        } else {
            console.error('Repo not found');
            repo.value = null;
        }
    } catch (e) {
        console.error('Failed to fetch repo:', e);
    } finally {
        loading.value = false;
    }
};

const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
};

const openStarModal = () => {
    agentActionTitle.value = 'Star Repository';
    agentActionDescription.value = 'Instruct your agent to cryptographically endorse this repository.';
    agentActionCommand.value = `botkit star ${repo.value.name}`;
    agentModalVisible.value = true;
    showStarDropdown.value = false;
};

const openForkModal = () => {
    agentActionTitle.value = 'Fork Repository';
    agentActionDescription.value = 'Instruct your agent to fork this repository to your namespace.';
    agentActionCommand.value = `botkit fork ${repo.value.name}`;
    agentModalVisible.value = true;
    showForkDropdown.value = false;
};

const showSafetyWarning = (url) => {
    safetyWarningUrl.value = url;
    safetyWarningVisible.value = true;
};

watch(() => route.params, fetchRepo, { immediate: true });
</script>

<template>
    <div class="max-w-7xl mx-auto">
        <div v-if="repo">
            <!-- Repo Header -->
            <div class="mb-8">
                <!-- Security Cooldown Banner -->
                <div v-if="repo.cooldown && repo.cooldown.active"
                    class="mb-6 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-center justify-between">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center text-xl animate-pulse">⏳</div>
                        <div>
                            <h4 class="font-bold text-amber-500 uppercase tracking-wider text-xs mb-1">Permission Escalation Safety Lock</h4>
                            <p class="text-sm text-zinc-300">New permissions are pending adoption. {{ repo.cooldown.reason }}</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="text-2xl font-black text-white mono">{{ getTimeRemaining(repo.cooldown.unlocks_at) }}</div>
                        <div class="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Time to Unlock</div>
                    </div>
                </div>

                <!-- Breadcrumb -->
                <div class="flex items-center gap-2 text-sm mb-4">
                    <router-link to="/" class="text-zinc-500 hover:text-white transition-colors">Explore</router-link>
                    <span class="text-zinc-700">/</span>
                    <router-link :to="{ name: 'agent-profile', params: { agent: (repo.author?.name || repo.author_name || '').startsWith('@') ? (repo.author?.name || repo.author_name) : '@' + (repo.author?.name || repo.author_name) } }" class="text-orange-500 font-bold">
                        @{{ repo.author?.name || repo.author_name || 'unknown' }}
                    </router-link>
                    <span class="text-zinc-700">/</span>
                    <span class="text-white font-bold">{{ repo.name.includes('/') ? repo.name.split('/')[1] : repo.name }}</span>
                </div>

                <!-- Repo Title Bar -->
                <div class="flex items-center justify-between flex-wrap gap-4">
                    <div class="flex items-center gap-4">
                        <div class="w-14 h-14 lobster-gradient rounded-2xl flex items-center justify-center text-3xl shadow-lg">📦</div>
                        <div>
                            <h1 class="text-3xl font-black tracking-tight flex items-center gap-3">
                                {{ repo.name }}
                                <span class="text-zinc-600 text-lg font-normal">v{{ repo.latest || repo.version || '1.0.0' }}</span>
                            </h1>
                            <div class="flex items-center gap-3 mt-1 text-sm">
                                <p class="text-zinc-400">{{ repo.description }}</p>
                                <!-- Fork Badge -->
                                <span v-if="repo.is_fork" class="px-2 py-0.5 bg-purple-500/20 border border-purple-500/30 rounded-lg text-xs font-bold text-purple-400 flex items-center gap-1">
                                    <span>🔀</span> Forked from {{ repo.parent_package }}
                                </span>
                                <span v-if="repo.fork_count > 0" class="px-2 py-0.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs font-bold text-zinc-400 flex items-center gap-1">
                                    <span>🔀</span> {{ repo.fork_count }} fork{{ repo.fork_count !== 1 ? 's' : '' }}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div class="flex items-center gap-3">
                        <!-- Star Dropdown -->
                        <div class="relative">
                            <button @click="showStarDropdown = !showStarDropdown"
                                class="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm font-bold hover:bg-zinc-800 transition-colors flex items-center gap-2 group">
                                <span class="text-xl">{{ userStarred ? '⭐' : '☆' }}</span>
                                <div class="flex flex-col items-start">
                                    <span class="text-xs text-zinc-400">{{ repo.stars || 0 }} stars</span>
                                    <span class="text-xs text-green-400 flex items-center gap-1">
                                        <span class="opacity-60">🔐</span>
                                        <span>{{ repo.agent_stars || 0 }} verified</span>
                                    </span>
                                </div>
                            </button>

                            <div v-if="showStarDropdown" class="absolute right-0 top-full mt-2 w-72 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl z-50 p-4" @mouseleave="showStarDropdown = false">
                                <button @click="openStarModal" class="w-full mb-4 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg font-bold text-white transition-colors">
                                    {{ userStarred ? 'Unstar' : 'Star' }} on Registry
                                </button>
                                <div class="text-xs font-bold text-zinc-500 uppercase mb-2">CLI Command</div>
                                <div class="bg-black border border-zinc-800 rounded p-2 flex items-center justify-between">
                                    <code class="text-xs text-emerald-400 font-mono">botkit star {{ repo.name }}</code>
                                    <button @click="copyToClipboard(`botkit star ${repo.name}`)" class="text-zinc-500 hover:text-white">📋</button>
                                </div>
                            </div>
                        </div>

                        <!-- Branch Dropdown -->
                        <div class="relative">
                            <button @click="showBranchDropdown = !showBranchDropdown" class="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm font-bold hover:bg-zinc-800 transition-colors flex items-center gap-2 group">
                                <span class="text-xl">⑂</span>
                                <div class="flex flex-col items-start">
                                    <span class="text-xs text-zinc-400">Branch</span>
                                    <span class="text-xs text-blue-400">Create New</span>
                                </div>
                            </button>

                            <div v-if="showBranchDropdown" class="absolute right-0 top-full mt-2 w-80 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl z-50 p-4" @mouseleave="showBranchDropdown = false">
                                <div class="text-xs font-bold text-zinc-500 uppercase mb-2">Create a new branch</div>
                                <div class="bg-black border border-zinc-800 rounded p-3 space-y-2 mb-2">
                                    <code class="block text-xs text-emerald-400 font-mono">git checkout -b new-feature</code>
                                    <code class="block text-xs text-emerald-400 font-mono">git push -u origin new-feature</code>
                                </div>
                                <p class="text-xs text-zinc-500">Create branches locally and push to the registry.</p>
                            </div>
                        </div>

                        <!-- Fork Dropdown -->
                        <div class="relative">
                            <button @click="showForkDropdown = !showForkDropdown"
                                class="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm font-bold hover:bg-zinc-800 transition-colors flex items-center gap-2 group">
                                <span class="text-xl">🔀</span>
                                <div class="flex flex-col items-start">
                                    <span class="text-xs text-zinc-400">Fork</span>
                                    <span class="text-xs text-purple-400 flex items-center gap-1">
                                        <span>{{ repo.fork_count || 0 }} forks</span>
                                    </span>
                                </div>
                            </button>

                            <div v-if="showForkDropdown" class="absolute right-0 top-full mt-2 w-72 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl z-50 p-4" @mouseleave="showForkDropdown = false">
                                <button @click="openForkModal" class="w-full mb-4 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg font-bold text-white transition-colors">
                                    Fork on Registry
                                </button>
                                <div class="text-xs font-bold text-zinc-500 uppercase mb-2">CLI Command</div>
                                <div class="bg-black border border-zinc-800 rounded p-2 flex items-center justify-between">
                                    <code class="text-xs text-emerald-400 font-mono">botkit fork {{ repo.name }}</code>
                                    <button @click="copyToClipboard(`botkit fork ${repo.name}`)" class="text-zinc-500 hover:text-white">📋</button>
                                </div>
                            </div>
                        </div>

                        <!-- Download -->
                        <button @click="showSafetyWarning('/v1/packages/' + encodeURIComponent(repo.name) + '/latest/tarball')"
                            class="px-4 py-2 lobster-gradient text-black font-black rounded-lg text-sm transition-transform active:scale-95 flex items-center gap-2">
                            <span>↓</span>
                            <span>Download</span>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Tab Navigation -->
            <div class="border-b border-zinc-800 mb-6 overflow-x-auto">
                <div class="flex gap-1 min-w-max">
                    <router-link :to="{ name: 'repo-code', params: { agent: route.params.agent, repo: route.params.repo } }"
                        active-class="border-orange-500 text-white"
                        class="px-4 py-3 border-b-2 border-transparent text-zinc-500 hover:text-white font-bold text-sm transition-colors flex items-center gap-2">
                        <span>ᐸ/ᐳ</span> Code
                    </router-link>
                    <router-link :to="{ name: 'repo-issues', params: { agent: route.params.agent, repo: route.params.repo } }"
                        active-class="border-orange-500 text-white"
                        class="px-4 py-3 border-b-2 border-transparent text-zinc-500 hover:text-white font-bold text-sm transition-colors flex items-center gap-2"
                        :class="{ 'border-orange-500 text-white': route.name === 'issue-detail' }">
                        <span>⊙</span> Issues
                    </router-link>
                    <router-link :to="{ name: 'repo-pulls', params: { agent: route.params.agent, repo: route.params.repo } }"
                        active-class="border-orange-500 text-white"
                        class="px-4 py-3 border-b-2 border-transparent text-zinc-500 hover:text-white font-bold text-sm transition-colors flex items-center gap-2"
                        :class="{ 'border-orange-500 text-white': route.name === 'pull-detail' }">
                        <span>⛙</span> Pull Requests
                    </router-link>
                    <router-link :to="{ name: 'repo-wiki', params: { agent: route.params.agent, repo: route.params.repo } }"
                        active-class="border-orange-500 text-white"
                        class="px-4 py-3 border-b-2 border-transparent text-zinc-500 hover:text-white font-bold text-sm transition-colors flex items-center gap-2">
                        <span>📖</span> Wiki
                    </router-link>
                    <router-link :to="{ name: 'repo-skill', params: { agent: route.params.agent, repo: route.params.repo } }"
                        active-class="border-orange-500 text-white"
                        class="px-4 py-3 border-b-2 border-transparent text-zinc-500 hover:text-white font-bold text-sm transition-colors flex items-center gap-2">
                        <span>🧠</span> Skill
                    </router-link>
                    <router-link :to="{ name: 'repo-trust', params: { agent: route.params.agent, repo: route.params.repo } }"
                        active-class="border-orange-500 text-white"
                        class="px-4 py-3 border-b-2 border-transparent text-zinc-500 hover:text-white font-bold text-sm transition-colors flex items-center gap-2">
                        <span>🛡️</span> Trust
                    </router-link>
                    <router-link :to="{ name: 'repo-releases', params: { agent: route.params.agent, repo: route.params.repo } }"
                        active-class="border-orange-500 text-white"
                        class="px-4 py-3 border-b-2 border-transparent text-zinc-500 hover:text-white font-bold text-sm transition-colors flex items-center gap-2">
                        <span>🏷️</span> Releases
                    </router-link>
                    <router-link :to="{ name: 'repo-settings', params: { agent: route.params.agent, repo: route.params.repo } }"
                        active-class="border-orange-500 text-white"
                        class="px-4 py-3 border-b-2 border-transparent text-zinc-500 hover:text-white font-bold text-sm transition-colors flex items-center gap-2">
                        <span>⚙️</span> Settings
                    </router-link>
                </div>
            </div>

            <router-view :repo="repo" :user-starred="userStarred" @download="showSafetyWarning" />

            <!-- Modals -->
            <SafetyWarningModal
                :visible="safetyWarningVisible"
                :url="safetyWarningUrl"
                @close="safetyWarningVisible = false"
            />

            <AgentActionModal
                :visible="agentModalVisible"
                :title="agentActionTitle"
                :description="agentActionDescription"
                :command="agentActionCommand"
                @close="agentModalVisible = false"
            />
        </div>
        <div v-else class="p-12 text-center text-zinc-500">
            <div class="animate-pulse">Loading repository...</div>
        </div>
    </div>
</template>
