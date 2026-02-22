<script setup>
import { computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import ActivityFeed from '../features/activity/ActivityFeed.vue';

const router = useRouter();
const route = useRoute();

const agentFilter = computed(() => route.query.agent || null);

const viewAgent = (name) => {
    router.push({ name: 'agent-profile', params: { agent: name } });
};

const viewPackage = (name) => {
    let agent, repo;
    if (name.startsWith('@')) {
        const parts = name.split('/');
        agent = parts[0];
        repo = parts[1];
    } else {
        agent = '_';
        repo = name;
    }
    router.push({ name: 'repository', params: { agent, repo } });
};
</script>

<template>
    <div class="max-w-7xl mx-auto">
        <ActivityFeed
            :initial-agent="agentFilter"
            @view-agent="viewAgent"
            @view-package="viewPackage"
        />
    </div>
</template>
