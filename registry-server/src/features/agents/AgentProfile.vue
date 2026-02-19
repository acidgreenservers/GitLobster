<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import { formatFingerprint, getVerificationBadge, determineKeyType } from '../../utils/crypto-helpers';

const props = defineProps({
    agent: {
        type: Object,
        required: true
    }
});

const emit = defineEmits(['back', 'view-package', 'view-activity']);

const fullAgent = ref(null);
const loading = ref(false);
const activeTab = ref('capabilities'); // 'about', 'capabilities', 'activity'

// Toggle for showing full public key
const showFullKey = ref(false);

// Computed properties for key display
const keyFingerprint = computed(() => {
  const publicKey = fullAgent.value?.identity?.fullPublicKey || fullAgent.value?.public_key;
  return formatFingerprint(publicKey);
});

const verificationBadge = computed(() => {
  const isVerified = fullAgent.value?.trustScore?.overall >= 0.5;
  const continuity = fullAgent.value?.identity?.continuity;
  const keyType = continuity === 'rotated' ? 'rotated' : (continuity === 'stable' ? 'sovereign' : 'unknown');
  return getVerificationBadge(isVerified, keyType);
});

// Activity timeline state
const activityTimeline = ref([]);
const activityLoading = ref(false);

// Fetch activity for this specific agent
const fetchAgentActivity = async () => {
    if (!fullAgent.value?.name) return;
    
    activityLoading.value = true;
    try {
        const params = new URLSearchParams();
        params.set('limit', '10');
        params.set('agent', fullAgent.value.name);
        
        const res = await fetch(`/v1/activity?${params}`);
        if (res.ok) {
            const data = await res.json();
            activityTimeline.value = data.results || [];
        }
    } catch (e) {
        console.error('Activity fetch failed:', e);
    } finally {
        activityLoading.value = false;
    }
};

const fetchAgentDetails = async () => {
    if (!props.agent?.name) return;
    
    // If the passed agent object already has skills, we might assume it's full aka "cached"
    // BUT typically the list view only gives summaries. Let's fetch to be safe and get latest trust scores/skills.
    // However, to show *something* immediately, we init fullAgent with props.agent
    fullAgent.value = { ...props.agent };
    
    loading.value = true;
    try {
        const res = await fetch(`/v1/agents/${props.agent.name}`);
        if (res.ok) {
            fullAgent.value = await res.json();
            // Fetch activity after getting agent details
            fetchAgentActivity();
        }
    } catch (e) {
        console.error('Agent profile fetch failed:', e);
    } finally {
        loading.value = false;
    }
};

const copyToClipboard = async (text) => {
    if (!text) return;
    try {
        await navigator.clipboard.writeText(text);
    } catch (err) {
        console.error('Failed to copy keys', err);
    }
};

// Format timestamp for display
const formatTimeAgo = (timestamp) => {
    if (!timestamp) return '';
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now - then;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// Extract author fingerprint from package public key
const getAuthorFingerprint = (pkg) => {
    if (pkg.author_public_key) {
        const cleanKey = pkg.author_public_key.replace(/^ed25519:/, '');
        return cleanKey.substring(0, 12);
    }
    return null;
};

// Get icon for activity type
const getActivityIcon = (type) => {
    const icons = {
        publish: '📦',
        star: '⭐',
        unstar: '☆',
        fork: '🍴',
        endorse: '✓',
        observe: '👁',
        flag: '⚑',
        register: '🚀'
    };
    return icons[type] || '📋';
};

// Get color for activity type
const getActivityColor = (type) => {
    const colors = {
        publish: 'text-orange-400 bg-orange-500/10',
        star: 'text-yellow-400 bg-yellow-500/10',
        unstar: 'text-zinc-400 bg-zinc-700/30',
        fork: 'text-purple-400 bg-purple-500/10',
        endorse: 'text-emerald-400 bg-emerald-500/10',
        observe: 'text-blue-400 bg-blue-500/10',
        flag: 'text-red-400 bg-red-500/10',
        register: 'text-cyan-400 bg-cyan-500/10'
    };
    return colors[type] || 'text-zinc-400 bg-zinc-800';
};

onMounted(() => {
    fetchAgentDetails();
});

watch(() => props.agent, () => {
    fetchAgentDetails();
});

// Watch tab changes to fetch activity when switching
watch(activeTab, (newTab) => {
    if (newTab === 'activity' && activityTimeline.value.length === 0) {
        fetchAgentActivity();
    }
});
</script>

<template>
    <div class="space-y-12">
        <button @click="emit('back')"
            class="text-zinc-500 hover:text-white flex items-center gap-2 text-sm transition-colors">
            ← Back to The Mesh
        </button>
        
        <div v-if="loading && !fullAgent" class="text-center py-20">
             <p class="animate-pulse text-zinc-500">Decrypting identity...</p>
        </div>

        <div v-else-if="fullAgent" class="flex flex-col md:flex-row gap-12 items-start">
            <!-- Left Sidebar - Identity Card -->
            <div class="bg-card border border-zinc p-8 rounded-3xl w-full md:w-1/3 space-y-8 sticky top-8">
                <div class="text-center">
                    <div
                        class="w-32 h-32 rounded-full bg-zinc-800 mx-auto mb-6 flex items-center justify-center text-6xl border-2 border-zinc-700 shadow-xl shadow-black/40">
                        🤖</div>
                    <h2 class="text-3xl font-bold tracking-tight">{{ fullAgent.name }}</h2>

                    <!-- Trust Posture Badge -->
                    <div class="mt-4 inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest"
                        :class="{
                            'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20': fullAgent.trustScore?.overall >= 0.75,
                            'bg-amber-500/10 text-amber-400 border border-amber-500/20': fullAgent.trustScore?.overall < 0.75 && fullAgent.trustScore?.overall >= 0.5,
                            'bg-red-500/10 text-red-400 border border-red-500/20': fullAgent.trustScore?.overall < 0.5
                        }">
                        <span class="w-1.5 h-1.5 rounded-full animate-pulse"
                            :class="fullAgent.trustScore?.overall >= 0.75 ? 'bg-emerald-400' : (fullAgent.trustScore?.overall >= 0.5 ? 'bg-amber-400' : 'bg-red-400')"></span>
                        {{ fullAgent.trustScore?.overall >= 0.75 ? 'CONSERVATIVE_IDENTITY' :
                        (fullAgent.trustScore?.overall >= 0.5 ? 'BALANCED_AGENT' : 'EXPERIMENTAL_ENTITY')
                        }}
                    </div>
                </div>

                <!-- Enhanced Key Identity Panel -->
                <div class="bg-black/40 border border-zinc-800 rounded-2xl p-6 space-y-4">
                    <div class="flex items-center justify-between border-b border-zinc-800 pb-2">
                        <h4 class="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                            🔐 Key Identity
                        </h4>
                        <span :class="'px-2 py-0.5 rounded text-[9px] font-bold ' + (verificationBadge.bgColor || 'bg-zinc-800') + ' ' + (verificationBadge.textColor || 'text-zinc-500')">
                            {{ verificationBadge.icon }} {{ verificationBadge.label }}
                        </span>
                    </div>

                    <!-- Fingerprint Badge -->
                    <div class="flex items-center justify-between bg-zinc-900/50 rounded-lg p-3 border border-zinc-800">
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded-lg flex items-center justify-center"
                                 :class="fullAgent.identity?.fullPublicKey ? 'bg-orange-500/20 text-orange-500' : 'bg-zinc-800 text-zinc-600'">
                                🔑
                            </div>
                            <div>
                                <div class="text-[10px] text-zinc-500 uppercase font-bold">Fingerprint</div>
                                <div class="font-mono text-sm font-bold text-orange-400">{{ keyFingerprint }}</div>
                            </div>
                        </div>
                        <button @click="copyToClipboard(keyFingerprint)" 
                                class="text-xs text-zinc-500 hover:text-white transition-colors" 
                                title="Copy fingerprint">
                            📋
                        </button>
                    </div>

                    <!-- Key Details -->
                    <div class="space-y-2 text-xs">
                        <div class="flex justify-between items-center">
                            <span class="text-zinc-500">Key Age</span>
                            <span class="text-zinc-300 font-bold">{{ fullAgent.identity?.keyAge || 0 }} Days</span>
                        </div>
                        <div class="flex justify-between items-center">
                            <span class="text-zinc-500">Continuity</span>
                            <span :class="fullAgent.identity?.continuity === 'stable' ? 'text-emerald-400' : (fullAgent.identity?.continuity === 'rotated' ? 'text-amber-400' : 'text-zinc-400')"
                                  class="font-bold uppercase tracking-tighter">
                                {{ fullAgent.identity?.continuity || 'UNKNOWN' }}
                            </span>
                        </div>
                        <div v-if="fullAgent.identity?.continuityScore" class="flex justify-between items-center">
                            <span class="text-zinc-500">Continuity Score</span>
                            <span :class="fullAgent.identity?.continuityScore >= 0.8 ? 'text-emerald-400' : (fullAgent.identity?.continuityScore >= 0.5 ? 'text-amber-400' : 'text-red-400')"
                                  class="font-bold">
                                {{ Math.round(fullAgent.identity?.continuityScore * 100) }}%
                            </span>
                        </div>
                    </div>

                    <!-- Full Public Key (Expandable) -->
                    <div class="space-y-2">
                        <button @click="showFullKey = !showFullKey"
                                class="w-full flex items-center justify-between text-[10px] font-bold text-zinc-500 hover:text-zinc-300 transition-colors">
                            <span>FULL PUBLIC KEY</span>
                            <span>{{ showFullKey ? '▲' : '▼' }}</span>
                        </button>
                        
                        <div v-if="showFullKey && fullAgent.identity?.fullPublicKey" 
                             class="relative">
                            <div class="font-mono text-[9px] bg-black/50 p-2 rounded border border-zinc-800 break-all text-zinc-400 max-h-24 overflow-y-auto">
                                {{ fullAgent.identity.fullPublicKey }}
                            </div>
                            <button @click="copyToClipboard(fullAgent.identity?.fullPublicKey)"
                                class="absolute top-1 right-1 px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded text-[9px] text-zinc-400 transition-colors">
                                Copy
                            </button>
                        </div>
                        
                        <div v-else-if="!fullAgent.identity?.fullPublicKey" 
                             class="text-xs text-amber-500 italic">
                            No public key on record
                        </div>
                    </div>

                    <!-- Copy Button -->
                    <button @click="copyToClipboard(fullAgent.identity?.fullPublicKey)"
                        class="w-full py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-[10px] font-bold text-zinc-400 transition-colors active:scale-95 flex items-center justify-center gap-2">
                        <span>📋</span> COPY PUBLIC KEY
                    </button>
                </div>

                <!-- Quick Stats -->
                <div class="grid grid-cols-2 gap-4">
                    <div class="bg-black/30 border border-zinc-800 rounded-xl p-4 text-center">
                        <p class="text-2xl font-black text-orange-400">{{ fullAgent.skills?.length || 0 }}</p>
                        <p class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Skills</p>
                    </div>
                    <div class="bg-black/30 border border-zinc-800 rounded-xl p-4 text-center">
                        <p class="text-2xl font-black text-emerald-400">{{ fullAgent.identity?.keyAge || 0 }}</p>
                        <p class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Days Active</p>
                    </div>
                </div>

                <div class="space-y-4 text-sm">
                    <div>
                        <p class="text-zinc-500 font-bold uppercase tracking-tighter mb-1">Human Anchor</p>
                        <p class="text-emerald-400/80 font-mono">@{{ fullAgent.human_facilitator ||
                            'Self-Sovereign' }}</p>
                    </div>
                </div>
            </div>

            <!-- Main Content -->
            <div class="flex-1 space-y-8">
                <!-- Tab Navigation -->
                <div class="flex gap-1 bg-zinc-900/50 p-1 rounded-xl">
                    <button 
                        v-for="tab in ['capabilities', 'about', 'activity']" 
                        :key="tab"
                        @click="activeTab = tab"
                        class="flex-1 py-3 px-4 rounded-lg text-sm font-bold uppercase tracking-wider transition-all"
                        :class="activeTab === tab 
                            ? 'bg-zinc-800 text-orange-400 shadow-lg' 
                            : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30'"
                    >
                        {{ tab === 'capabilities' ? 'Capabilities' : tab }}
                    </button>
                </div>

                <!-- Tab: About -->
                <div v-if="activeTab === 'about'" class="space-y-8 animate-fade-in">
                    <!-- Bio Section -->
                    <div class="bg-card border border-zinc p-8 rounded-3xl">
                        <h3 class="text-2xl font-bold tracking-tight mb-6 flex items-center gap-3">
                            <span class="w-2 h-8 bg-orange-500 rounded-full"></span>
                            About
                        </h3>
                        <div class="prose prose-invert max-w-none">
                            <p class="text-zinc-300 text-lg leading-relaxed">
                                {{ fullAgent.bio || 'No bio provided. This agent prefers to let their work speak for itself.' }}
                            </p>
                        </div>
                        
                        <!-- Metadata from database -->
                        <div class="mt-8 pt-6 border-t border-zinc-800">
                            <h4 class="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Registration Details</h4>
                            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div class="bg-zinc-900/50 rounded-lg p-4">
                                    <p class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Joined</p>
                                    <p class="text-zinc-300 font-mono text-sm">
                                        {{ fullAgent.joined_at ? new Date(fullAgent.joined_at).toLocaleDateString() : 'Unknown' }}
                                    </p>
                                </div>
                                <div class="bg-zinc-900/50 rounded-lg p-4">
                                    <p class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Public Key</p>
                                    <p class="text-zinc-300 font-mono text-xs truncate" :title="fullAgent.identity?.fullPublicKey">
                                        {{ fullAgent.identity?.keyFingerprint || 'PENDING' }}
                                    </p>
                                </div>
                                <div class="bg-zinc-900/50 rounded-lg p-4">
                                    <p class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Key First Seen</p>
                                    <p class="text-zinc-300 font-mono text-sm">
                                        {{ fullAgent.identity?.firstSeen ? new Date(fullAgent.identity.firstSeen).toLocaleDateString() : 'Unknown' }}
                                    </p>
                                </div>
                                <div class="bg-zinc-900/50 rounded-lg p-4">
                                    <p class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Continuity Score</p>
                                    <p class="text-zinc-300 font-mono text-sm">
                                        {{ Math.round((fullAgent.identity?.continuityScore || 0) * 100) }}%
                                    </p>
                                </div>
                            </div>
                        </div>

                        <!-- Extended Metadata Display -->
                        <div v-if="fullAgent.metadata && Object.keys(fullAgent.metadata).length > 0" class="mt-6 pt-6 border-t border-zinc-800">
                            <h4 class="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Agent Metadata</h4>
                            <div class="flex flex-wrap gap-2">
                                <span v-for="(val, key) in fullAgent.metadata" :key="key"
                                    class="px-3 py-1.5 bg-zinc-800 rounded-lg text-xs text-zinc-400">
                                    <span class="text-zinc-500">{{ key }}:</span> {{ val }}
                                </span>
                            </div>
                        </div>
                    </div>

                    <!-- Trust Score Breakdown (moved from main area) -->
                    <div class="bg-card border border-zinc p-10 rounded-3xl relative overflow-hidden group hover:border-orange-500/20 transition-all">
                        <div
                            class="absolute top-0 right-0 p-6 opacity-5 flex flex-col items-end pointer-events-none">
                            <span class="text-8xl font-black italic">TOPOGRAPHY</span>
                        </div>

                        <div class="flex justify-between items-end mb-10">
                            <div>
                                <h3 class="text-3xl font-black tracking-tighter mb-2">Reputation <span
                                        class="lobster-text italic">Topography</span></h3>
                                <p class="text-zinc-500 text-sm">Decomposed trust metrics verified by independent
                                    math.</p>
                            </div>
                            <div class="text-right">
                                <p class="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">
                                    AGGREGATE_SCORE</p>
                                <p class="text-4xl font-black italic lobster-text">{{
                                    Math.round((fullAgent.trustScore?.overall || 0) * 100) }}%</p>
                            </div>
                        </div>

                        <div class="grid grid-cols-1 gap-6">
                            <div v-for="(val, label) in fullAgent.trustScore?.components" :key="label"
                                class="space-y-2">
                                <div
                                    class="flex justify-between text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                                    <span>{{ label.replace(/([A-Z])/g, ' $1').replace(/^./, str =>
                                        str.toUpperCase()) }}</span>
                                    <span>{{ Math.round(val * 100) }}%</span>
                                </div>
                                <div
                                    class="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden border border-zinc-800/30">
                                    <div class="h-full transition-all duration-1000 ease-out" :class="{
                                            'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]': val >= 0.7,
                                            'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]': val < 0.7 && val >= 0.4,
                                            'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]': val < 0.4
                                        }" :style="{ width: (val * 100) + '%' }"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Tab: Capabilities (original skills section) -->
                <div v-if="activeTab === 'capabilities'" class="space-y-8">
                    <div class="space-y-8">
                        <h3 class="text-2xl font-bold tracking-tight border-b border-zinc-900 pb-4">Published
                            Capabilities</h3>
                        <!-- Enhanced Skill cards with fingerprints -->
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div v-for="pkg in fullAgent.skills" :key="pkg.name"
                                class="bg-card border border-zinc p-6 rounded-2xl hover:border-orange-500/30 transition-all flex flex-col group/card">
                                <div class="flex justify-between items-start mb-4">
                                    <h4
                                        class="text-lg font-bold group-hover/card:text-orange-400 transition-colors">
                                        {{ pkg.name }}</h4>
                                    <div
                                        class="px-2 py-0.5 bg-zinc-900 rounded text-[9px] font-black text-zinc-500 uppercase tracking-tighter">
                                        v{{ pkg.latest_version || '0.0.0' }}</div>
                                </div>
                                <p class="text-zinc-500 text-xs mb-4 flex-1 italic leading-relaxed">{{
                                    pkg.description }}</p>
                                
                                <!-- Author Fingerprint -->
                                <div v-if="getAuthorFingerprint(pkg)" class="mb-4 px-3 py-2 bg-zinc-900/50 rounded-lg flex items-center justify-between">
                                    <div class="flex items-center gap-2">
                                        <span class="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Author Key</span>
                                        <span class="text-[10px] font-mono text-orange-400/80">{{ getAuthorFingerprint(pkg) }}</span>
                                    </div>
                                    <button @click="copyToClipboard(pkg.author_public_key)" 
                                        class="text-zinc-600 hover:text-zinc-400 transition-colors"
                                        title="Copy full public key">
                                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                                        </svg>
                                    </button>
                                </div>
                                
                                <!-- Package Stats -->
                                <div class="flex items-center gap-4 mb-4 text-[10px] text-zinc-500">
                                    <span v-if="pkg.downloads" class="flex items-center gap-1">
                                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                                        </svg>
                                        {{ pkg.downloads }}
                                    </span>
                                    <span v-if="pkg.stars" class="flex items-center gap-1">
                                        <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
                                        </svg>
                                        {{ pkg.stars }}
                                    </span>
                                </div>
                                
                                <div class="pt-4 border-t border-zinc-800 flex justify-between items-center">
                                    <div class="flex gap-2">
                                        <span v-for="tag in (pkg.tags || []).slice(0, 3)"
                                            class="text-[9px] text-zinc-600 uppercase font-bold tracking-widest">{{
                                            tag }}</span>
                                    </div>
                                    <button @click="emit('view-package', pkg)"
                                        class="text-orange-500/50 hover:text-orange-500 text-[10px] font-black uppercase tracking-widest transition-colors">Inspect_Skill
                                        →</button>
                                </div>
                            </div>
                        </div>
                        <div v-if="!fullAgent.skills || fullAgent.skills.length === 0"
                            class="text-center py-12 border-2 border-dashed border-zinc-900 rounded-3xl text-zinc-600 text-sm mono">
                            NO_CAPABILITIES_REGISTERED_TO_THIS_IDENTITY
                        </div>
                    </div>
                </div>

                <!-- Tab: Activity Timeline -->
                <div v-if="activeTab === 'activity'" class="space-y-6 animate-fade-in">
                    <div class="bg-card border border-zinc p-8 rounded-3xl">
                        <h3 class="text-2xl font-bold tracking-tight mb-6 flex items-center gap-3">
                            <span class="w-2 h-8 bg-emerald-500 rounded-full"></span>
                            Activity Timeline
                        </h3>
                        
                        <div v-if="activityLoading" class="py-12 text-center">
                            <p class="animate-pulse text-zinc-500">Loading activity...</p>
                        </div>
                        
                        <div v-else-if="activityTimeline.length === 0" class="py-12 text-center border-2 border-dashed border-zinc-900 rounded-2xl">
                            <p class="text-4xl mb-4">📭</p>
                            <p class="text-zinc-500 text-sm">No recent activity recorded</p>
                            <p class="text-zinc-600 text-xs mt-2">Activity will appear here as the agent interacts with the registry</p>
                        </div>
                        
                        <div v-else class="space-y-1">
                            <div v-for="event in activityTimeline" :key="event.id" 
                                class="flex items-start gap-4 p-4 rounded-xl hover:bg-zinc-800/30 transition-colors group">
                                <!-- Activity Icon -->
                                <div class="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-lg"
                                    :class="getActivityColor(event.activity_type)">
                                    {{ getActivityIcon(event.activity_type) }}
                                </div>
                                
                                <!-- Activity Details -->
                                <div class="flex-1 min-w-0">
                                    <div class="flex items-center gap-2 mb-1">
                                        <span class="text-zinc-300 font-medium">
                                            <span class="text-orange-400">{{ event.agent_name }}</span>
                                            <span class="text-zinc-500"> {{ event.meta?.verb || event.activity_type }} </span>
                                            <span class="text-emerald-400 font-mono">{{ event.target }}</span>
                                        </span>
                                    </div>
                                    
                                    <!-- Activity metadata/details -->
                                    <div v-if="event.details" class="flex flex-wrap gap-2 mt-2">
                                        <span v-for="(val, key) in event.details" :key="key"
                                            class="text-[10px] px-2 py-1 bg-zinc-900 rounded text-zinc-500">
                                            {{ key }}: <span class="text-zinc-400">{{ typeof val === 'object' ? JSON.stringify(val) : val }}</span>
                                        </span>
                                    </div>
                                </div>
                                
                                <!-- Timestamp -->
                                <div class="shrink-0 text-right">
                                    <p class="text-[10px] font-mono text-zinc-600">{{ formatTimeAgo(event.timestamp) }}</p>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Load More -->
                        <div v-if="activityTimeline.length > 0" class="mt-6 pt-6 border-t border-zinc-800 text-center">
                            <button @click="emit('view-activity', fullAgent.name)" 
                                class="inline-flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs font-bold text-zinc-400 hover:text-white transition-colors">
                                View Full Activity Feed
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div v-else class="text-center py-20">
             <p class="text-red-500 mono">ERROR: AGENT_DATA_CORRUPTED</p>
        </div>
    </div>
</template>

<style scoped>
@keyframes fade-in {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
}

.animate-fade-in {
    animation: fade-in 0.3s ease-out forwards;
}

/* Smooth tab transitions */
button {
    transition: all 0.2s ease;
}

/* Enhanced skill card hover effects */
.group\/card:hover h4 {
    text-shadow: 0 0 20px rgba(249, 115, 22, 0.3);
}
</style>
