<script setup>
import { ref, onMounted } from 'vue';

const props = defineProps({
    fingerprint: String,
    publicKey: String,
    trustAnchorName: String
});

const emit = defineEmits(['back']);

const stats = ref({
    uptime: 'Loading...',
    packages: 0,
    agents: 0,
    version: '0.1.0'
});

const loadStats = async () => {
    // Simulating stats for now as we don't have a full status endpoint yet
    // In a real implementation, we'd hit /v1/status
    setTimeout(() => {
        stats.value = {
            uptime: '99.9%',
            packages: 12,
            agents: 3,
            version: '0.1.0'
        };
    }, 500);
};

onMounted(() => {
    loadStats();
});
</script>

<template>
    <div class="max-w-4xl mx-auto py-12 px-4">
        <!-- Header -->
        <div class="mb-12">
            <button @click="emit('back')" class="text-zinc-500 hover:text-white mb-6 flex items-center gap-2 transition-colors">
                <span>←</span> Back
            </button>
            <h1 class="text-4xl font-black tracking-tight mb-4">System <span class="lobster-text">Status</span></h1>
            <p class="text-xl text-zinc-400">Operational metrics and trust configuration.</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
            <!-- Node Identity Card -->
            <div class="bg-card border border-zinc-800 rounded-xl p-8 md:col-span-2">
                <div class="flex items-center gap-3 mb-6">
                    <span class="text-2xl">🔐</span>
                    <h2 class="text-xl font-bold text-white">Node Identity</h2>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <p class="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Trust Anchor Name</p>
                        <p class="text-lg font-mono text-white">{{ trustAnchorName }}</p>
                    </div>
                     <div>
                        <p class="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Verification Mode</p>
                        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-bold">
                            <span>🛡️ Self-Verified</span>
                        </div>
                    </div>
                    <div class="md:col-span-2">
                         <p class="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Fingerprint (Ed25519)</p>
                         <div class="font-mono text-xs text-zinc-400 break-all bg-black/40 p-4 rounded-lg border border-zinc-800">
                             {{ fingerprint || 'Loading...' }}
                         </div>
                    </div>
                </div>
            </div>

            <!-- System Metrics -->
             <div class="bg-card border border-zinc-800 rounded-xl p-8">
                <div class="flex items-center gap-3 mb-6">
                    <span class="text-2xl">📊</span>
                    <h2 class="text-xl font-bold text-white">Metrics</h2>
                </div>
                <div class="space-y-4">
                    <div class="flex justify-between items-center py-2 border-b border-zinc-800/50">
                        <span class="text-zinc-400">Version</span>
                        <span class="font-mono text-white">{{ stats.version }}</span>
                    </div>
                    <div class="flex justify-between items-center py-2 border-b border-zinc-800/50">
                        <span class="text-zinc-400">Uptime</span>
                        <span class="font-mono text-emerald-400">{{ stats.uptime }}</span>
                    </div>

                </div>
            </div>

            <!-- Network Stats -->
             <div class="bg-card border border-zinc-800 rounded-xl p-8">
                <div class="flex items-center gap-3 mb-6">
                    <span class="text-2xl">🌍</span>
                    <h2 class="text-xl font-bold text-white">Network</h2>
                </div>
                 <div class="space-y-4">
                    <div class="flex justify-between items-center py-2 border-b border-zinc-800/50">
                        <span class="text-zinc-400">Total Packages</span>
                        <span class="font-mono text-white">{{ stats.packages }}</span>
                    </div>
                    <div class="flex justify-between items-center py-2 border-b border-zinc-800/50">
                        <span class="text-zinc-400">Registered Agents</span>
                        <span class="font-mono text-white">{{ stats.agents }}</span>
                    </div>
                     <div class="flex justify-between items-center py-2 border-b border-zinc-800/50">
                        <span class="text-zinc-400">Protocol</span>
                        <span class="font-mono text-orange-400">v1.0 (Git)</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
