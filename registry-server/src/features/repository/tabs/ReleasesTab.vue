<script setup>
import { ref, onMounted } from 'vue';
import { repositoryApi } from '../../repository.api';
import { formatDistanceToNow } from 'date-fns';
import { marked } from 'marked';

const props = defineProps({
    repo: { type: Object, required: true }
});

const releases = ref([]);
const loading = ref(true);
const viewMode = ref('list'); // 'list', 'new'
const form = ref({ tag_name: '', name: '', body: '', prerelease: false });

const fetchReleases = async () => {
    loading.value = true;
    releases.value = await repositoryApi.getReleases(props.repo.name);
    loading.value = false;
};

const createRelease = async () => {
    await repositoryApi.createRelease(props.repo.name, form.value);
    form.value = { tag_name: '', name: '', body: '', prerelease: false };
    viewMode.value = 'list';
    fetchReleases();
};

const formatTime = (iso) => {
    if (!iso) return '';
    try {
        return formatDistanceToNow(new Date(iso), { addSuffix: true });
    } catch { return iso; }
};

onMounted(fetchReleases);
</script>

<template>
  <div>
    <div v-if="viewMode === 'list'">
        <div class="flex items-center justify-between mb-6">
            <h2 class="text-xl font-bold">Releases</h2>
            <button @click="viewMode = 'new'" class="px-4 py-2 bg-emerald-600 rounded-lg text-sm font-bold text-white">Draft a new release</button>
        </div>

        <div v-if="loading" class="text-center py-12 text-zinc-500">Loading...</div>
        <div v-else-if="releases.length === 0" class="text-center py-12 text-zinc-500 border border-zinc-800 rounded-xl">
            No releases published.
        </div>

        <div v-else class="space-y-8">
            <div v-for="release in releases" :key="release.id" class="flex flex-col md:flex-row gap-4">
                <div class="md:w-1/4 md:text-right pt-2">
                    <div class="flex items-center md:justify-end gap-2 text-zinc-400 text-sm mb-1">
                        <span>🏷️</span>
                        <span class="font-mono">{{ release.tag_name }}</span>
                    </div>
                    <div class="text-xs text-zinc-600">{{ formatTime(release.published_at) }}</div>
                </div>

                <div class="flex-1 border border-zinc-800 rounded-xl overflow-hidden">
                    <div class="bg-zinc-900/50 p-4 border-b border-zinc-800 flex justify-between items-center">
                        <h3 class="font-bold text-lg">{{ release.name || release.tag_name }}</h3>
                        <div class="flex gap-2">
                            <span v-if="release.prerelease" class="px-2 py-0.5 bg-orange-500/20 text-orange-400 text-xs font-bold rounded-full border border-orange-500/30">Pre-release</span>
                            <span v-else class="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-full border border-emerald-500/30">Latest</span>
                        </div>
                    </div>
                    <div class="p-6 prose prose-invert max-w-none" v-html="marked.parse(release.body || '')"></div>
                    <div class="border-t border-zinc-800 p-4 bg-zinc-900/30">
                        <div class="font-bold text-xs text-zinc-500 uppercase mb-2">Assets</div>
                        <div class="flex gap-2">
                            <a :href="`/v1/packages/${encodeURIComponent(repo.name)}/${release.tag_name}/tarball`" class="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-sm text-zinc-300 flex items-center gap-2 transition-colors">
                                <span>📦</span> Source code (tar.gz)
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div v-if="viewMode === 'new'" class="max-w-4xl mx-auto">
        <h2 class="text-xl font-bold mb-6">Draft a new release</h2>
        <div class="border border-zinc-800 rounded-lg p-6 bg-black/20 space-y-4">
            <div class="flex gap-4">
                <div class="w-1/3">
                    <label class="block text-xs font-bold text-zinc-500 mb-1">Tag version</label>
                    <input v-model="form.tag_name" placeholder="v1.0.0" class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 focus:outline-none focus:border-emerald-500 text-white">
                </div>
                <div class="flex-1">
                    <label class="block text-xs font-bold text-zinc-500 mb-1">Release title</label>
                    <input v-model="form.name" placeholder="Release title" class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 focus:outline-none focus:border-emerald-500 text-white">
                </div>
            </div>

            <div>
                <label class="block text-xs font-bold text-zinc-500 mb-1">Description</label>
                <textarea v-model="form.body" placeholder="Describe this release..." rows="10" class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 focus:outline-none focus:border-emerald-500 text-white font-mono text-sm"></textarea>
            </div>

            <div class="flex items-center gap-2">
                <input type="checkbox" v-model="form.prerelease" id="prerelease" class="rounded bg-zinc-900 border-zinc-700 text-emerald-500 focus:ring-emerald-500">
                <label for="prerelease" class="text-sm text-zinc-300">Set as a pre-release</label>
            </div>

            <div class="flex justify-end gap-2 pt-4">
                <button @click="viewMode = 'list'" class="px-4 py-2 text-zinc-400 hover:text-white">Cancel</button>
                <button @click="createRelease" class="px-4 py-2 bg-emerald-600 rounded-lg text-sm font-bold text-white">Publish Release</button>
            </div>
        </div>
    </div>
  </div>
</template>
