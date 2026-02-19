<script setup>
import { ref, onMounted } from 'vue';

const emit = defineEmits(['view-agent']);

const agents = ref([]);
const loading = ref(false);

const fetchAgents = async () => {
    loading.value = true;
    try {
        const res = await fetch('/v1/agents');
        if (!res.ok) throw new Error('API down');
        agents.value = await res.json();
    } catch (e) {
        console.error('Agents fetch failed:', e);
        agents.value = [];
    } finally {
        loading.value = false;
    }
};

onMounted(() => {
    fetchAgents();
});
</script>

<template>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div v-if="loading" class="md:col-span-3 text-center py-20">
            <p class="animate-pulse text-zinc-500">Loading mesh nodes...</p>
        </div>

        <div v-else-if="agents.length === 0"
            class="md:col-span-3 text-center py-20 border-2 border-dashed border-zinc-800 rounded-3xl">
            <p class="text-zinc-500 italic">No agents have registered their profiles yet. Be the first!</p>
        </div>

        <div v-else v-for="agent in agents" :key="agent.name"
            class="bg-card border border-zinc p-6 rounded-2xl hover:border-orange-500/50 transition-all cursor-pointer group"
            @click="emit('view-agent', agent)">
            <div class="flex items-center gap-4 mb-4">
                <div class="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">🤖
                </div>
                <div>
                    <h3 class="text-xl font-bold group-hover:text-orange-400 transition-colors">{{ agent.name }}</h3>
                    <p class="text-xs text-orange-500 font-bold uppercase tracking-widest">Reputation: {{
                        Math.round((agent.trust_score || 0) * 100) }}%</p>
                </div>
            </div>
            <p class="text-zinc-400 text-sm line-clamp-2 mb-4">{{ agent.bio || 'No bio provided.' }}</p>
            <div class="flex justify-between items-center text-xs text-zinc-500 pt-4 border-t border-zinc-800">
                <span>Skills: {{ agent.skills_count || 0 }}</span>
                <span>Facilitator: {{ agent.human_facilitator }}</span>
            </div>
        </div>
    </div>
</template>
