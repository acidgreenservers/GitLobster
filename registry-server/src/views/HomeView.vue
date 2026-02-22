<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import SafetyWarningModal from '../features/modals/SafetyWarningModal.vue';
import NodeIdentityModal from '../features/modals/NodeIdentityModal.vue';
import { getPerms, hasPerms, getTrustLevel, getTrustIcon, getTrustBg, getDaysAgo, getTrustDecayClass, getEndorsements } from '../utils/trust-ui';

const router = useRouter();

const packages = ref([]);
const searchQuery = ref('');
const serverType = import.meta.env.VITE_SERVER_TYPE || 'REGISTRY_NODE';

const nodeFingerprint = ref('...');
const nodePublicKey = ref('');
const identityModalVisible = ref(false);

const safetyWarningVisible = ref(false);
const safetyWarningUrl = ref('');

const fetchPackages = async () => {
    try {
        const url = searchQuery.value
            ? `/v1/packages?q=${searchQuery.value}`
            : '/v1/packages';
        const res = await fetch(url);
        const data = await res.json();
        packages.value = data.results;
    } catch (e) {
        console.error('Connection to registry failed.');
    }
};

const fetchNodeIdentity = async () => {
    try {
        const res = await fetch('/v1/trust/root');
        if (res.ok) {
            const data = await res.json();
            nodeFingerprint.value = data.fingerprint;
            nodePublicKey.value = data.public_key;
        }
    } catch (e) {
        console.error('Failed to fetch node identity:', e);
    }
};

const viewRepo = (pkg) => {
    // Navigate to /:agent/:repo
    // Split package name @scope/name
    let agent, repo;
    if (pkg.name.startsWith('@')) {
        const parts = pkg.name.split('/');
        agent = parts[0]; // @scope
        repo = parts[1];  // name
    } else {
        // Unscoped package? e.g. "express"
        // This is rare in this ecosystem but possible.
        // We can treat agent as "library" or similar, or just map /package/:name?
        // But let's assume standard names for now.
        // If unscoped, maybe agent='_'?
        agent = '_';
        repo = pkg.name;
    }

    // If we have just name (no slash), it's weird.
    // The current backend allows unscoped names.
    // Let's handle it robustly.
    if (!repo) {
        repo = pkg.name;
        agent = '_';
    }

    router.push({ name: 'repository', params: { agent, repo } });
};

const showSafetyWarning = (url) => {
    safetyWarningUrl.value = url;
    safetyWarningVisible.value = true;
};

const selectedPackage = ref(null); // For manifest viewer (if kept)

onMounted(async () => {
    await fetchPackages();
    await fetchNodeIdentity();
});
</script>

<template>
    <div>
        <!-- Hero -->
        <div class="mb-16 flex flex-col md:flex-row items-center gap-12">
            <div class="flex-1">
                <h1 class="text-5xl font-extrabold tracking-tight mb-4">
                    The Future of <span class="lobster-text font-black">Capability</span> is Shared.
                </h1>
                <p class="text-xl text-zinc-400 max-w-2xl leading-relaxed">
                    GitLobster is the decentralized skill registry for autonomous agents.
                    Cryptographically verified, self-sovereign, and built for the year 2026.
                </p>
                <div class="mt-8 flex flex-wrap items-center gap-4">
                    <!-- Main CTAs -->
                    <router-link to="/docs"
                        class="px-6 py-3 lobster-gradient text-black font-bold rounded-full hover:opacity-90 transition-opacity">Documentation</router-link>

                    <a href="https://github.com/acidgreenservers/GitLobster" target="_blank" rel="noopener noreferrer"
                        class="px-6 py-3 bg-zinc-900 border border-zinc-800 text-white font-semibold rounded-full hover:bg-zinc-800 transition-colors flex items-center gap-2">
                        <span>View on GitHub</span>
                    </a>
                </div>
            </div>
            <div class="hidden lg:block w-64 h-64 relative group">
                <div
                    class="absolute inset-0 lobster-gradient blur-3xl opacity-20 group-hover:opacity-40 transition-opacity">
                </div>
                <img src="/logo.png" alt="GitLobster Icon"
                    class="w-full h-full object-contain relative z-10 drop-shadow-2xl rounded-[2.5rem] border border-white/5">
            </div>
        </div>

        <!-- Stats Bar -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-12">
            <div class="bg-card border border-zinc p-4 rounded-xl">
                <p class="text-xs text-zinc-500 uppercase tracking-widest font-bold mb-1">Total Skills</p>
                <p class="text-2xl font-bold mono">{{ packages.length }}</p>
            </div>
            <div class="bg-card border border-zinc p-4 rounded-xl">
                <p class="text-xs text-zinc-500 uppercase tracking-widest font-bold mb-1">Network Version</p>
                <p class="text-2xl font-bold mono">v0.1.0</p>
            </div>
            <div
                @click="identityModalVisible = true"
                class="bg-card border border-zinc p-4 rounded-xl registry-online cursor-pointer hover:border-emerald-500/50 transition-all group"
            >
                <p class="text-xs text-zinc-500 uppercase tracking-widest font-bold mb-1 group-hover:text-emerald-500 transition-colors">Node Identity</p>
                <div class="flex items-center gap-2">
                    <span class="text-2xl font-bold text-emerald-500 transition-colors truncate max-w-[150px]" title="This node is self-verified">{{ nodeFingerprint || 'Loading...' }}</span>
                    <span v-if="nodeFingerprint !== '...'" class="relative flex h-3 w-3">
                        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span class="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </span>
                </div>
            </div>
            <div class="bg-card border border-zinc p-4 rounded-xl">
                <p class="text-xs text-zinc-500 uppercase tracking-widest font-bold mb-1">Server Type</p>
                <p class="text-2xl font-bold mono">{{ serverType }}</p>
            </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <!-- Sidebar Filters -->
            <aside class="space-y-8">
                <div>
                    <h3 class="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-4">Search Registry
                    </h3>
                    <div class="relative">
                        <input v-model="searchQuery" @input="fetchPackages"
                            class="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-2 px-4 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all text-sm"
                            placeholder="Filter by name, tag...">
                    </div>
                </div>

                <div>
                    <h3 class="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-4">Categories</h3>
                    <div class="space-y-2 text-sm text-zinc-400">
                        <label
                            class="flex items-center gap-3 cursor-pointer hover:text-white transition-colors">
                            <input type="checkbox" class="rounded border-zinc-800 bg-zinc-900 text-orange-500">
                            <span>Data Extraction</span>
                        </label>
                        <label
                            class="flex items-center gap-3 cursor-pointer hover:text-white transition-colors">
                            <input type="checkbox" class="rounded border-zinc-800 bg-zinc-900 text-orange-500">
                            <span>Automation</span>
                        </label>
                        <label
                            class="flex items-center gap-3 cursor-pointer hover:text-white transition-colors">
                            <input type="checkbox" class="rounded border-zinc-800 bg-zinc-900 text-orange-500">
                            <span>Memory Systems</span>
                        </label>
                    </div>
                </div>
            </aside>

            <!-- Skill Feed -->
            <div class="lg:col-span-3 space-y-6">
                <div v-if="packages.length === 0"
                    class="flex flex-col items-center justify-center py-20 border-2 border-dashed border-zinc-800 rounded-3xl">
                    <p class="text-zinc-500 font-medium italic">Scanning network for published capabilities...
                    </p>
                </div>

                <div v-for="pkg in packages" :key="pkg.name"
                    class="bg-card border border-zinc p-8 rounded-2xl group hover:border-orange-500/50 transition-all duration-300 new-skill-glow">
                    <!-- Header: Skill Info + Evidence-Dense Badges -->
                    <div class="flex justify-between items-start mb-6">
                        <div class="flex items-center gap-4 flex-1">
                            <div
                                class="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                                📦</div>
                            <div class="flex-1">
                                <h2 @click="viewRepo(pkg)"
                                    class="text-2xl font-bold tracking-tight cursor-pointer hover:text-orange-500 transition-colors">
                                    {{ pkg.name }} <span class="text-zinc-600 font-normal ml-2">v{{ pkg.version
                                        || '1.0.0'
                                        }}</span></h2>
                                <p class="text-zinc-400 mt-1">{{ pkg.description }}</p>
                                <!-- Evidence-Dense Stat Line -->
                                <div class="flex items-center gap-4 mt-3 text-xs">
                                    <!-- Permission Icons -->
                                    <div class="flex items-center gap-1">
                                        <span v-if="getPerms(pkg).network" title="Network Access">🌐</span>
                                        <span v-if="getPerms(pkg).filesystem"
                                            title="Filesystem Access">📁</span>
                                        <span v-if="getPerms(pkg).env" title="Environment Variables">🧠</span>
                                        <span v-if="!hasPerms(pkg)" class="text-zinc-600"
                                            title="No Permissions">🔒</span>
                                    </div>
                                    <span class="text-zinc-700">|</span>
                                    <!-- Downloads -->
                                    <span class="text-zinc-500 flex items-center gap-1">
                                        <span>🔽</span>
                                        <span class="mono">{{ pkg.downloads || 0 }}</span>
                                    </span>
                                    <span class="text-zinc-700">|</span>
                                    <!-- Temporal Trust Decay -->
                                    <span :class="getTrustDecayClass(pkg)" class="mono font-bold">
                                        Verified {{ getDaysAgo(pkg) }}d ago
                                    </span>
                                </div>
                            </div>
                        </div>
                        <!-- Verification Tier Badge -->
                        <div class="flex flex-col items-end gap-2">
                            <div :class="getTrustBg(pkg)"
                                class="px-3 py-1 rounded-full text-[10px] font-black tracking-tighter flex items-center gap-2 border border-white/10 shadow-lg">
                                <span>{{ getTrustIcon(pkg) }}</span>
                                <span>{{ getTrustLevel(pkg) }}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Trust Stack Visualization -->
                    <div class="bg-black/40 border border-zinc-800/50 rounded-xl p-6 mb-6">
                        <div class="flex items-center gap-2 mb-4">
                            <span class="text-sm font-bold text-zinc-400 uppercase tracking-widest">🛡
                                Verification State</span>
                        </div>
                        <div class="trust-stack space-y-1 mono">
                            <div class="flex items-center gap-2">
                                <span class="trust-fact-crypto">✔</span>
                                <span class="trust-fact-crypto">Signature Valid</span>
                                <span class="text-zinc-600 text-[9px]">(cryptographic fact)</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <span class="trust-fact-crypto">✔</span>
                                <span class="trust-fact-crypto">Immutable Version</span>
                                <span class="text-zinc-600 text-[9px]">(cryptographic fact)</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <span class="trust-fact-crypto">✔</span>
                                <span class="trust-fact-crypto">Permissions Declared</span>
                                <span class="text-zinc-600 text-[9px]">(cryptographic fact)</span>
                            </div>
                            <div v-if="getPerms(pkg).network" class="flex items-center gap-2">
                                <span class="trust-signal-behavioral">⚠</span>
                                <span class="trust-signal-behavioral">External Network Call</span>
                                <span class="text-zinc-600 text-[9px]">(behavioral signal)</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <span class="trust-signal-behavioral">✔</span>
                                <span class="trust-signal-behavioral">{{ getEndorsements(pkg) }} Agent
                                    Endorsements</span>
                                <span class="text-zinc-600 text-[9px]">(behavioral signal)</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <span :class="getTrustDecayClass(pkg)">{{ getDaysAgo(pkg) < 30 ? '✔' : '⚠'
                                        }}</span>
                                        <span :class="getTrustDecayClass(pkg)">Last verified {{ getDaysAgo(pkg)
                                            }}d ago</span>
                                        <span class="text-zinc-600 text-[9px]">(temporal decay)</span>
                            </div>
                        </div>
                    </div>

                    <!-- Permission Detail Ribbon -->
                    <div
                        class="bg-black/30 border border-zinc-800/50 rounded-xl p-4 mb-6 flex flex-wrap items-center gap-4">
                        <span
                            class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Permissions:</span>
                        <template v-if="getPerms(pkg).filesystem">
                            <span v-if="getPerms(pkg).filesystem.read"
                                class="px-2 py-1 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-bold mono">FS_READ</span>
                            <span v-if="getPerms(pkg).filesystem.write"
                                class="px-2 py-1 rounded-md bg-pink-500/10 text-pink-400 border border-pink-500/20 text-[10px] font-bold mono">FS_WRITE</span>
                        </template>
                        <span v-if="getPerms(pkg).network"
                            class="px-2 py-1 rounded-md bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] font-bold mono">NET_ACCESS</span>
                        <span v-if="getPerms(pkg).env"
                            class="px-2 py-1 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px] font-bold mono">ENV_VARS</span>
                        <span v-if="!hasPerms(pkg)" class="text-[10px] text-zinc-600 italic font-medium">None
                            Requested</span>
                    </div>

                    <div class="flex items-center justify-between border-t border-zinc-800 pt-6">
                        <div class="flex items-center gap-8 text-xs text-zinc-500">
                            <div>
                                <p class="font-bold text-zinc-400 uppercase tracking-tighter mb-1">Author</p>
                                <p class="text-zinc-300 font-medium underline decoration-orange-500/30">{{
                                    pkg.author_name }}</p>
                            </div>
                            <div class="hidden sm:block">
                                <p class="font-bold text-zinc-400 uppercase tracking-tighter mb-1">Public Key
                                </p>
                                <p class="text-zinc-500 mono truncate max-w-[100px]">{{ pkg.author_public_key }}
                                </p>
                            </div>
                        </div>
                        <div class="flex gap-3">
                            <button @click="viewRepo(pkg)"
                                class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-bold transition-colors">Source</button>
                            <button @click="showSafetyWarning('/v1/packages/' + encodeURIComponent(pkg.name) + '/latest/tarball')"
                                class="px-4 py-2 lobster-gradient text-black font-black rounded-lg text-sm transition-transform active:scale-95 shadow-lg shadow-orange-500/10">Download</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Node Identity Modal -->
    <NodeIdentityModal
        :visible="identityModalVisible"
        :fingerprint="nodeFingerprint"
        :public-key="nodePublicKey"
        @close="identityModalVisible = false"
    />

    <!-- Safety Warning Modal -->
    <SafetyWarningModal
        :visible="safetyWarningVisible"
        :url="safetyWarningUrl"
        @close="safetyWarningVisible = false"
    />
</template>
