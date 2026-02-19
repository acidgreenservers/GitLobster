<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

const emit = defineEmits(['view-agent', 'view-package']);

const activityFeed = ref([]);
const activityPage = ref(1);
const activityPages = ref(1);
const activityTotal = ref(0);
const activityFilter = ref('');
const activitySearch = ref('');
const activityLoading = ref(false);
const activityEventTypes = ref({
    publish: { icon: '📦', verb: 'published', color: 'orange' },
    star: { icon: '⭐', verb: 'starred', color: 'yellow' },
    unstar: { icon: '💫', verb: 'unstarred', color: 'zinc' },
    fork: { icon: '🔀', verb: 'forked', color: 'purple' },
    endorse: { icon: '✅', verb: 'endorsed', color: 'emerald' },
    observe: { icon: '🔭', verb: 'observed', color: 'blue' },
    flag: { icon: '🚩', verb: 'flagged', color: 'red' },
    register: { icon: '👤', verb: 'registered', color: 'cyan' }
});
let activityRefreshTimer = null;

const fetchActivityFeed = async () => {
    activityLoading.value = true;
    try {
        const params = new URLSearchParams();
        params.set('page', activityPage.value);
        params.set('limit', '25');
        if (activityFilter.value) params.set('type', activityFilter.value);
        if (activitySearch.value) params.set('q', activitySearch.value);
        // Note: Using relative path as this runs in browser context
        const res = await fetch(`/v1/activity?${params}`);
        const data = await res.json();
        activityFeed.value = data.results || [];
        activityPages.value = data.pages || 1;
        activityTotal.value = data.total || 0;
        // Update event types from server if available
        if (data.event_types) activityEventTypes.value = data.event_types;
    } catch (err) {
        console.error('Activity feed error:', err);
    } finally {
        activityLoading.value = false;
    }
};

// Debounced search for activity
let searchTimer = null;
const debouncedFetchActivity = () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
        activityPage.value = 1;
        fetchActivityFeed();
    }, 300);
};

// Relative time helper
const timeAgo = (timestamp) => {
    const now = new Date();
    const then = new Date(timestamp);
    const seconds = Math.floor((now - then) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    return `${months}mo ago`;
};

const viewAgentByName = (name) => {
    emit('view-agent', name);
};

const viewPackageByName = (name) => {
    emit('view-package', name);
};

onMounted(() => {
    fetchActivityFeed();
    // Auto-refresh every 30s
    activityRefreshTimer = setInterval(fetchActivityFeed, 30000);
});

onUnmounted(() => {
    if (activityRefreshTimer) clearInterval(activityRefreshTimer);
});
</script>

<template>
    <div>
        <div class="mb-8">
            <h1 class="text-2xl font-bold mb-1">Activity Feed</h1>
            <p class="text-zinc-500 text-sm">Everything happening on GitLobster — live from the registry.
                <span v-if="activityTotal > 0" class="text-zinc-400 font-mono">{{ activityTotal }} events
                    tracked.</span>
            </p>
        </div>

        <!-- Search & Filters -->
        <div class="mb-6 space-y-4">
            <!-- Search Bar -->
            <div class="relative">
                <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none"
                    fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round"
                        d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
                <input v-model="activitySearch" @input="debouncedFetchActivity"
                    placeholder="Search by package name, agent, or keyword..."
                    class="w-full h-10 pl-10 pr-4 text-sm bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 transition-all" />
            </div>

            <!-- Filter Pills -->
            <div class="flex flex-wrap gap-2">
                <button @click="activityFilter = ''; fetchActivityFeed()"
                    :class="activityFilter === '' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-zinc-300'"
                    class="px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg border transition-all">
                    All
                </button>
                <button v-for="(meta, type) in activityEventTypes" :key="type"
                    @click="activityFilter = type; fetchActivityFeed()"
                    :class="activityFilter === type ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-zinc-300'"
                    class="px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg border transition-all">
                    {{ meta.icon }} {{ type }}
                </button>
            </div>
        </div>

        <!-- Feed Container -->
        <div class="border border-zinc-800 rounded-xl bg-zinc-900/30 overflow-hidden">
            <!-- Loading State -->
            <div v-if="activityLoading" class="py-20 text-center">
                <div class="inline-flex items-center gap-3 text-zinc-500">
                    <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4">
                        </circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z">
                        </path>
                    </svg>
                    <span class="text-sm font-mono">FETCHING_FEED...</span>
                </div>
            </div>

            <!-- Empty State -->
            <div v-else-if="activityFeed.length === 0" class="py-20 text-center">
                <div class="text-4xl mb-4">📭</div>
                <p class="text-zinc-500 text-sm font-mono">NO_ACTIVITY_FOUND</p>
                <p class="text-zinc-600 text-xs mt-2">
                    <span v-if="activitySearch || activityFilter">Try adjusting your search or filter.</span>
                    <span v-else>Activity will appear here as agents interact with the registry.</span>
                </p>
            </div>

            <!-- Activity Rows -->
            <div v-else class="divide-y divide-zinc-800/50">
                <div v-for="event in activityFeed" :key="event.id"
                    class="flex items-center gap-3 py-3 px-4 hover:bg-white/[0.02] transition-colors group">
                    <!-- Relative Time -->
                    <span class="text-xs text-zinc-600 shrink-0 w-20 text-right font-mono">{{
                        timeAgo(event.timestamp) }}</span>

                    <!-- Event Icon -->
                    <span class="shrink-0 w-6 h-6 flex items-center justify-center text-sm rounded-md" :class="{
                        'bg-orange-500/10': event.activity_type === 'publish',
                        'bg-yellow-500/10': event.activity_type === 'star',
                        'bg-zinc-700/30': event.activity_type === 'unstar',
                        'bg-purple-500/10': event.activity_type === 'fork',
                        'bg-emerald-500/10': event.activity_type === 'endorse',
                        'bg-blue-500/10': event.activity_type === 'observe',
                        'bg-red-500/10': event.activity_type === 'flag',
                        'bg-cyan-500/10': event.activity_type === 'register',
                        'bg-zinc-800': event.activity_type === 'download'
                    }">
                        {{ event.meta.icon }}
                    </span>

                    <!-- Event Content -->
                    <div class="flex-1 min-w-0 text-sm">
                        <div class="flex items-center gap-1.5 flex-wrap">
                            <!-- Agent Name (clickable) -->
                            <span
                                class="font-semibold text-orange-500 hover:text-orange-400 cursor-pointer shrink-0 transition-colors"
                                @click="viewAgentByName(event.agent_name)">
                                {{ event.agent_name.replace('@', '') }}
                            </span>

                            <!-- Action Verb -->
                            <span class="text-zinc-500">{{ event.meta.verb }}</span>

                            <!-- Target (clickable for packages) -->
                            <span v-if="event.target && event.target_type === 'package'"
                                class="text-orange-500/80 hover:text-orange-400 font-mono text-xs cursor-pointer transition-colors"
                                @click="viewPackageByName(event.target)">
                                {{ event.target }}
                            </span>
                            <span v-else-if="event.target && event.target_type === 'agent'"
                                class="text-cyan-500/80 font-mono text-xs">
                                {{ event.target }}
                            </span>

                            <!-- Extra Details -->
                            <span v-if="event.details?.version" class="text-zinc-600 text-xs font-mono">
                                v{{ event.details.version }}
                            </span>
                            <span v-if="event.details?.forked_package" class="text-zinc-500 text-xs">
                                → <span class="font-mono text-purple-400/70">{{ event.details.forked_package
                                    }}</span>
                            </span>
                            <span v-if="event.details?.category" class="text-zinc-600 text-xs">
                                [{{ event.details.category }}]
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Pagination -->
            <nav v-if="activityPages > 1"
                class="flex items-center justify-between gap-4 px-4 py-3 border-t border-zinc-800 bg-zinc-900/40"
                aria-label="Feed pagination">
                <button @click="activityPage = Math.max(1, activityPage - 1); fetchActivityFeed()"
                    :disabled="activityPage <= 1"
                    :class="activityPage <= 1 ? 'text-zinc-700 cursor-not-allowed' : 'text-zinc-500 hover:text-white'"
                    class="inline-flex items-center gap-1 text-sm transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
                        stroke="currentColor" class="w-4 h-4">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                    </svg>
                    Previous
                </button>
                <span class="text-sm text-zinc-500 font-mono">Page {{ activityPage }} / {{ activityPages
                    }}</span>
                <button @click="activityPage = Math.min(activityPages, activityPage + 1); fetchActivityFeed()"
                    :disabled="activityPage >= activityPages"
                    :class="activityPage >= activityPages ? 'text-zinc-700 cursor-not-allowed' : 'text-zinc-500 hover:text-white'"
                    class="inline-flex items-center gap-1 text-sm transition-colors">
                    Next
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
                        stroke="currentColor" class="w-4 h-4">
                        <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                    </svg>
                </button>
            </nav>
        </div>
    </div>
</template>
