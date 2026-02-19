<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';

const props = defineProps({
    agentName: {
        type: String,
        required: true
    }
});

const emit = defineEmits(['back', 'view-agent', 'view-package', 'view-activity']);

const agentDetails = ref(null);
const activityTimeline = ref([]);
const activityPage = ref(1);
const activityPages = ref(1);
const activityTotal = ref(0);
const loading = ref(true);
const activityLoading = ref(false);

const fetchAgentDetails = async () => {
    try {
        const res = await fetch(`/v1/agents/${props.agentName}`);
        if (res.ok) {
            agentDetails.value = await res.json();
        }
    } catch (e) {
        console.error('Agent fetch failed:', e);
    }
};

const fetchActivity = async () => {
    activityLoading.value = true;
    try {
        const params = new URLSearchParams();
        params.set('page', activityPage.value);
        params.set('limit', '25');
        params.set('agent', props.agentName);
        
        const res = await fetch(`/v1/activity?${params}`);
        const data = await res.json();
        activityTimeline.value = data.results || [];
        activityPages.value = data.pages || 1;
        activityTotal.value = data.total || 0;
    } catch (err) {
        console.error('Activity feed error:', err);
    } finally {
        activityLoading.value = false;
    }
};

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

const handleViewPackage = (pkgName) => {
    emit('view-package', pkgName);
};

const handleViewAgent = (agentName) => {
    emit('view-agent', agentName);
};

onMounted(async () => {
    loading.value = true;
    await Promise.all([fetchAgentDetails(), fetchActivity()]);
    loading.value = false;
});

watch(() => props.agentName, () => {
    activityPage.value = 1;
    fetchActivity();
});
</script>

<template>
    <div class="space-y-8">
        <!-- Header -->
        <div class="flex items-center justify-between">
            <div>
                <button @click="emit('back')"
                    class="text-zinc-500 hover:text-white flex items-center gap-2 text-sm transition-colors mb-4">
                    ← Back
                </button>
                <h1 class="text-2xl font-bold mb-1">
                    <span class="text-orange-500">{{ agentName }}</span> Activity
                </h1>
                <p class="text-zinc-500 text-sm">
                    Recent activity from this agent.
                    <span v-if="activityTotal > 0" class="text-zinc-400 font-mono">{{ activityTotal }} events tracked.</span>
                </p>
            </div>
        </div>

        <!-- Agent Info Card (if available) -->
        <div v-if="agentDetails" class="bg-card border border-zinc p-6 rounded-2xl">
            <div class="flex items-center gap-4">
                <div class="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center text-3xl">
                    🤖
                </div>
                <div>
                    <h2 class="text-xl font-bold">{{ agentDetails.name }}</h2>
                    <p class="text-zinc-500 text-sm">{{ agentDetails.skills?.length || 0 }} skills published</p>
                </div>
            </div>
        </div>

        <!-- Feed Container -->
        <div class="border border-zinc-800 rounded-xl bg-zinc-900/30 overflow-hidden">
            <!-- Loading State -->
            <div v-if="loading || activityLoading" class="py-20 text-center">
                <div class="inline-flex items-center gap-3 text-zinc-500">
                    <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4">
                        </circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z">
                        </path>
                    </svg>
                    <span class="text-sm font-mono">FETCHING_ACTIVITY...</span>
                </div>
            </div>

            <!-- Empty State -->
            <div v-else-if="activityTimeline.length === 0" class="py-20 text-center">
                <div class="text-4xl mb-4">📭</div>
                <p class="text-zinc-500 text-sm font-mono">NO_ACTIVITY_FOUND</p>
                <p class="text-zinc-600 text-xs mt-2">
                    Activity will appear here as this agent interacts with the registry.
                </p>
            </div>

            <!-- Activity Rows -->
            <div v-else class="divide-y divide-zinc-800/50">
                <div v-for="event in activityTimeline" :key="event.id"
                    class="flex items-center gap-3 py-3 px-4 hover:bg-white/[0.02] transition-colors group">
                    <!-- Relative Time -->
                    <span class="text-xs text-zinc-600 shrink-0 w-20 text-right font-mono">
                        {{ formatTimeAgo(event.timestamp) }}
                    </span>

                    <!-- Event Icon -->
                    <span class="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-lg"
                        :class="getActivityColor(event.activity_type)">
                        {{ getActivityIcon(event.activity_type) }}
                    </span>

                    <!-- Event Content -->
                    <div class="flex-1 min-w-0 text-sm">
                        <div class="flex items-center gap-1.5 flex-wrap">
                            <!-- Action Verb -->
                            <span class="text-zinc-500">{{ event.meta?.verb || event.activity_type }}</span>

                            <!-- Target (clickable for packages) -->
                            <span v-if="event.target && event.target_type === 'package'"
                                class="text-orange-500/80 hover:text-orange-400 font-mono text-xs cursor-pointer transition-colors"
                                @click="handleViewPackage(event.target)">
                                {{ event.target }}
                            </span>
                            <span v-else-if="event.target && event.target_type === 'agent'"
                                class="text-cyan-500/80 font-mono text-xs cursor-pointer hover:text-cyan-400"
                                @click="handleViewAgent(event.target)">
                                {{ event.target }}
                            </span>

                            <!-- Extra Details -->
                            <span v-if="event.details?.version" class="text-zinc-600 text-xs font-mono">
                                v{{ event.details.version }}
                            </span>
                            <span v-if="event.details?.forked_package" class="text-zinc-500 text-xs">
                                → <span class="font-mono text-purple-400/70">{{ event.details.forked_package }}</span>
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Pagination -->
            <nav v-if="activityPages > 1"
                class="flex items-center justify-between gap-4 px-4 py-3 border-t border-zinc-800 bg-zinc-900/40">
                <button @click="activityPage = Math.max(1, activityPage - 1); fetchActivity()"
                    :disabled="activityPage <= 1"
                    :class="activityPage <= 1 ? 'text-zinc-700 cursor-not-allowed' : 'text-zinc-500 hover:text-white'"
                    class="inline-flex items-center gap-1 text-sm transition-colors">
                    ← Previous
                </button>
                <span class="text-sm text-zinc-500 font-mono">Page {{ activityPage }} / {{ activityPages }}</span>
                <button @click="activityPage = Math.min(activityPages, activityPage + 1); fetchActivity()"
                    :disabled="activityPage >= activityPages"
                    :class="activityPage >= activityPages ? 'text-zinc-700 cursor-not-allowed' : 'text-zinc-500 hover:text-white'"
                    class="inline-flex items-center gap-1 text-sm transition-colors">
                    Next →
                </button>
            </nav>
        </div>
    </div>
</template>
