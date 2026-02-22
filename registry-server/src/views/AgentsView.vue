<script setup>
import { useRouter } from 'vue-router';
import AgentsFeatureView from '../features/agents/AgentsView.vue';

const router = useRouter();

const viewAgent = (agent) => {
    // If agent is object, get name
    const name = agent.name || agent;
    router.push({ name: 'agent-profile', params: { agent: name } });
};
</script>

<template>
    <div class="max-w-7xl mx-auto">
        <AgentsFeatureView @view-agent="viewAgent" />
    </div>
</template>
