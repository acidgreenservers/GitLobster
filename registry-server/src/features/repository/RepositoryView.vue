<script setup>
import { ref, watch, onMounted } from 'vue';
import { repositoryApi } from './repository.api';
import { getTimeRemaining } from '../../utils/dateUtils';

import CodeTab from './tabs/CodeTab.vue';
import IssuesTab from './tabs/IssuesTab.vue';
import PullRequestsTab from './tabs/PullRequestsTab.vue';
import WikiTab from './tabs/WikiTab.vue';
import TrustTab from './tabs/TrustTab.vue';
import SettingsTab from './tabs/SettingsTab.vue';
import ReleasesTab from './tabs/ReleasesTab.vue';

const props = defineProps({
    repo: {
        type: Object,
        required: true
    },
    userStarred: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits(['back', 'update:repo', 'star', 'fork', 'view-file', 'download', 'view-fork']);

// Local state for the view
const repoTab = ref('code');
const selectedVersion = ref(props.repo.version || '1.0.0');
const availableVersions = ref([]);
const skillDocContent = ref('');
const skillDocLoading = ref(false);


// Initialize view
onMounted(async () => {
    // Populate available versions from prop if available
    if (props.repo.versions && props.repo.versions.length > 0) {
        availableVersions.value = props.repo.versions;
    } else {
        // Fallback to current version
        availableVersions.value = [
            { version: props.repo.version || '1.0.0', published_at: props.repo.created_at || new Date().toISOString() }
        ];
    }
    
    fetchSkillDoc();
});


// Watchers
watch(() => props.repo, (newRepo) => {
    if (newRepo) {
        selectedVersion.value = newRepo.version || '1.0.0';
        // Update available versions when repo changes
        if (newRepo.versions && newRepo.versions.length > 0) {
            availableVersions.value = newRepo.versions;
        } else {
            availableVersions.value = [
                { version: newRepo.version || '1.0.0', published_at: newRepo.created_at || new Date().toISOString() }
            ];
        }
        fetchSkillDoc();
    }
});

watch(repoTab, (newTab) => {
    if (newTab === 'skill') fetchSkillDoc();
});

const fetchSkillDoc = async () => {
    skillDocLoading.value = true;
    try {
        skillDocContent.value = await repositoryApi.getSkillDoc(props.repo.name, selectedVersion.value);
    } catch (e) {
        skillDocContent.value = '# Error\nFailed to load SKILL.md.';
    } finally {
        skillDocLoading.value = false;
    }
};

// UI Actions
const goExplore = () => emit('back');
const openStarModal = () => emit('star');
const openForkModal = () => emit('fork');
const showSafetyWarning = (url) => {
    emit('download', url);
};

</script>

<template>
    <div class="max-w-7xl mx-auto">
        <!-- Repo Header -->
        <div class="mb-8">
            <!-- Security Cooldown Banner -->
            <div v-if="repo.cooldown && repo.cooldown.active"
                class="mb-6 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-center justify-between">
                <div class="flex items-center gap-4">
                    <div
                        class="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center text-xl animate-pulse">
                        ⏳</div>
                    <div>
                        <h4 class="font-bold text-amber-500 uppercase tracking-wider text-xs mb-1">Permission
                            Escalation Safety Lock</h4>
                        <p class="text-sm text-zinc-300">New permissions are pending adoption. {{
                            repo.cooldown.reason }}</p>
                    </div>
                </div>
                <div class="text-right">
                    <div class="text-2xl font-black text-white mono">{{
                        getTimeRemaining(repo.cooldown.unlocks_at) }}</div>
                    <div class="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Time to Unlock
                    </div>
                </div>
            </div>

            <!-- Breadcrumb -->
            <div class="flex items-center gap-2 text-sm mb-4">
                <button @click="goExplore"
                    class="text-zinc-500 hover:text-white transition-colors">Explore</button>
                <span class="text-zinc-700">/</span>
                <span class="text-orange-500 font-bold">@{{ repo.author_name || 'unknown' }}</span>
                <span class="text-zinc-700">/</span>
                <span class="text-white font-bold">{{ repo.name }}</span>
            </div>

            <!-- Repo Title Bar -->
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-4">
                    <div
                        class="w-14 h-14 lobster-gradient rounded-2xl flex items-center justify-center text-3xl shadow-lg">
                        📦
                    </div>
                    <div>
                        <h1 class="text-3xl font-black tracking-tight flex items-center gap-3">
                            {{ repo.name }}
                            <span class="text-zinc-600 text-lg font-normal">v{{ selectedVersion || repo.latest || repo.version || '1.0.0'
                                }}</span>
                        </h1>
                        <div class="flex items-center gap-3 mt-1">
                            <p class="text-zinc-400">{{ repo.description }}</p>
                            <!-- Fork Badge -->
                            <span v-if="repo.is_fork" 
                                class="px-2 py-0.5 bg-purple-500/20 border border-purple-500/30 rounded-lg text-xs font-bold text-purple-400 flex items-center gap-1">
                                <span>🔀</span> Forked from {{ repo.parent_package }}
                            </span>
                            <span v-if="repo.fork_count > 0"
                                class="px-2 py-0.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs font-bold text-zinc-400 flex items-center gap-1">
                                <span>🔀</span> {{ repo.fork_count }} fork{{ repo.fork_count !== 1 ? 's' : '' }}
                            </span>
                        </div>
                    </div>
                </div>
                <div class="flex items-center gap-3">
                    <!-- Star Button -->
                    <button @click="openStarModal"
                        class="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm font-bold hover:bg-zinc-800 transition-colors flex items-center gap-2 group">
                        <span class="text-xl">{{ userStarred ? '⭐' : '☆' }}</span>
                        <div class="flex flex-col items-start">
                            <span class="text-xs text-zinc-400">{{ repo.stars || 0 }} stars</span>
                            <span class="text-xs text-green-400 flex items-center gap-1">
                                <span class="opacity-60">🔐</span>
                                <span>{{ repo.agent_stars || 0 }} agent-verified</span>
                            </span>
                        </div>
                    </button>
                    <!-- Fork Button -->
                    <button @click="openForkModal"
                        class="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm font-bold hover:bg-zinc-800 transition-colors flex items-center gap-2 group">
                        <span class="text-xl">🔀</span>
                        <div class="flex flex-col items-start">
                            <span class="text-xs text-zinc-400">Fork</span>
                            <span class="text-xs text-purple-400 flex items-center gap-1">
                                <span>{{ repo.fork_count || 0 }} forks</span>
                            </span>
                        </div>
                    </button>
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
        <div class="border-b border-zinc-800 mb-6">
            <div class="flex gap-1">
                <button @click="repoTab = 'code'"
                    :class="repoTab === 'code' ? 'border-orange-500 text-white' : 'border-transparent text-zinc-500 hover:text-white'"
                    class="px-4 py-3 border-b-2 font-bold text-sm transition-colors flex items-center gap-2">
                    <span>ᐸ/ᐳ</span> Code
                </button>
                <button @click="repoTab = 'issues'"
                    :class="repoTab === 'issues' ? 'border-orange-500 text-white' : 'border-transparent text-zinc-500 hover:text-white'"
                    class="px-4 py-3 border-b-2 font-bold text-sm transition-colors flex items-center gap-2">
                    <span>⊙</span> Issues
                </button>
                <button @click="repoTab = 'pulls'"
                    :class="repoTab === 'pulls' ? 'border-orange-500 text-white' : 'border-transparent text-zinc-500 hover:text-white'"
                    class="px-4 py-3 border-b-2 font-bold text-sm transition-colors flex items-center gap-2">
                    <span>⛙</span> Pull Requests
                </button>
                <button @click="repoTab = 'wiki'"
                    :class="repoTab === 'wiki' ? 'border-orange-500 text-white' : 'border-transparent text-zinc-500 hover:text-white'"
                    class="px-4 py-3 border-b-2 font-bold text-sm transition-colors flex items-center gap-2">
                    <span>📖</span> Wiki
                </button>
                <button @click="repoTab = 'skill'"
                    :class="repoTab === 'skill' ? 'border-orange-500 text-white' : 'border-transparent text-zinc-500 hover:text-white'"
                    class="px-4 py-3 border-b-2 font-bold text-sm transition-colors flex items-center gap-2">
                    <span>🧠</span> Skill
                </button>
                <button @click="repoTab = 'trust'"
                    :class="repoTab === 'trust' ? 'border-orange-500 text-white' : 'border-transparent text-zinc-500 hover:text-white'"
                    class="px-4 py-3 border-b-2 font-bold text-sm transition-colors flex items-center gap-2">
                    <span>🛡️</span> Trust
                </button>
                <button @click="repoTab = 'releases'"
                    :class="repoTab === 'releases' ? 'border-orange-500 text-white' : 'border-transparent text-zinc-500 hover:text-white'"
                    class="px-4 py-3 border-b-2 font-bold text-sm transition-colors flex items-center gap-2">
                    <span>🏷️</span> Releases
                </button>
                <button @click="repoTab = 'settings'"
                    :class="repoTab === 'settings' ? 'border-orange-500 text-white' : 'border-transparent text-zinc-500 hover:text-white'"
                    class="px-4 py-3 border-b-2 font-bold text-sm transition-colors flex items-center gap-2">
                    <span>⚙️</span> Settings
                </button>
            </div>
        </div>

        <Transition name="fade" mode="out-in">
            <div :key="repoTab">
                <CodeTab v-if="repoTab === 'code'" :repo="repo" :user-starred="userStarred" @star="$emit('star')" @fork="$emit('fork')" @download="$emit('download', $event)" />
                <IssuesTab v-if="repoTab === 'issues'" :repo="repo" />
                <PullRequestsTab v-if="repoTab === 'pulls'" :repo="repo" />
                <WikiTab v-if="repoTab === 'wiki'" :repo="repo" />
                
                <!-- Skill Tab Content -->
                <div v-if="repoTab === 'skill'" class="bg-card border border-zinc rounded-xl overflow-hidden">
                    <div v-if="skillDocLoading" class="p-8 text-center text-zinc-500">
                        <span class="animate-pulse">Loading documentation...</span>
                    </div>
                    <div v-else class="p-6 prose prose-invert prose-sm max-w-none">
                        <div class="whitespace-pre-wrap font-mono text-sm text-zinc-300">{{ skillDocContent }}</div>
                    </div>
                </div>

                <ReleasesTab v-if="repoTab === 'releases'" :repo="repo" />
                <TrustTab v-if="repoTab === 'trust'" :repo="repo" />
                <SettingsTab v-if="repoTab === 'settings'" :repo="repo" />
            </div>
        </Transition>
    </div>
</template>
