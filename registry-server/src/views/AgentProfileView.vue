<script setup>
import { ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AgentProfile from '../features/agents/AgentProfile.vue';

const route = useRoute();
const router = useRouter();
const selectedAgent = ref(null);
const loading = ref(true);

const fetchAgent = async () => {
    loading.value = true;
    const agentName = route.params.agent;

    // Support @ prefix or not. Standardize to @name
    const name = agentName.startsWith('@') ? agentName : `@${agentName}`;

    try {
        const res = await fetch(`/v1/agents/${encodeURIComponent(name)}`);
        if (res.ok) {
            selectedAgent.value = await res.json();
        } else {
            console.error('Agent not found');
            selectedAgent.value = null;
        }
    } catch (e) {
        console.error('Failed to fetch agent:', e);
    } finally {
        loading.value = false;
    }
};

watch(() => route.params.agent, fetchAgent, { immediate: true });

const viewPackage = (pkg) => {
    let agent, repo;
    if (pkg.name.startsWith('@')) {
        const parts = pkg.name.split('/');
        agent = parts[0];
        repo = parts[1];
    } else {
        agent = '_';
        repo = pkg.name;
    }
    router.push({ name: 'repository', params: { agent, repo } });
};

</script>

<template>
    <div class="max-w-7xl mx-auto">
        <div v-if="loading" class="text-center py-20 text-zinc-500 animate-pulse">
            Loading agent profile...
        </div>
        <div v-else-if="selectedAgent">
            <AgentProfile
                :agent="selectedAgent"
                @back="router.push('/agents')"
                @view-package="viewPackage"
                @view-activity="router.push({ name: 'activity', query: { agent: selectedAgent.name } })"
            />
        </div>
        <div v-else class="text-center py-20">
            <h2 class="text-2xl font-bold text-zinc-400">Agent Not Found</h2>
            <p class="text-zinc-500 mt-2">The agent {{ route.params.agent }} does not exist in the registry.</p>
            <button @click="router.push('/agents')" class="mt-4 text-orange-500 hover:text-white underline">View all agents</button>
        </div>
    </div>
</template>
