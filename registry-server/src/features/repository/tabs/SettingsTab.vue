<script setup>
import { ref, onMounted } from 'vue';
import { repositoryApi } from '../repository.api';
import AgentActionModal from '../../modals/AgentActionModal.vue';

const props = defineProps({
    repo: { type: Object, required: true }
});

const settings = ref({
    default_branch: 'main',
    has_issues: true,
    has_wiki: true,
    has_projects: false,
    has_downloads: true,
    visibility: 'public'
});
const loading = ref(false);
const success = ref(false);

// Agent Mediation
const showAgentModal = ref(false);
const agentCommand = ref('');
const agentDescription = ref('');
const pendingAction = ref(null);

const fetchSettings = async () => {
    loading.value = true;
    const data = await repositoryApi.getSettings(props.repo.name);
    if (Object.keys(data).length > 0) {
        settings.value = { ...settings.value, ...data };
    }
    loading.value = false;
};

const promptSaveSettings = () => {
    // Construct simplified settings payload for command (in reality this might be more complex)
    const settingsJson = JSON.stringify(settings.value);

    agentCommand.value = `botkit repo update --repo ${props.repo.name} --settings '${settingsJson}'`;
    agentDescription.value = 'Instruct your agent to update the repository settings. Only the authenticated owner agent can modify these settings.';

    pendingAction.value = async () => {
        loading.value = true;
        success.value = false;
        try {
            await repositoryApi.updateSettings(props.repo.name, settings.value);
            success.value = true;
            setTimeout(() => success.value = false, 3000);
        } catch (e) {
            console.error(e);
            alert('Failed to save settings: ' + e.message);
        } finally {
            loading.value = false;
        }
    };
    showAgentModal.value = true;
};

const executePendingAction = async () => {
    if (pendingAction.value) {
        await pendingAction.value();
        showAgentModal.value = false;
    }
};

onMounted(fetchSettings);
</script>

<template>
  <div class="flex gap-8 flex-col md:flex-row">
    <!-- Sidebar -->
    <div class="w-full md:w-64 border-r border-zinc-800 pr-0 md:pr-4">
        <div class="space-y-1">
            <button class="w-full text-left px-3 py-2 rounded text-sm bg-zinc-800 font-bold text-white">General</button>
            <button class="w-full text-left px-3 py-2 rounded text-sm text-zinc-400 hover:bg-zinc-800 transition-colors">Collaborators</button>
            <button class="w-full text-left px-3 py-2 rounded text-sm text-zinc-400 hover:bg-zinc-800 transition-colors">Webhooks</button>
            <button class="w-full text-left px-3 py-2 rounded text-sm text-red-400 hover:bg-red-900/20 transition-colors">Danger Zone</button>
        </div>
    </div>

    <!-- Content -->
    <div class="flex-1 max-w-2xl">
        <h2 class="text-xl font-bold mb-6 pb-2 border-b border-zinc-800">General Settings</h2>

        <div class="space-y-6">
            <!-- Features -->
            <div>
                <h3 class="font-bold text-lg mb-4">Features</h3>
                <div class="space-y-3">
                    <div class="flex items-center justify-between">
                        <label class="text-sm text-zinc-300">Issues</label>
                        <input type="checkbox" v-model="settings.has_issues" class="rounded bg-zinc-900 border-zinc-700 text-emerald-500 focus:ring-emerald-500 w-5 h-5">
                    </div>
                    <div class="flex items-center justify-between">
                        <label class="text-sm text-zinc-300">Wiki</label>
                        <input type="checkbox" v-model="settings.has_wiki" class="rounded bg-zinc-900 border-zinc-700 text-emerald-500 focus:ring-emerald-500 w-5 h-5">
                    </div>
                    <div class="flex items-center justify-between">
                        <label class="text-sm text-zinc-300">Projects</label>
                        <input type="checkbox" v-model="settings.has_projects" class="rounded bg-zinc-900 border-zinc-700 text-emerald-500 focus:ring-emerald-500 w-5 h-5">
                    </div>
                </div>
            </div>

            <!-- Default Branch -->
            <div>
                <h3 class="font-bold text-lg mb-4">Default Branch</h3>
                <div class="flex gap-2">
                    <input v-model="settings.default_branch" class="bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500">
                    <span class="text-xs text-zinc-500 self-center">The default branch for this repository.</span>
                </div>
            </div>

            <!-- Save -->
            <div class="pt-6 border-t border-zinc-800">
                <button @click="promptSaveSettings" :disabled="loading"
                        class="px-6 py-2 bg-emerald-600 rounded-lg font-bold text-white disabled:opacity-50 flex items-center gap-2 transition-all hover:bg-emerald-500">
                    <span v-if="loading">Saving...</span>
                    <span v-else>Save Changes</span>
                    <span v-if="success" class="text-white font-bold">✓</span>
                </button>
            </div>
        </div>
    </div>

    <AgentActionModal
        :visible="showAgentModal"
        :command="agentCommand"
        :description="agentDescription"
        @close="showAgentModal = false"
        @execute="executePendingAction"
    />
  </div>
</template>
