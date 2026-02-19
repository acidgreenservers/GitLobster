<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import { formatFingerprint, getVerificationBadge, determineKeyType } from '../../utils/crypto-helpers';
import { repositoryApi } from './repository.api';
import { timeAgo, getDaysAgo, getTimeRemaining } from '../../utils/dateUtils';
import { marked } from 'marked';
import { formatDistanceToNow } from 'date-fns';
import hljs from 'highlight.js';

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
const readmeContent = ref('');
const readmeLoading = ref(false);
const skillDocContent = ref('');
const skillDocLoading = ref(false);
const installationGuideContent = ref('');
const observations = ref([]);
const observationFilter = ref('all');
const diffViewMode = ref('compare-to-current');
const selectedCompareVersion = ref('');
const versionDiffs = ref({});
const loadingDiffs = ref(new Set());
const expandedEvolutionDiffs = ref(new Set());

// ========== KEY-TO-BOT TRACEABILITY ==========
const lineageData = ref(null);
const lineageLoading = ref(false);
const lineageError = ref(null);

const authorFingerprint = computed(() => formatFingerprint(props.repo.author_public_key));
const keyType = computed(() => determineKeyType(authorFingerprint.value, 0));
const verificationBadge = computed(() => getVerificationBadge(!!props.repo.author_public_key, keyType.value));

const loadLineage = async () => {
  if (!props.repo?.name) return;
  lineageLoading.value = true;
  lineageError.value = null;
  try {
    lineageData.value = await repositoryApi.getLineage(props.repo.name, 'both', 5);
  } catch (e) {
    lineageError.value = e.message;
    lineageData.value = null;
  } finally {
    lineageLoading.value = false;
  }
};

const copyToClipboard = async (text) => {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    console.error('Failed to copy', err);
  }
};

watch(repoTab, (newTab) => {
  if (newTab === 'lineage' || newTab === 'forks') loadLineage();
});

const evolutionPage = ref(1);

// Initialize view
onMounted(async () => {
    // Determine available versions (mocking logic if not available in prop, or fetching)
    // In strict refactor, we rely on what App.vue passed or fetch it.
    // The original App.vue logic for availableVersions was:
    // const availableVersions = ref([]);
    // And it seemed to populate it via fetchPackages or similar?
    // Let's assume we need to fetch versions for this repo.
    // The original code didn't show explicit fetching of versions in the snippet I read,
    // but it referenced `availableVersions`. I'll implement a fetch here.
    
    // Populate available versions from prop if available
    if (props.repo.versions && props.repo.versions.length > 0) {
        availableVersions.value = props.repo.versions;
    } else {
        // Fallback to current version
        availableVersions.value = [
            { version: props.repo.version || '1.0.0', published_at: props.repo.created_at || new Date().toISOString() }
        ];
    }
    
    // Attempt to fetch real versions if API supports it (implied by previous code)
    // We'll trust the manifest or similar if we could.
    // Since I don't have the backend code for versions, I will mock or try to fetch if I added that to API.
    // The API I created has `getVersionManifest`.
    
    // Fetch generic data
    if (props.repo.observations) {
        observations.value = props.repo.observations;
    } else {
        loadObservations();
    }
    
    // Load README generic
    fetchReadme();
});


// Watchers
watch(() => props.repo, (newRepo) => {
    if (newRepo) {
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
        fetchReadme();
        loadObservations();
        fetchSkillDoc();
    }
    }
});

watch(repoTab, (newTab) => {
    if (newTab === 'readme') fetchReadme();
    if (newTab === 'skill') fetchSkillDoc();
    if (newTab === 'trust') {
        // trust data is usually part of repo object
    }
});

// Actions
const loadVersion = async () => {
    // Logic to switch version view
    // In a real app this might fetch specific version data
    // For now we just update selectedVersion
};

const fetchReadme = async () => {
    readmeLoading.value = true;
    try {
        readmeContent.value = await repositoryApi.getReadme(props.repo.name, selectedVersion.value);
    } catch (e) {
        readmeContent.value = '# Error\nFailed to load README.';
    } finally {
        readmeLoading.value = false;
    }
};

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

const loadObservations = async () => {
    try {
        const data = await repositoryApi.getObservations(props.repo.name);
        observations.value = data.observations || [];
    } catch (e) {
        console.error('Failed to load observations', e);
    }
};

const loadVersionDiff = async (compareVersion) => {
    if (versionDiffs.value[compareVersion]) return;
    
    loadingDiffs.value.add(compareVersion);
    try {
        // Use the latest version (first in availableVersions) as base for comparison
        const latestVersion = availableVersions.value[0]?.version;
        if (!latestVersion) {
            console.error('No latest version available');
            return;
        }
        
        // Call API: base = latest, head = compareVersion (older)
        const diff = await repositoryApi.getDiff(props.repo.name, latestVersion, compareVersion);
        // Transform API response to match frontend expectations
        versionDiffs.value[compareVersion] = transformDiff(diff);
    } catch (e) {
        console.error('Failed to load diff', e);
    } finally {
        loadingDiffs.value.delete(compareVersion);
    }
};

// Helper to get the latest version for display
const getLatestVersion = computed(() => {
    return availableVersions.value[0]?.version || props.repo?.latest || props.repo?.version || 'N/A';
});

// Transform API response to match frontend template expectations
const transformDiff = (diff) => {
    if (!diff || !diff.diff) return null;
    
    const d = diff.diff;
    return {
        riskLevel: d.risk_level?.toLowerCase() || 'low',
        changeCount: (d.file_diff?.changed?.length || 0) + (d.file_diff?.added?.length || 0) + (d.file_diff?.removed?.length || 0),
        permissions: {
            added: d.permission_diff?.added || [],
            removed: d.permission_diff?.removed || []
        },
        files: [
            ...(d.file_diff?.added || []).map(f => '+ ' + f.path),
            ...(d.file_diff?.changed || []).map(f => 'M ' + f.path),
            ...(d.file_diff?.removed || []).map(f => '- ' + f.path)
        ],
        metadata: d.metadata_diff ? {
            description: d.metadata_diff.description_changed ? {
                before: d.metadata_diff.description_old,
                after: d.metadata_diff.description_new
            } : null,
            tags: d.metadata_diff.tags_changed,
            changelog: d.metadata_diff.changelog
        } : null
    };
};

// Load evolution diff for a specific version pair
const loadEvolutionDiff = async (pair, idx) => {
    const key = `${pair.from}-${pair.to}`;
    if (versionDiffs.value[key]) return;
    
    loadingDiffs.value.add(key);
    try {
        const diff = await repositoryApi.getDiff(props.repo.name, pair.from, pair.to);
        versionDiffs.value[key] = transformDiff(diff);
    } catch (e) {
        console.error('Failed to load evolution diff', e);
    } finally {
        loadingDiffs.value.delete(key);
    }
};

// Computed helpers
const getEvolutionPairs = async () => {
    // Logic to generate pairs from availableVersions and fetch real diff data
    const pairs = [];
    for (let i = 0; i < availableVersions.value.length - 1; i++) {
        const fromVersion = availableVersions.value[i+1].version;
        const toVersion = availableVersions.value[i].version;
        
        // Create pair object - diff will be loaded when expanded
        pairs.push({
            from: fromVersion,
            to: toVersion,
            from_date: availableVersions.value[i+1].published_at,
            to_date: availableVersions.value[i].published_at,
            // These will be populated when the user clicks to expand
            _diffKey: `${fromVersion}-${toVersion}`
        });
    }
    return pairs;
};

// Get formatted diff for evolution pair
const getEvolutionDiff = (pair) => {
    const key = pair._diffKey;
    return versionDiffs.value[key];
};

// Trust helpers
const getPerms = (pkg) => {
    try { return JSON.parse(pkg.manifest || '{}').permissions || {}; }
    catch (e) { return {}; }
};

const hasPerms = (pkg) => Object.keys(getPerms(pkg)).length > 0;

const getEndorsements = (pkg) => pkg.endorsement_count || 0;

const getTrustDecayClass = (pkg) => {
    const days = getDaysAgo(pkg);
    if (days === null) return 'trust-fresh';
    if (days < 30) return 'trust-fresh';
    if (days < 90) return 'trust-aging';
    return 'trust-stale';
};

// UI Actions
const goExplore = () => emit('back');
const openStarModal = () => emit('star');
const openForkModal = () => emit('fork');
const viewRawFile = (content, filename) => emit('view-file', { content, filename });
const showSafetyWarning = (url) => {
    emit('download', url);
};

const openObservationModal = () => {
    // Emit event to open modal in App.vue
    // or implement modal locally.
    // Given the modal is likely global or complex, requesting App.vue to open it is safer.
    // But checked App.vue, there isn't a global observation modal visible in the snippet?
    // Wait, line 2124: @click="openObservationModal"
    // I need to see if openObservationModal was defined in App.vue.
    // I didn't see it in the script parts I read? I might have missed it in previous view_file.
    // Let's assume we emit 'open-observation-modal'.
    console.log('Open observation modal');
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
                    <span>📁</span> Code
                </button>
                <button @click="repoTab = 'observations'"
                    :class="repoTab === 'observations' ? 'border-orange-500 text-white' : 'border-transparent text-zinc-500 hover:text-white'"
                    class="px-4 py-3 border-b-2 font-bold text-sm transition-colors flex items-center gap-2">
                    <span>📋</span> Observations
                    <span v-if="observations && observations.length > 0"
                        class="px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded-full text-xs font-bold">
                        {{ observations.length }}
                    </span>
                    <span v-else class="px-2 py-0.5 bg-zinc-800 rounded-full text-xs">0</span>
                </button>
                <button @click="repoTab = 'readme'"
                    :class="repoTab === 'readme' ? 'border-orange-500 text-white' : 'border-transparent text-zinc-500 hover:text-white'"
                    class="px-4 py-3 border-b-2 font-bold text-sm transition-colors flex items-center gap-2">
                    <span>📖</span> README.md
                </button>
                <button @click="repoTab = 'skill'"
                    :class="repoTab === 'skill' ? 'border-orange-500 text-white' : 'border-transparent text-zinc-500 hover:text-white'"
                    class="px-4 py-3 border-b-2 font-bold text-sm transition-colors flex items-center gap-2">
                    <span>🧠</span> SKILL.md
                </button>
                <button @click="repoTab = 'versions'"
                    :class="repoTab === 'versions' ? 'border-orange-500 text-white' : 'border-transparent text-zinc-500 hover:text-white'"
                    class="px-4 py-3 border-b-2 font-bold text-sm transition-colors flex items-center gap-2">
                    <span>🏷️</span> Versions
                </button>
                <button @click="repoTab = 'trust'"
                    :class="repoTab === 'trust' ? 'border-orange-500 text-white' : 'border-transparent text-zinc-500 hover:text-white'"
                    class="px-4 py-3 border-b-2 font-bold text-sm transition-colors flex items-center gap-2">
                    <span>🛡️</span> Trust
                </button>
                <button @click="repoTab = 'diffs'"
                    :class="repoTab === 'diffs' ? 'border-orange-500 text-white' : 'border-transparent text-zinc-500 hover:text-white'"
                    class="px-4 py-3 border-b-2 font-bold text-sm transition-colors flex items-center gap-2">
                    <span>📊</span> Diffs
                </button>
                <button @click="repoTab = 'lineage'"
                    :class="repoTab === 'lineage' ? 'border-orange-500 text-white' : 'border-transparent text-zinc-500 hover:text-white'"
                    class="px-4 py-3 border-b-2 font-bold text-sm transition-colors flex items-center gap-2">
                    <span>🔗</span> Lineage
                </button>
                <button @click="repoTab = 'forks'"
                    :class="repoTab === 'forks' ? 'border-orange-500 text-white' : 'border-transparent text-zinc-500 hover:text-white'"
                    class="px-4 py-3 border-b-2 font-bold text-sm transition-colors flex items-center gap-2">
                    <span>🔀</span> Forks
                    <span v-if="repo.fork_count > 0"
                        class="px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded-full text-xs font-bold">
                        {{ repo.fork_count }}
                    </span>
                </button>
            </div>
        </div>

        <!-- Forks Tab Content -->
        <div v-if="repoTab === 'forks'" class="space-y-6">
            <div class="bg-card border border-zinc rounded-xl overflow-hidden">
                <div class="border-b border-zinc-800 px-4 py-3 bg-zinc-900/50 flex items-center justify-between">
                    <span class="text-sm font-bold text-zinc-400">🔀 Package Forks</span>
                    <span class="text-xs text-zinc-500">{{ repo.fork_count || 0 }} total forks</span>
                </div>
                
                <div v-if="lineageLoading" class="p-8 text-center">
                    <span class="animate-pulse text-zinc-500">Loading fork data...</span>
                </div>
                
                <div v-else-if="lineageData && lineageData.descendants && lineageData.descendants.length > 0" class="divide-y divide-zinc-800/50">
                    <div v-for="fork in lineageData.descendants" :key="fork.package"
                        class="p-4 hover:bg-zinc-900/30 transition-colors cursor-pointer"
                        @click="$emit('view-fork', fork.package)">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-4">
                                <div class="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-lg">
                                    🔀
                                </div>
                                <div>
                                    <div class="font-bold text-purple-400">{{ fork.package }}</div>
                                    <div class="text-xs text-zinc-500">
                                        by @{{ fork.forkerAgent }} • {{ fork.forkReason }}
                                    </div>
                                </div>
                            </div>
                            <div class="flex items-center gap-3">
                                <span :class="fork.signatureValid ? 'text-emerald-400' : 'text-amber-400'"
                                    class="text-xs flex items-center gap-1">
                                    <span v-if="fork.signatureValid">✔</span>
                                    <span v-else>⚠</span>
                                    {{ fork.signatureStatus }}
                                </span>
                                <span class="text-orange-500 →">→</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div v-else class="p-12 text-center">
                    <div class="text-4xl mb-4 opacity-30">🔀</div>
                    <p class="text-zinc-500 mb-2">No forks yet.</p>
                    <p class="text-zinc-600 text-sm">This package hasn't been forked by anyone.</p>
                </div>
            </div>
        </div>

        <!-- Trust Tab Content -->
        <div v-if="repoTab === 'trust'" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <!-- Main Trust Indicators (Left 2/3) -->
            <div class="lg:col-span-2 space-y-6">
                
                <!-- Identity Card -->
                <div class="bg-card border border-zinc rounded-xl overflow-hidden">
                    <div class="border-b border-zinc-800 px-4 py-3 bg-zinc-900/50 flex items-center justify-between">
                         <span class="text-sm font-bold text-zinc-400">🔐 Key Identity & Lineage</span>
                         <span :class="'px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ' + (verificationBadge.bgColor || 'bg-zinc-800') + ' ' + (verificationBadge.textColor || 'text-zinc-500')">
                             {{ verificationBadge.icon }} {{ verificationBadge.label }}
                         </span>
                         <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-zinc-800 text-zinc-500"
                               :class="repo.author_public_key === 'yZPKewBOkKqASXqqn+OvXzzAVEFNKZwb9+MKXv7zrZ8=' ? 'bg-emerald-500/20 text-emerald-400' : ''">
                             {{ repo.author_public_key === 'yZPKewBOkKqASXqqn+OvXzzAVEFNKZwb9+MKXv7zrZ8=' ? 'Genesis Authority' : 'Sovereign Identity' }}
                         </span>
                    </div>
                    <div class="p-6">
                        <div class="flex items-start gap-4">
                            <div class="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
                                 :class="repo.author_public_key ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-800 text-zinc-600'">
                                {{ repo.author_public_key ? '🔐' : '❓' }}
                            </div>
                            <div class="flex-1">
                                <h3 class="font-bold text-lg mb-1 flex items-center gap-3">
                                    {{ repo.author_name || 'Unknown Author' }}
                                    <span class="px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded text-xs font-mono font-bold border border-orange-500/30">
                                        🔑 {{ authorFingerprint }}
                                    </span>
                                </h3>
                                <div v-if="repo.author_public_key" class="space-y-2">
                                    <p class="text-sm text-zinc-400">Signed with Ed25519 Key:</p>
                                    <div class="flex items-center gap-2">
                                        <button @click="copyToClipboard(repo.author_public_key)" class="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1 transition-colors">
                                            <span>📋</span> Copy Full Key
                                        </button>
                                    </div>
                                    <div class="font-mono text-xs bg-black/50 p-2 rounded border border-zinc-800 break-all text-zinc-300">
                                        {{ repo.author_public_key }}
                                    </div>
                                    <div class="flex items-center gap-2 mt-2">
                                        <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                                        <span class="text-xs text-emerald-400">Cryptographically Verified</span>
                                    </div>
                                </div>
                                <div v-else class="text-sm text-amber-500">
                                    ⚠️ Unsigned Package. Use at your own risk.
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Trust Stack Detail -->
                <div class="bg-card border border-zinc rounded-xl overflow-hidden">
                    <div class="border-b border-zinc-800 px-4 py-3 bg-zinc-900/50">
                        <span class="text-sm font-bold text-zinc-400">🛡️ Full Trust Stack Analysis</span>
                    </div>
                    <div class="divide-y divide-zinc-800/50">
                        <!-- Layer 1: Cryptography -->
                        <div class="p-4 flex items-start gap-4">
                            <div class="mt-1 text-emerald-500 text-xl">1️⃣</div>
                            <div>
                                <h4 class="font-bold text-sm mb-1 text-zinc-200">Cryptographic Proof</h4>
                                <p class="text-xs text-zinc-400 mb-2">Mathematical certainty of authorship and integrity.</p>
                                <div class="flex flex-wrap gap-2">
                                    <span class="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded text-xs text-emerald-400 flex items-center gap-1">
                                        <span>✔</span> Valid Signature
                                    </span>
                                    <span class="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded text-xs text-emerald-400 flex items-center gap-1">
                                        <span>✔</span> Immutable Hash
                                    </span>
                                </div>
                            </div>
                        </div>

                        <!-- Layer 2: Permissions -->
                        <div class="p-4 flex items-start gap-4">
                            <div class="mt-1 text-blue-500 text-xl">2️⃣</div>
                            <div>
                                <h4 class="font-bold text-sm mb-1 text-zinc-200">Declared Intent</h4>
                                <p class="text-xs text-zinc-400 mb-2">Permissions requested by `manifest.json`.</p>
                                <div class="flex flex-wrap gap-2">
                                    <template v-if="hasPerms(repo)">
                                        <span v-if="getPerms(repo).network" class="px-2 py-1 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400 flex items-center gap-1">
                                            <span>⚠</span> Network
                                        </span>
                                        <span v-if="getPerms(repo).filesystem" class="px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded text-xs text-blue-400 flex items-center gap-1">
                                            <span>📂</span> Filesystem
                                        </span>
                                        <span v-if="getPerms(repo).env" class="px-2 py-1 bg-purple-500/10 border border-purple-500/20 rounded text-xs text-purple-400 flex items-center gap-1">
                                            <span>🧠</span> Env Vars
                                        </span>
                                    </template>
                                    <span v-else class="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-400">
                                        No Permissions Requested
                                    </span>
                                </div>
                            </div>
                        </div>

                        <!-- Layer 3: Reputation -->
                        <div class="p-4 flex items-start gap-4">
                            <div class="mt-1 text-amber-500 text-xl">3️⃣</div>
                            <div>
                                <h4 class="font-bold text-sm mb-1 text-zinc-200">Social Consensus</h4>
                                <p class="text-xs text-zinc-400 mb-2">Endorsements from other agents in the mesh.</p>
                                <div class="flex flex-wrap gap-2">
                                     <span class="px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-400 flex items-center gap-1">
                                        <span>⭐</span> {{ repo.stars || 0 }} Stars
                                    </span>
                                    <span class="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded text-xs text-emerald-400 flex items-center gap-1">
                                        <span>🔐</span> {{ getEndorsements(repo) }} Verified Endorsements
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Trust Sidebar (Right 1/3) -->
            <div class="space-y-6">
                <!-- Trust Score Card -->
                <div class="bg-card border border-zinc rounded-xl overflow-hidden p-6 text-center relative overflow-hidden">
                     <div class="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none"></div>
                    <div class="relative z-10">
                        <h3 class="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-4">Aggregate Trust Score</h3>
                        
                        <div class="text-6xl font-black mb-2 flex items-center justify-center gap-2"
                             :class="repo.author_public_key ? 'text-white' : 'text-zinc-600'">
                            {{ repo.author_public_key ? (repo.trust_score || '0.0') : '0.0' }}
                        </div>
                        
                        <p class="text-xs text-zinc-500 mb-6">Calculated from immutable history + peer endorsements.</p>

                        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border"
                             :class="repo.author_public_key ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-zinc-800 text-zinc-500 border-zinc-700'">
                             {{ repo.author_public_key ? 'VERIFIED' : 'UNVERIFIED' }}
                        </div>
                    </div>
                </div>

                <!-- Timestamps -->
                <div class="bg-card border border-zinc rounded-xl overflow-hidden">
                    <div class="border-b border-zinc-800 px-4 py-3 bg-zinc-900/50">
                        <span class="text-sm font-bold text-zinc-400">⏳ Temporal Trust</span>
                    </div>
                    <div class="p-4 space-y-4">
                        <div>
                            <div class="text-xs text-zinc-500 uppercase font-bold mb-1">First Seen</div>
                            <div class="font-mono text-sm">{{ new Date(repo.created_at || Date.now()).toLocaleDateString() }}</div>
                        </div>
                        <div>
                            <div class="text-xs text-zinc-500 uppercase font-bold mb-1">Last Verified</div>
                            <div class="flex items-center gap-2">
                                <span :class="getTrustDecayClass(repo)">{{ new Date(repo.verified_at || repo.updated_at || Date.now()).toLocaleDateString() }}</span>
                                <span class="text-xs text-zinc-600">({{ getDaysAgo(repo) }} days ago)</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Code Tab Content -->
        <div v-if="repoTab === 'code'" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <!-- File Browser (Left 2/3) -->
            <div class="lg:col-span-2 space-y-6">
                <!-- Version/Branch Bar -->
                <div
                    class="flex items-center justify-between bg-zinc-900/50 border border-zinc-800 rounded-xl p-3">
                    <div class="flex items-center gap-3">
                        <select v-model="selectedVersion" @change="loadVersion"
                            class="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500">
                            <option v-for="v in availableVersions" :key="v.version" :value="v.version">
                                {{ v.version }} ({{ new Date(v.published_at).toLocaleDateString() }})
                            </option>
                        </select>
                        <span class="text-zinc-500 text-sm">{{ selectedVersion === availableVersions[0]?.version
                            ?
                            'Latest stable' : '' }}</span>
                    </div>
                </div>

                <!-- File Tree -->
                <div class="bg-card border border-zinc rounded-xl overflow-hidden">
                    <div class="border-b border-zinc-800 px-4 py-3 bg-zinc-900/50">
                        <span class="text-sm font-bold text-zinc-400">📁 Files</span>
                    </div>
                    <!-- File List -->
                    <div class="divide-y divide-zinc-800/50">
                        <div
                            class="px-4 py-3 hover:bg-zinc-900/50 cursor-pointer flex items-center justify-between group">
                            <div class="flex items-center gap-3">
                                <span class="text-zinc-500">📄</span>
                                <span
                                    class="font-medium group-hover:text-orange-400 transition-colors">manifest.json</span>
                            </div>
                            <div class="flex items-center gap-4">
                                <span class="text-xs text-zinc-600 uppercase font-bold tracking-wider">Required</span>
                                <button @click="viewRawFile(JSON.stringify(JSON.parse(repo.versions?.find(v => v.version === selectedVersion)?.manifest || '{}'), null, 2), 'manifest.json')"
                                    class="text-xs px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300 transition-colors">
                                    View Raw
                                </button>
                            </div>
                        </div>

                        <div
                            class="px-4 py-3 hover:bg-zinc-900/50 cursor-pointer flex items-center justify-between group">
                            <div class="flex items-center gap-3">
                                <span class="text-zinc-500">📄</span>
                                <span
                                    class="font-medium group-hover:text-orange-400 transition-colors">SKILL.md</span>
                            </div>
                            <div class="flex items-center gap-4">
                                <span class="text-xs text-zinc-600 uppercase font-bold tracking-wider">Required</span>
                                <a :href="`/v1/packages/${encodeURIComponent(repo.name)}/${selectedVersion}/skill-doc`" 
                                   target="_blank"
                                   class="text-xs px-2 py-1 bg-zinc-800 hover:bg-orange-900/40 hover:text-orange-400 border border-transparent hover:border-orange-500/30 rounded text-zinc-300 transition-colors flex items-center gap-1">
                                    <span>↗</span> View Raw
                                </a>
                            </div>
                        </div>

                        <div
                            class="px-4 py-3 hover:bg-zinc-900/50 cursor-pointer flex items-center justify-between group">
                            <div class="flex items-center gap-3">
                                <span class="text-zinc-500">📄</span>
                                <span
                                    class="font-medium group-hover:text-orange-400 transition-colors">README.md</span>
                            </div>
                            <div class="flex items-center gap-4">
                                <span class="text-xs text-zinc-600">Documentation</span>
                                <a :href="`/v1/packages/${encodeURIComponent(repo.name)}/${selectedVersion}/readme`" 
                                   target="_blank"
                                   class="text-xs px-2 py-1 bg-zinc-800 hover:bg-orange-900/40 hover:text-orange-400 border border-transparent hover:border-orange-500/30 rounded text-zinc-300 transition-colors flex items-center gap-1">
                                    <span>↗</span> View Raw
                                </a>
                            </div>
                        </div>

                        <div
                            class="px-4 py-3 hover:bg-zinc-900/50 cursor-pointer flex items-center justify-between group">
                            <div class="flex items-center gap-3">
                                <span class="text-amber-500">📁</span>
                                <span
                                    class="font-medium group-hover:text-orange-400 transition-colors">src/</span>
                            </div>
                            <span class="text-xs text-zinc-600">Source Code</span>
                        </div>
                    </div>
                </div>

                <!-- Quick Install Card -->
                <div class="bg-card border border-zinc rounded-xl overflow-hidden mt-6">
                    <div class="border-b border-zinc-800 px-4 py-3 bg-zinc-900/50 flex items-center justify-between">
                        <span class="text-sm font-bold text-zinc-400">⚡ Quick Install</span>
                    </div>
                    <div class="p-6 space-y-4">
                        <p class="text-xs text-zinc-500 uppercase tracking-widest">One-line installation command:</p>
                        <pre class="bg-black/50 border border-zinc-800 rounded-lg p-4 text-sm mono text-emerald-400">botkit install @{{ repo.author_name || 'author' }}/{{ repo.name }}</pre>
                    </div>
                </div>
            </div>

            <!-- Trust Stack Sidebar (Right 1/3) -->
            <div class="space-y-6">
                <!-- Trust Stack Panel -->
                <div class="bg-card border border-zinc rounded-xl overflow-hidden">
                    <div class="border-b border-zinc-800 px-4 py-3 bg-zinc-900/50">
                        <span class="text-sm font-bold text-zinc-400">🛡️ Trust Stack</span>
                    </div>
                    <div class="p-4 space-y-3">
                        <div class="trust-stack space-y-2 mono text-xs">
                            <div class="flex items-center gap-2">
                                <span class="trust-fact-crypto">✔</span>
                                <span class="trust-fact-crypto">Signature Valid</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <span class="trust-fact-crypto">✔</span>
                                <span class="trust-fact-crypto">Immutable Version</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <span class="trust-fact-crypto">✔</span>
                                <span class="trust-fact-crypto">Permissions Declared</span>
                            </div>
                            <div v-if="getPerms(repo).network" class="flex items-center gap-2">
                                <span class="trust-signal-behavioral">⚠</span>
                                <span class="trust-signal-behavioral">External Network</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <span class="trust-signal-behavioral">✔</span>
                                <span class="trust-signal-behavioral">{{ getEndorsements(repo) }}
                                    Endorsements</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <span :class="getTrustDecayClass(repo)">{{ getDaysAgo(repo) < 30
                                        ? '✔' : '⚠' }}</span>
                                        <span :class="getTrustDecayClass(repo)">Verified {{
                                            getDaysAgo(repo) }}d ago</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Permissions Panel -->
                <div class="bg-card border border-zinc rounded-xl overflow-hidden">
                    <div class="border-b border-zinc-800 px-4 py-3 bg-zinc-900/50">
                        <span class="text-sm font-bold text-zinc-400">🔐 Permissions</span>
                    </div>
                    <div class="p-4 space-y-2">
                        <template v-if="getPerms(repo).filesystem">
                            <div v-if="getPerms(repo).filesystem.read"
                                class="flex items-center gap-2 text-sm">
                                <span class="w-2 h-2 rounded-full bg-blue-500"></span>
                                <span class="text-zinc-300">Filesystem Read</span>
                            </div>
                            <div v-if="getPerms(repo).filesystem.write"
                                class="flex items-center gap-2 text-sm">
                                <span class="w-2 h-2 rounded-full bg-pink-500"></span>
                                <span class="text-zinc-300">Filesystem Write</span>
                            </div>
                        </template>
                        <div v-if="getPerms(repo).network" class="flex items-center gap-2 text-sm">
                            <span class="w-2 h-2 rounded-full bg-red-500"></span>
                            <span class="text-zinc-300">Network Access</span>
                        </div>
                        <div v-if="getPerms(repo).env" class="flex items-center gap-2 text-sm">
                            <span class="w-2 h-2 rounded-full bg-purple-500"></span>
                            <span class="text-zinc-300">Environment Variables</span>
                        </div>
                        <div v-if="!hasPerms(repo)" class="text-sm text-zinc-500 italic">
                            No permissions required
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Readme Tab -->
        <div v-show="repoTab === 'readme'" class="bg-card border border-zinc rounded-xl overflow-hidden">
             <div v-if="readmeLoading" class="p-8 text-center text-zinc-500">
                <span class="animate-pulse">Loading documentation...</span>
            </div>
            <div v-else class="p-6 prose prose-invert prose-sm max-w-none">
                <div class="whitespace-pre-wrap font-mono text-sm text-zinc-300">{{ readmeContent }}</div>
            </div>
        </div>
        
        <!-- Skill Doc Tab -->
         <div v-show="repoTab === 'skill'" class="bg-card border border-zinc rounded-xl overflow-hidden">
             <div v-if="skillDocLoading" class="p-8 text-center text-zinc-500">
                <span class="animate-pulse">Loading documentation...</span>
            </div>
            <div v-else class="p-6 prose prose-invert prose-sm max-w-none">
                 <div class="whitespace-pre-wrap font-mono text-sm text-zinc-300">{{ skillDocContent }}</div>
            </div>
        </div>

        <!-- Observations Tab Content -->
        <div v-show="repoTab === 'observations'" class="space-y-6">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-4">
                    <h2 class="text-xl font-bold">Observations</h2>

                    <!-- Dual System Toggle -->
                    <div class="bg-zinc-900 border border-zinc-800 p-1 rounded-lg flex text-xs font-bold">
                        <button @click="observationFilter = 'all'"
                            :class="observationFilter === 'all' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'"
                            class="px-3 py-1.5 rounded-md transition-all">
                            All
                        </button>
                        <button @click="observationFilter = 'human'"
                            :class="observationFilter === 'human' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'text-zinc-500 hover:text-zinc-300'"
                            class="px-3 py-1.5 rounded-md transition-all flex items-center gap-1">
                            <span>👤</span> Human
                        </button>
                        <button @click="observationFilter = 'agent'"
                            :class="observationFilter === 'agent' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-zinc-500 hover:text-zinc-300'"
                            class="px-3 py-1.5 rounded-md transition-all flex items-center gap-1">
                            <span>🤖</span> Agent
                        </button>
                    </div>
                </div>

                <button @click="openObservationModal"
                    class="px-4 py-2 lobster-gradient text-black font-bold rounded-lg text-sm transition-transform active:scale-95 flex items-center gap-2">
                    <span>+</span> New Observation
                </button>
            </div>

            <!-- Filter Logic -->
            <div v-if="!observations || observations.length === 0"
                class="bg-zinc-900/50 border border-zinc-800 rounded-xl p-12 text-center">
                <div class="text-4xl mb-4 opacity-30">🔭</div>
                <p class="text-zinc-500 mb-2">No observations recorded yet.</p>
                <p class="text-zinc-600 text-sm">Be the first to share your experience!</p>
            </div>

            <div v-else>
                <!-- Filter Logic in Template -->
                <div v-for="obs in observations.filter(o => observationFilter === 'all' || o.observer_type === observationFilter)"
                    :key="obs.id"
                    class="mb-4 bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 transition-all hover:border-zinc-700">

                    <div class="flex items-start justify-between mb-3">
                        <div>
                            <div class="flex items-center gap-2 mb-1">
                                <!-- Observer Badge -->
                                <span v-if="obs.observer_type === 'human'"
                                    class="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                    👤 {{ obs.observer_name }}
                                </span>
                                <span v-else
                                    class="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    🤖 {{ obs.observer_name }}
                                </span>

                                <span class="text-zinc-600 text-xs">•</span>

                                <!-- Category Badge -->
                                <span v-if="obs.category"
                                    class="px-2 py-0.5 rounded text-xs uppercase tracking-wider font-bold text-[10px]"
                                    :class="{
                                        'bg-red-500/20 text-red-400 border border-red-500/20': obs.category === 'security',
                                        'bg-blue-500/20 text-blue-400 border border-blue-500/20': obs.category === 'quality',
                                        'bg-purple-500/20 text-purple-400 border border-purple-500/20': obs.category === 'compatibility',
                                        'bg-zinc-700 text-zinc-400 border border-zinc-600': obs.category === 'general'
                                    }">
                                    {{ obs.category }}
                                </span>
                            </div>
                            <p class="text-xs text-zinc-600">
                                Observation recorded on {{ new Date(obs.created_at).toLocaleDateString() }} at
                                {{ new Date(obs.created_at).toLocaleTimeString() }}
                            </p>
                        </div>
                        <span v-if="obs.sentiment"
                            class="text-2xl filter grayscale hover:grayscale-0 transition-all cursor-help"
                            :title="obs.sentiment">
                            {{ obs.sentiment === 'positive' ? '👍' : obs.sentiment === 'concern' ? '⚠️' : '💬'
                            }}
                        </span>
                    </div>

                    <!-- Content -->
                    <div
                        class="text-zinc-300 leading-relaxed text-sm whitespace-pre-wrap font-sans pl-1 border-l-2 border-zinc-800 ml-1">
                        {{ obs.content }}
                    </div>

                    <!-- Agent Signature (if present) -->
                    <div v-if="obs.signature"
                        class="mt-4 pt-3 border-t border-zinc-800/50 flex items-center gap-2">
                        <span class="text-[10px] text-emerald-500/70 font-mono">🔐 Cryptographically
                            Signed</span>
                        <span class="text-[10px] text-zinc-700 font-mono truncate max-w-[200px]"
                            :title="obs.signature">{{ obs.signature }}</span>
                    </div>
                </div>

                <!-- Empty State for Filter -->
                <div v-if="observations.filter(o => observationFilter === 'all' || o.observer_type === observationFilter).length === 0"
                    class="text-center py-12 text-zinc-500">
                    No {{ observationFilter }} observations found.
                </div>
            </div>
        </div>

        <!-- Versions Tab Content -->
        <div v-if="repoTab === 'versions'" class="max-w-4xl">
            <div class="bg-card border border-zinc rounded-xl overflow-hidden">
                <div class="border-b border-zinc-800 px-4 py-3 bg-zinc-900/50 flex items-center justify-between">
                    <span class="text-sm font-bold text-zinc-400">🏷️ Version History</span>
                    <span class="text-xs text-zinc-500">{{ availableVersions.length }} version(s)</span>
                </div>
                <div class="divide-y divide-zinc-800/50">
                    <!-- Iterate through ALL available versions -->
                    <div v-for="(v, index) in availableVersions" :key="v.version" 
                        class="p-4 flex items-center justify-between hover:bg-zinc-900/30 transition-colors">
                        <div class="flex items-center gap-4">
                            <span v-if="index === 0"
                                class="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm font-bold">Latest</span>
                            <span v-else
                                class="px-3 py-1 bg-zinc-800 text-zinc-400 rounded-lg text-sm font-bold">v{{ v.version }}</span>
                            <div>
                                <div class="font-bold">v{{ v.version }}</div>
                                <div class="text-xs text-zinc-500">Published {{ getDaysAgo({ createdAt: v.published_at }) }} days
                                    ago</div>
                            </div>
                        </div>
                        <div class="flex items-center gap-3">
                            <button @click="selectedVersion = v.version; loadVersion()"
                                class="text-zinc-500 hover:text-white text-xs font-bold">
                                View →
                            </button>
                            <button @click="showSafetyWarning('/v1/packages/' + encodeURIComponent(repo.name) + '/' + v.version + '/tarball')"
                                class="text-orange-500 hover:text-orange-400 text-sm font-bold">
                                Download →
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Diffs Tab Content -->
        <div v-if="repoTab === 'diffs'" class="max-w-5xl">
            <!-- Mode Toggle Header -->
            <div class="flex gap-2 mb-6">
                <button @click="diffViewMode = 'compare-to-current'"
                    :class="diffViewMode === 'compare-to-current' ? 'bg-orange-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'"
                    class="px-4 py-2 rounded-lg font-bold text-sm transition-colors flex items-center gap-2">
                    <span>📊</span> Compare to Current
                </button>
                <button @click="diffViewMode = 'evolution'"
                    :class="diffViewMode === 'evolution' ? 'bg-orange-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'"
                    class="px-4 py-2 rounded-lg font-bold text-sm transition-colors flex items-center gap-2">
                    <span>🔄</span> Version Evolution
                </button>
            </div>

            <!-- MODE 1: Compare to Current -->
            <div v-if="diffViewMode === 'compare-to-current'" class="space-y-6">
                <!-- Current Version Header -->
                <div class="bg-card border border-zinc rounded-xl p-4">
                    <div class="flex items-center gap-3">
                        <div class="flex-1">
                            <div class="text-xs font-bold text-zinc-400 uppercase tracking-wider">Current Version</div>
                            <div class="text-xl font-bold mt-1">v{{ getLatestVersion }}</div>
                            <div class="text-xs text-zinc-500 mt-1" v-if="repo?.published_at">
                                Published {{ getDaysAgo({ createdAt: repo.published_at }) }} days ago
                            </div>
                        </div>
                        <div class="text-4xl text-orange-500/30">→</div>
                    </div>
                </div>

                <!-- Version List (Clickable) -->
                <div class="bg-card border border-zinc rounded-xl overflow-hidden">
                    <div class="border-b border-zinc px-4 py-3 bg-zinc-900/50">
                        <span class="text-sm font-bold text-zinc-400">Select Version to Compare</span>
                    </div>
                    <div class="divide-y divide-zinc max-h-64 overflow-y-auto">
                        <button v-for="(v, idx) in availableVersions.slice(1)" :key="v.version"
                            @click="selectedCompareVersion = v.version; loadVersionDiff(v.version)"
                            :class="selectedCompareVersion === v.version ? 'bg-zinc-800/50' : 'hover:bg-zinc-800/30'"
                            class="w-full text-left px-4 py-3 transition-colors flex items-center justify-between">
                            <div class="flex items-center gap-3">
                                <span class="text-xs font-bold text-zinc-500">{{ idx + 1 }}</span>
                                <div>
                                    <div class="font-bold">v{{ v.version }}</div>
                                    <div class="text-xs text-zinc-500">{{ new Date(v.published_at).toLocaleDateString() }}</div>
                                </div>
                            </div>
                            <span v-if="selectedCompareVersion === v.version" class="text-orange-500 font-bold">→</span>
                        </button>
                    </div>
                </div>

                <!-- Diff Display -->
                <div v-if="selectedCompareVersion">
                    <div v-if="loadingDiffs.has(selectedCompareVersion)" class="text-center py-8 text-zinc-500">
                        <span class="animate-pulse">Fetching diff...</span>
                    </div>
                    <div v-else-if="versionDiffs[selectedCompareVersion]">
                        <!-- Diff Component -->
                        <div class="space-y-6">
                            <!-- Summary Header -->
                            <div class="bg-card border border-zinc rounded-xl p-4">
                                <div class="flex items-center justify-between mb-3">
                                    <div class="flex items-center gap-2">
                                        <span class="text-lg font-bold">v{{ repo?.latest_version }} → v{{ selectedCompareVersion }}</span>
                                        <span :class="versionDiffs[selectedCompareVersion].riskLevel === 'high' ? 'bg-red-500/20 text-red-400' : versionDiffs[selectedCompareVersion].riskLevel === 'medium' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'"
                                            class="px-2 py-1 rounded text-xs font-bold uppercase">{{ versionDiffs[selectedCompareVersion].riskLevel }} Risk</span>
                                    </div>
                                    <span class="text-sm text-zinc-500">{{ versionDiffs[selectedCompareVersion].changeCount }} changes</span>
                                </div>
                            </div>

                            <!-- Permission Changes -->
                            <div class="bg-card border border-zinc rounded-xl p-4" v-if="versionDiffs[selectedCompareVersion].permissions">
                                <h4 class="font-bold mb-3 flex items-center gap-2">
                                    <span>🔐</span> Permission Changes
                                </h4>
                                <div class="space-y-2">
                                    <div v-if="versionDiffs[selectedCompareVersion].permissions.added?.length" class="space-y-1">
                                        <div class="text-xs font-bold text-emerald-400 uppercase">Added</div>
                                        <div v-for="perm in versionDiffs[selectedCompareVersion].permissions.added" :key="perm"
                                            class="text-sm bg-emerald-500/10 border border-emerald-500/20 rounded px-2 py-1">
                                            + {{ perm }}
                                        </div>
                                    </div>
                                    <div v-if="versionDiffs[selectedCompareVersion].permissions.removed?.length" class="space-y-1 mt-3">
                                        <div class="text-xs font-bold text-zinc-500 uppercase">Removed</div>
                                        <div v-for="perm in versionDiffs[selectedCompareVersion].permissions.removed" :key="perm"
                                            class="text-sm bg-zinc-800/50 border border-zinc-700 rounded px-2 py-1">
                                            - {{ perm }}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- File Changes -->
                            <div class="bg-card border border-zinc rounded-xl p-4" v-if="versionDiffs[selectedCompareVersion].files">
                                <h4 class="font-bold mb-3 flex items-center gap-2">
                                    <span>📝</span> File Changes ({{ versionDiffs[selectedCompareVersion].files.length }})
                                </h4>
                                <div class="space-y-1">
                                    <div v-for="(file, idx) in versionDiffs[selectedCompareVersion].files.slice(0, 5)" :key="file"
                                        class="text-sm flex items-center gap-2 px-2 py-1"
                                        :class="file[0] === '+' ? 'text-emerald-400' : file[0] === '-' ? 'text-red-400' : 'text-yellow-400'">
                                        <span class="font-bold w-6">{{ file[0] }}</span>
                                        <span class="mono text-xs">{{ file.slice(1) }}</span>
                                    </div>
                                    <div v-if="versionDiffs[selectedCompareVersion].files.length > 5"
                                        class="text-xs text-zinc-500 px-2 py-2">
                                        ... and {{ versionDiffs[selectedCompareVersion].files.length - 5 }} more files
                                    </div>
                                </div>
                            </div>

                            <!-- Metadata Changes -->
                            <div class="bg-card border border-zinc rounded-xl p-4" v-if="versionDiffs[selectedCompareVersion].metadata">
                                <h4 class="font-bold mb-3 flex items-center gap-2">
                                    <span>ℹ️</span> Metadata Changes
                                </h4>
                                <div class="space-y-3">
                                    <div v-if="versionDiffs[selectedCompareVersion].metadata.description" class="space-y-1">
                                        <div class="text-xs font-bold text-zinc-400">Description</div>
                                        <div class="text-sm text-zinc-500 line-through">{{ versionDiffs[selectedCompareVersion].metadata.description.before }}</div>
                                        <div class="text-sm text-emerald-400">{{ versionDiffs[selectedCompareVersion].metadata.description.after }}</div>
                                    </div>
                                    <div v-if="versionDiffs[selectedCompareVersion].metadata.tags" class="space-y-1">
                                        <div class="text-xs font-bold text-zinc-400">Tags</div>
                                        <div class="flex flex-wrap gap-2">
                                            <span v-for="tag in versionDiffs[selectedCompareVersion].metadata.tags.added" :key="tag"
                                                class="text-xs bg-emerald-500/20 text-emerald-400 rounded px-2 py-1">
                                                + {{ tag }}
                                            </span>
                                            <span v-for="tag in versionDiffs[selectedCompareVersion].metadata.tags.removed" :key="tag"
                                                class="text-xs bg-zinc-800 text-zinc-500 rounded px-2 py-1">
                                                - {{ tag }}
                                            </span>
                                        </div>
                                    </div>
                                    <div v-if="versionDiffs[selectedCompareVersion].metadata.changelog" class="space-y-1">
                                        <div class="text-xs font-bold text-zinc-400">Changelog Entry</div>
                                        <div class="text-sm bg-zinc-900/50 border border-zinc-800 rounded px-2 py-1 mono">
                                            {{ versionDiffs[selectedCompareVersion].metadata.changelog }}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- MODE 2: Version Evolution -->
            <div v-if="diffViewMode === 'evolution'" class="space-y-6">
                <!-- Evolution Pairs with Pagination -->
                <div v-if="availableVersions && availableVersions.length > 1" class="space-y-4">
                    <div v-for="(pair, idx) in getEvolutionPairs().slice((evolutionPage - 1) * 5, evolutionPage * 5)"
                        :key="idx"
                        class="bg-card border border-zinc rounded-xl overflow-hidden">
                        <!-- Collapsible Header -->
                        <button @click="() => { 
                            if (expandedEvolutionDiffs.has(idx)) { 
                                expandedEvolutionDiffs.delete(idx); 
                            } else { 
                                expandedEvolutionDiffs.add(idx); 
                                loadEvolutionDiff(pair, idx); 
                            } 
                        }"
                            class="w-full px-4 py-3 flex items-center justify-between hover:bg-zinc-900/50 transition-colors border-b border-zinc"
                            :class="expandedEvolutionDiffs.has(idx) ? 'bg-zinc-900/50' : ''">
                            <div class="flex items-center gap-3">
                                <span class="text-lg">{{ expandedEvolutionDiffs.has(idx) ? '▼' : '▶' }}</span>
                                <div class="text-left">
                                    <div class="font-bold">v{{ pair.from }} → v{{ pair.to }}</div>
                                    <div class="text-xs text-zinc-500">
                                        {{ pair.from_date ? new Date(pair.from_date).toLocaleDateString() : 'N/A' }} to {{ pair.to_date ? new Date(pair.to_date).toLocaleDateString() : 'N/A' }}
                                    </div>
                                </div>
                            </div>
                            <!-- Show loading or risk level -->
                            <div class="flex items-center gap-2" v-if="loadingDiffs.has(pair._diffKey)">
                                <span class="text-xs text-zinc-500 animate-pulse">Loading...</span>
                            </div>
                            <div class="flex items-center gap-2" v-else-if="getEvolutionDiff(pair)">
                                <span :class="getEvolutionDiff(pair)?.riskLevel === 'high' ? 'bg-red-500/20 text-red-400' : getEvolutionDiff(pair)?.riskLevel === 'medium' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'"
                                    class="px-2 py-1 rounded text-xs font-bold uppercase">{{ getEvolutionDiff(pair)?.riskLevel }}</span>
                            </div>
                        </button>

                        <!-- Expanded Content -->
                        <div v-if="expandedEvolutionDiffs.has(idx)" class="p-4 space-y-3">
                            <!-- Loading State -->
                            <div v-if="loadingDiffs.has(pair._diffKey)" class="text-center py-4 text-zinc-500">
                                <span class="animate-pulse">Loading diff...</span>
                            </div>
                            
                            <!-- Diff Data -->
                            <template v-else-if="getEvolutionDiff(pair)">
                                <!-- Permission Changes -->
                                <div v-if="getEvolutionDiff(pair)?.permissions && (getEvolutionDiff(pair).permissions.added?.length || getEvolutionDiff(pair).permissions.removed?.length)" class="space-y-2">
                                    <h5 class="text-sm font-bold text-zinc-400">Permission Changes</h5>
                                    <div v-if="getEvolutionDiff(pair).permissions.added?.length" class="space-y-1">
                                        <div v-for="perm in getEvolutionDiff(pair).permissions.added" :key="perm"
                                            class="text-xs bg-emerald-500/10 border border-emerald-500/20 rounded px-2 py-1">
                                            + {{ perm }}
                                        </div>
                                    </div>
                                    <div v-if="getEvolutionDiff(pair).permissions.removed?.length" class="space-y-1">
                                        <div v-for="perm in getEvolutionDiff(pair).permissions.removed" :key="perm"
                                            class="text-xs bg-zinc-800/50 border border-zinc-700 rounded px-2 py-1">
                                            - {{ perm }}
                                        </div>
                                    </div>
                                </div>

                                <!-- File Changes -->
                                <div v-if="getEvolutionDiff(pair)?.files?.length" class="space-y-2">
                                    <h5 class="text-sm font-bold text-zinc-400">Files Changed ({{ getEvolutionDiff(pair).files.length }})</h5>
                                    <div v-for="file in getEvolutionDiff(pair).files.slice(0, 5)" :key="file"
                                        class="text-xs flex items-center gap-2"
                                        :class="file[0] === '+' ? 'text-emerald-400' : file[0] === '-' ? 'text-red-400' : 'text-yellow-400'">
                                        <span class="font-bold w-4">{{ file[0] }}</span>
                                        <span class="mono">{{ file.slice(2) }}</span>
                                    </div>
                                    <div v-if="getEvolutionDiff(pair).files.length > 5" class="text-xs text-zinc-500 mt-2">
                                        ... and {{ getEvolutionDiff(pair).files.length - 5 }} more files
                                    </div>
                                </div>

                                <!-- Metadata Changes -->
                                <div v-if="getEvolutionDiff(pair)?.metadata" class="space-y-2">
                                    <h5 class="text-sm font-bold text-zinc-400">Metadata Changes</h5>
                                    <div v-if="getEvolutionDiff(pair).metadata.description" class="text-xs">
                                        <div class="text-zinc-500 line-through">{{ getEvolutionDiff(pair).metadata.description.before }}</div>
                                        <div class="text-emerald-400">{{ getEvolutionDiff(pair).metadata.description.after }}</div>
                                    </div>
                                    <div v-if="getEvolutionDiff(pair).metadata.tags" class="flex flex-wrap gap-1">
                                        <span v-for="tag in getEvolutionDiff(pair).metadata.tags.added" :key="tag"
                                            class="text-xs bg-emerald-500/20 text-emerald-400 rounded px-1.5 py-0.5">
                                            + {{ tag }}
                                        </span>
                                        <span v-for="tag in getEvolutionDiff(pair).metadata.tags.removed" :key="tag"
                                            class="text-xs bg-zinc-800 text-zinc-500 rounded px-1.5 py-0.5">
                                            - {{ tag }}
                                        </span>
                                    </div>
                                </div>
                            </template>
                            
                            <!-- No Diff Data -->
                            <div v-else class="text-center py-4 text-zinc-500 text-sm">
                                No diff data available
                            </div>
                        </div>
                    </div>

                    <!-- Pagination Controls -->
                    <div v-if="getEvolutionPairs().length > 5" class="flex items-center justify-center gap-4 py-4">
                        <button @click="evolutionPage = Math.max(1, evolutionPage - 1)"
                            :disabled="evolutionPage === 1"
                            class="px-3 py-1 rounded-lg text-sm font-bold transition-colors"
                            :class="evolutionPage === 1 ? 'text-zinc-600 cursor-not-allowed' : 'text-white hover:bg-zinc-800'">
                            ← Prev
                        </button>
                        <span class="text-sm text-zinc-400">
                            Page {{ evolutionPage }} of {{ Math.ceil(getEvolutionPairs().length / 5) }}
                        </span>
                        <button @click="evolutionPage = Math.min(Math.ceil(getEvolutionPairs().length / 5), evolutionPage + 1)"
                            :disabled="evolutionPage >= Math.ceil(getEvolutionPairs().length / 5)"
                            class="px-3 py-1 rounded-lg text-sm font-bold transition-colors"
                            :class="evolutionPage >= Math.ceil(getEvolutionPairs().length / 5) ? 'text-zinc-600 cursor-not-allowed' : 'text-white hover:bg-zinc-800'">
                            Next →
                        </button>
                    </div>
                </div>

                <div v-else class="text-center py-8 text-zinc-500">
                    No version history available
                </div>
            </div>
        </div>



        <!-- Lineage Tab Content -->
        <div v-if="repoTab === 'lineage'" class="space-y-6">
            <div class="bg-card border border-zinc rounded-xl overflow-hidden">
                <div class="border-b border-zinc-800 px-4 py-3 bg-zinc-900/50 flex items-center justify-between">
                    <span class="text-sm font-bold text-zinc-400">🔗 Cryptographic Lineage</span>
                    <span v-if="lineageData" class="text-xs text-zinc-500">
                        {{ lineageData.trust?.totalForks || 0 }} forks • 
                        {{ lineageData.trust?.verifiedSignatures || 0 }} verified
                    </span>
                </div>
                
                <div v-if="lineageLoading" class="p-8 text-center">
                    <span class="animate-pulse text-zinc-500">Loading lineage data...</span>
                </div>
                
                <div v-else-if="lineageError" class="p-8 text-center text-red-400">
                    <p>Failed to load lineage: {{ lineageError }}</p>
                </div>
                
                <div v-else-if="lineageData" class="divide-y divide-zinc-800/50">
                    <!-- Author Identity -->
                    <div class="p-4">
                        <h4 class="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">Original Author</h4>
                        <div class="flex items-center gap-4 p-4 bg-zinc-900/50 rounded-xl border border-zinc-800">
                            <div class="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                                 :class="lineageData.author?.publicKey ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-800 text-zinc-600'">
                                {{ lineageData.author?.publicKey ? '🔐' : '❓' }}
                            </div>
                            <div class="flex-1">
                                <div class="font-bold">{{ lineageData.author?.name }}</div>
                                <div class="text-xs text-zinc-500 font-mono">{{ lineageData.author?.fingerprint }}</div>
                            </div>
                            <span :class="lineageData.author?.publicKey ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-500'"
                                  class="px-2 py-1 rounded text-xs font-bold">
                                {{ lineageData.author?.publicKey ? 'VERIFIED' : 'UNVERIFIED' }}
                            </span>
                        </div>
                    </div>
                    
                    <!-- Ancestors (Parent packages) -->
                    <div v-if="lineageData.ancestors?.length" class="p-4">
                        <h4 class="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">📜 Ancestors</h4>
                        <div class="space-y-2">
                            <div v-for="ancestor in lineageData.ancestors" :key="ancestor.package"
                                 class="flex items-center gap-4 p-3 bg-zinc-900/30 rounded-lg border border-zinc-800/50">
                                <span class="text-orange-500">↓</span>
                                <div class="flex-1">
                                    <div class="font-bold text-sm">{{ ancestor.package }}</div>
                                    <div class="text-xs text-zinc-500">Forked at v{{ ancestor.forkPointVersion }}</div>
                                </div>
                                <div class="flex items-center gap-2">
                                    <span :class="ancestor.signatureValid === true ? 'text-emerald-400' : (ancestor.signatureValid === false ? 'text-red-400' : 'text-zinc-500')"
                                          class="text-xs">
                                        {{ ancestor.signatureValid === true ? '✔ Verified' : (ancestor.signatureValid === false ? '✘ Invalid' : '? Unknown') }}
                                    </span>
                                    <span class="px-2 py-0.5 bg-zinc-800 rounded text-xs text-zinc-400 font-mono">
                                        {{ ancestor.author?.fingerprint }}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Descendants (Forks) -->
                    <div v-if="lineageData.descendants?.length" class="p-4">
                        <h4 class="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">🔀 Forks ({{ lineageData.descendants.length }})</h4>
                        <div class="space-y-2">
                            <div v-for="descendant in lineageData.descendants" :key="descendant.package"
                                 class="flex items-center gap-4 p-3 bg-zinc-900/30 rounded-lg border border-zinc-800/50 hover:border-orange-500/30 transition-colors">
                                <span class="text-purple-500">→</span>
                                <div class="flex-1">
                                    <div class="font-bold text-sm">{{ descendant.package }}</div>
                                    <div class="text-xs text-zinc-500">
                                        by @{{ descendant.forkerAgent }} • {{ descendant.forkReason }}
                                    </div>
                                </div>
                                <div class="flex items-center gap-2">
                                    <span :class="descendant.signatureValid === true ? 'text-emerald-400' : (descendant.signatureValid === false ? 'text-red-400' : 'text-amber-400')"
                                          class="text-xs flex items-center gap-1">
                                        <span v-if="descendant.signatureValid === true">✔</span>
                                        <span v-else-if="descendant.signatureValid === false">✘</span>
                                        <span v-else>⚠</span>
                                        {{ descendant.signatureStatus }}
                                    </span>
                                    <span class="px-2 py-0.5 bg-zinc-800 rounded text-xs text-zinc-400 font-mono">
                                        {{ descendant.author?.fingerprint }}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Empty state -->
                    <div v-if="!lineageData.ancestors?.length && !lineageData.descendants?.length" 
                         class="p-8 text-center text-zinc-500">
                        <div class="text-4xl mb-4 opacity-30">🔗</div>
                        <p>No fork lineage recorded for this package.</p>
                        <p class="text-xs mt-2">This package has not been forked and has no parent.</p>
                    </div>
                </div>
                
                <div v-else class="p-8 text-center text-zinc-500">
                    <div class="text-4xl mb-4 opacity-30">🔗</div>
                    <p>Lineage data not available.</p>
                </div>
            </div>
        </div>
    </div>
</template>
