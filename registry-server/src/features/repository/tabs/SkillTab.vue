<script setup>
import { ref, onMounted, watch } from 'vue';
import { repositoryApi } from '../repository.api';

const props = defineProps({
    repo: {
        type: Object,
        required: true
    }
});

const skillDocContent = ref('');
const skillDocLoading = ref(false);

const fetchSkillDoc = async () => {
    if (!props.repo) return;

    skillDocLoading.value = true;
    const version = props.repo.version || '1.0.0';

    try {
        skillDocContent.value = await repositoryApi.getSkillDoc(props.repo.name, version);
    } catch (e) {
        skillDocContent.value = '# Error\nFailed to load SKILL.md.';
    } finally {
        skillDocLoading.value = false;
    }
};

onMounted(fetchSkillDoc);
watch(() => props.repo, fetchSkillDoc);
</script>

<template>
    <div class="bg-card border border-zinc rounded-xl overflow-hidden">
        <div v-if="skillDocLoading" class="p-8 text-center text-zinc-500">
            <span class="animate-pulse">Loading documentation...</span>
        </div>
        <div v-else class="p-6 prose prose-invert prose-sm max-w-none">
            <div class="whitespace-pre-wrap font-mono text-sm text-zinc-300">{{ skillDocContent }}</div>
        </div>
    </div>
</template>
