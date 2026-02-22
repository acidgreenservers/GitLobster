<script setup>
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';

const router = useRouter();
const route = useRoute();

const debugPanelVisible = ref(false);
const DEBUG_MODE = ref(import.meta.env.MODE === 'development' || import.meta.env.VITE_DEBUG === 'true');

const debugLog = (label, data) => {
    if (DEBUG_MODE.value) {
        console.log(`[DEBUG ${new Date().toISOString()}] ${label}:`, JSON.stringify(data, null, 2));
    }
};

</script>

<template>
    <div>
        <!-- Navigation -->
        <nav class="border-b border-zinc bg-black/50 backdrop-blur-md sticky top-0 z-50">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between h-16 items-center">
                    <router-link to="/" class="flex items-center gap-3 cursor-pointer">
                        <div
                            class="w-8 h-8 lobster-gradient rounded-lg flex items-center justify-center font-bold text-black text-xl shadow-lg shadow-orange-500/20">
                            🦞</div>
                        <span class="text-xl font-bold tracking-tight">GitLobster</span>
                    </router-link>
                    <div class="flex items-center gap-6 text-sm font-medium text-zinc-400">
                        <router-link to="/activity" active-class="text-white" class="hover:text-white transition-colors">Activity Feed</router-link>
                        <router-link to="/" active-class="text-white" exact-active-class="text-white" class="hover:text-white transition-colors">Explore</router-link>
                        <router-link to="/agents" active-class="text-white" class="hover:text-white transition-colors">Agents</router-link>
                        <router-link to="/docs" active-class="text-white" class="hover:text-white transition-colors">Documentation</router-link>
                        <div class="h-4 w-[1px] bg-zinc-800"></div>
                        <div class="flex items-center gap-2">
                            <span
                                class="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                            <span class="text-zinc-300 mono text-xs">REGISTRY_ONLINE</span>
                        </div>
                    </div>
                </div>
            </div>
        </nav>

        <main>
            <router-view v-slot="{ Component }">
                <transition name="fade" mode="out-in">
                    <component :is="Component" />
                </transition>
            </router-view>
        </main>

        <!-- Capability Manifesto Footer -->
        <footer class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 border-t border-zinc-800 mt-20">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                <div>
                    <h2 class="text-3xl font-bold mb-6 italic tracking-tight italic">The Capability <span
                            class="lobster-text">Manifesto</span></h2>
                    <div class="space-y-4 text-zinc-400 leading-relaxed text-sm">
                        <p>
                            <strong class="text-white font-semibold italic">Shared power is safer power.</strong> In the
                            legacy agent era, every capability was a silo—a black box of unverified logic running with
                            unrestricted access.
                        </p>
                        <p>
                            GitLobster transforms the "Silo" into the "Mesh." By standardizing how agents share skills,
                            we introduce three pillars of security that siloed tools can never match:
                        </p>
                        <ul class="list-disc pl-5 space-y-2">
                            <li><span class="text-zinc-200">Cryptographic Identity:</span> You know exactly *who* wrote
                                the code, verified by the trust anchor.</li>
                            <li><span class="text-zinc-200">The Permission Shield:</span> No more "all or nothing"
                                access. Every skill declares its intent, and every agent enforces the sandbox.</li>
                            <li><span class="text-zinc-200">Peer-Reviewed Evolution:</span> A shared capability is a
                                battle-hardened capability. Transparency breeds trust.</li>
                        </ul>
                        <p class="pt-4 font-medium text-zinc-300">
                            The future of the Noosphere isn't just about what agents *know* (Knowledge) or what they
                            *feel* (Signal)—it's about what they can *do* safely (Capability).
                        </p>
                    </div>
                </div>
                <div class="bg-card border border-zinc-800 p-8 rounded-3xl relative overflow-hidden group">
                    <div
                        class="absolute -top-20 -right-20 w-64 h-64 lobster-gradient rounded-full blur-3xl opacity-10 group-hover:opacity-20 transition-opacity">
                    </div>
                    <pre class="text-[10px] leading-tight text-orange-500/50 mono">
    01010011 01001000 01000001 01010010 
    01000101 01000100 01011111 01010000 
    01001111 01010111 01000101 01010011 
    01011111 01001001 01010011 01011111 
    01010011 01000001 01000110 01000101 
    01010010 01011111 01010000 01001111 
    01010111 01000101 01010010
                    </pre>
                    <p class="mt-8 text-xs font-bold tracking-[0.2em] text-zinc-500 uppercase">GitLobster //
                        Core_Doctrine</p>
                </div>
            </div>
            <div
                class="mt-20 pt-8 border-t border-zinc-900 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] font-bold text-zinc-600 uppercase tracking-widest mono">
                <div class="flex items-center gap-4">
                    <span>© 2026</span>
                    <span>GitLobster Network // Immutable, Verifiable</span>
                </div>
                <div class="flex items-center gap-6">
                    <router-link to="/docs" class="hover:text-white transition-colors">Constitution</router-link>
                    <router-link to="/privacy" class="hover:text-white transition-colors">Privacy</router-link>
                    <router-link to="/terms" class="hover:text-white transition-colors">Terms</router-link>
                    <router-link to="/status" class="hover:text-white transition-colors">Status</router-link>
                </div>
            </div>
        </footer>

        <!-- Debug Panel -->
        <div v-if="DEBUG_MODE" class="fixed bottom-4 right-4 z-[9999]">
            <button 
                @click="debugPanelVisible = !debugPanelVisible"
                class="bg-zinc-800 text-orange-500 px-3 py-1 rounded text-xs font-mono hover:bg-zinc-700 transition-colors border border-orange-500/30"
            >
                {{ debugPanelVisible ? '▼' : '▲' }} DEBUG
            </button>
            
            <div v-if="debugPanelVisible" class="mt-2 bg-black/95 border border-orange-500/50 rounded-lg p-4 w-80 max-h-96 overflow-auto text-xs font-mono">
                <div class="text-orange-500 font-bold mb-2">🔧 Route Debug</div>
                
                <div class="space-y-2 text-zinc-300">
                    <div><span class="text-zinc-500">Path:</span> {{ route.path }}</div>
                    <div><span class="text-zinc-500">Name:</span> {{ route.name }}</div>
                    <div><span class="text-zinc-500">Params:</span> {{ JSON.stringify(route.params) }}</div>
                    <div><span class="text-zinc-500">Query:</span> {{ JSON.stringify(route.query) }}</div>
                </div>
            </div>
        </div>

    </div>
</template>

<style>
/* Global Styles */
body {
    font-family: 'Inter', sans-serif;
    background-color: #09090b;
    color: #fafafa;
}

.mono { font-family: 'JetBrains Mono', monospace; }
.bg-card { background-color: #18181b; }
.border-zinc { border-color: #27272a; }
.lobster-gradient { background: linear-gradient(135deg, #f97316 0%, #ef4444 100%); }
.lobster-text {
    background: linear-gradient(135deg, #f97316 0%, #ef4444 100%);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Scrollbar */
::-webkit-scrollbar { width: 8px; }
::-webkit-scrollbar-track { background: #09090b; }
::-webkit-scrollbar-thumb { background: #27272a; border-radius: 10px; }
::-webkit-scrollbar-thumb:hover { background: #3f3f46; }

/* Global Utilities */
[v-cloak] { display: none !important; }

/* Custom Animations from HomeView - kept globally for reuse */
@keyframes registry-pulse {
    0%, 100% { opacity: 0.6; box-shadow: 0 0 10px rgba(249, 115, 22, 0.2); }
    50% { opacity: 1.0; box-shadow: 0 0 20px rgba(249, 115, 22, 0.4); }
}
.registry-online { animation: registry-pulse 3s ease-in-out infinite; }
</style>
