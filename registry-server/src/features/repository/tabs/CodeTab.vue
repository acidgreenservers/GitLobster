<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import { repositoryApi } from '../repository.api';
import { formatDistanceToNow } from 'date-fns';
import { marked } from 'marked';

const props = defineProps({
    repo: { type: Object, required: true },
    userStarred: Boolean
});

const emit = defineEmits(['download', 'fork', 'star']);

const currentRef = ref('HEAD'); // Default to HEAD until we fetch branches
const currentPath = ref('');
const files = ref([]);
const branches = ref([]);
const tags = ref([]);
const lastCommit = ref(null);
const readme = ref('');
const showRefDropdown = ref(false);
const activeRefTab = ref('branches'); // 'branches' or 'tags'

const breadcrumbs = computed(() => {
    if (!currentPath.value) return [];
    const parts = currentPath.value.split('/');
    let path = '';
    return parts.map(part => {
        path = path ? `${path}/${part}` : part;
        return { name: part, path };
    });
});

const loadRefData = async () => {
    branches.value = await repositoryApi.getBranches(props.repo.name);
    tags.value = await repositoryApi.getTags(props.repo.name);

    // If currentRef is HEAD and we have branches, try to set to main/master or first branch
    if (currentRef.value === 'HEAD' && branches.value.length > 0) {
        if (branches.value.includes('main')) currentRef.value = 'main';
        else if (branches.value.includes('master')) currentRef.value = 'master';
        else currentRef.value = branches.value[0];
    }
};

const loadTree = async () => {
    const tree = await repositoryApi.getTree(props.repo.name, currentPath.value, currentRef.value);
    files.value = tree;

    // Get last commit for the current path/ref context
    // Ideally we want commit per file, but that's expensive. git-ops.getEnhancedTree tries to do it.
    // Let's assume getTree returns enhanced tree.

    // Also get last commit for the header (latest commit of the repo/branch)
    const commits = await repositoryApi.getCommits(props.repo.name, currentRef.value);
    if (commits.length > 0) lastCommit.value = commits[0];

    // Try to find README in current directory
    const readmeFile = tree.find(f => f.name.toLowerCase().startsWith('readme') || f.name === 'SKILL.md');
    if (readmeFile) {
        const fullPath = currentPath.value ? `${currentPath.value}/${readmeFile.name}` : readmeFile.name;
        const content = await repositoryApi.getRawFile(props.repo.name, fullPath, currentRef.value);
        if (content) {
            readme.value = marked.parse(content);
        } else {
            readme.value = '';
        }
    } else {
        readme.value = '';
    }
};

const navigate = (file) => {
    if (file.type === 'tree') {
        currentPath.value = currentPath.value ? `${currentPath.value}/${file.name}` : file.name;
    } else {
        // View file content - open raw for now
        const path = currentPath.value ? `${currentPath.value}/${file.name}` : file.name;
        window.open(`/v1/packages/${encodeURIComponent(props.repo.name)}/raw?path=${encodeURIComponent(path)}&ref=${currentRef.value}`, '_blank');
    }
};

const goUp = () => {
    if (!currentPath.value) return;
    const parts = currentPath.value.split('/');
    parts.pop();
    currentPath.value = parts.join('/');
};

const jumpTo = (path) => {
    currentPath.value = path;
};

const switchRef = (refName) => {
    currentRef.value = refName;
    showRefDropdown.value = false;
    currentPath.value = ''; // Reset path on branch switch
};

const formatTime = (iso) => {
    if (!iso) return '';
    try {
        return formatDistanceToNow(new Date(iso), { addSuffix: true });
    } catch (e) { return iso; }
};

watch([currentRef, currentPath], loadTree);

onMounted(async () => {
    await loadRefData();
    await loadTree();
});
</script>

<template>
  <div>
    <!-- Header: Branch/Tag & Clone -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
      <div class="flex items-center gap-4 flex-wrap">
        <!-- Branch Selector -->
        <div class="relative">
           <button @click="showRefDropdown = !showRefDropdown"
                   class="px-3 py-1.5 bg-zinc-900 border border-zinc-700 hover:border-zinc-600 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
             <span class="text-zinc-400">⑂</span>
             <span class="font-bold text-white">{{ currentRef }}</span>
             <span class="text-xs text-zinc-500">▼</span>
           </button>

           <!-- Dropdown -->
           <div v-if="showRefDropdown"
                class="absolute top-full left-0 mt-2 w-72 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                <div class="p-2 border-b border-zinc-800">
                    <input type="text" placeholder="Filter branches/tags..." class="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm focus:outline-none focus:border-orange-500">
                </div>
                <div class="flex border-b border-zinc-800 text-xs font-bold text-zinc-500">
                    <button @click="activeRefTab = 'branches'" :class="activeRefTab === 'branches' ? 'text-white border-b-2 border-orange-500' : 'hover:text-zinc-300'" class="flex-1 py-2 text-center">Branches</button>
                    <button @click="activeRefTab = 'tags'" :class="activeRefTab === 'tags' ? 'text-white border-b-2 border-orange-500' : 'hover:text-zinc-300'" class="flex-1 py-2 text-center">Tags</button>
                </div>
                <div class="max-h-60 overflow-y-auto">
                    <div v-if="activeRefTab === 'branches'">
                        <button v-for="branch in branches" :key="branch" @click="switchRef(branch)"
                                class="w-full text-left px-4 py-2 text-sm hover:bg-zinc-800 flex items-center gap-2"
                                :class="branch === currentRef ? 'text-orange-500 font-bold' : 'text-zinc-300'">
                            <span v-if="branch === currentRef">✓</span>
                            <span v-else class="w-2"></span>
                            {{ branch }}
                        </button>
                    </div>
                    <div v-if="activeRefTab === 'tags'">
                        <button v-for="tag in tags" :key="tag" @click="switchRef(tag)"
                                class="w-full text-left px-4 py-2 text-sm hover:bg-zinc-800 flex items-center gap-2"
                                :class="tag === currentRef ? 'text-orange-500 font-bold' : 'text-zinc-300'">
                            <span v-if="tag === currentRef">✓</span>
                            <span v-else class="w-2"></span>
                            {{ tag }}
                        </button>
                    </div>
                </div>
           </div>
        </div>

        <!-- Breadcrumbs -->
        <div class="text-lg font-medium flex items-center flex-wrap gap-1 text-zinc-400">
           <span class="hover:text-blue-400 cursor-pointer hover:underline" @click="currentPath = ''">{{ repo.name }}</span>
           <span v-if="currentPath">/</span>
           <template v-for="(crumb, idx) in breadcrumbs" :key="crumb.path">
               <span class="hover:text-blue-400 cursor-pointer hover:underline"
                     :class="{ 'text-white font-bold': idx === breadcrumbs.length - 1 }"
                     @click="jumpTo(crumb.path)">
                   {{ crumb.name }}
               </span>
               <span v-if="idx < breadcrumbs.length - 1">/</span>
           </template>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center gap-2">
         <!-- Clone Dropdown -->
         <div class="relative group">
             <button class="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-lg text-sm font-bold shadow-lg shadow-emerald-900/20 transition-all flex items-center gap-2">
               <span>Code</span>
               <span>▼</span>
             </button>
             <div class="absolute right-0 top-full mt-2 w-80 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl p-4 hidden group-hover:block z-50">
                 <h3 class="text-sm font-bold text-white mb-2">Clone</h3>
                 <div class="bg-black border border-zinc-700 rounded p-2 flex items-center justify-between mb-2">
                     <code class="text-xs text-emerald-400 font-mono">botkit install {{ repo.name }}</code>
                     <button class="text-zinc-500 hover:text-white">📋</button>
                 </div>
                 <p class="text-xs text-zinc-500">
                    Use <span class="text-zinc-300 font-mono">botkit</span> to install this skill securely into your agent workspace.
                 </p>
                 <div class="border-t border-zinc-800 my-3"></div>
                 <button @click="$emit('download', `/v1/packages/${encodeURIComponent(repo.name)}/${currentRef}/tarball`)"
                         class="w-full text-left text-sm text-white hover:text-emerald-400 py-1">
                     Download ZIP
                 </button>
             </div>
         </div>
      </div>
    </div>

    <!-- File Table -->
    <div class="border border-zinc-800 rounded-lg overflow-hidden mb-6 shadow-sm">
       <!-- Header: Last commit info -->
       <div class="bg-zinc-900/80 backdrop-blur p-3 border-b border-zinc-800 text-sm flex items-center gap-3 text-zinc-400">
          <div class="flex items-center gap-2">
              <div class="w-5 h-5 rounded-full bg-zinc-700 flex items-center justify-center text-[10px] text-white font-bold">
                  {{ lastCommit?.author?.[0]?.toUpperCase() || '?' }}
              </div>
              <span class="font-bold text-zinc-300">{{ lastCommit?.author || 'system' }}</span>
          </div>
          <span class="truncate flex-1 font-mono text-xs text-zinc-500">{{ lastCommit?.message || 'Initial commit' }}</span>
          <span class="text-xs whitespace-nowrap">{{ formatTime(lastCommit?.date) }}</span>
          <div class="flex items-center gap-2 text-xs font-mono text-zinc-600">
              <span>{{ lastCommit?.hash?.substring(0, 7) || 'HEAD' }}</span>
              <span class="text-zinc-700">|</span>
              <span class="font-bold text-zinc-500">{{ files.length }} items</span>
          </div>
       </div>

       <!-- Files -->
       <div class="divide-y divide-zinc-800/50 bg-black/20">
          <div v-if="currentPath" @click="goUp" class="p-2 px-4 hover:bg-zinc-900/50 cursor-pointer text-sm text-blue-400 font-bold flex items-center gap-3">
             <span class="w-4 text-center">..</span>
          </div>
          <div v-for="file in files" :key="file.name" class="p-2 px-4 hover:bg-zinc-900/50 flex items-center gap-3 group transition-colors">
             <span class="text-zinc-500 w-4 text-center">{{ file.type === 'tree' ? '📁' : '📄' }}</span>
             <span class="text-sm flex-1 cursor-pointer hover:underline truncate"
                   :class="file.type === 'tree' ? 'text-white font-medium' : 'text-zinc-300'"
                   @click="navigate(file)">
                {{ file.name }}
             </span>
             <span class="text-xs text-zinc-600 w-1/3 truncate hidden md:block group-hover:text-zinc-400 transition-colors">
                {{ file.lastCommit?.message }}
             </span>
             <span class="text-xs text-zinc-600 w-24 text-right">
                {{ formatTime(file.lastCommit?.date) }}
             </span>
          </div>
       </div>
    </div>

    <!-- README -->
    <div v-if="readme" class="border border-zinc-800 rounded-lg overflow-hidden bg-black/20 mb-8">
       <div class="bg-zinc-900/50 p-3 border-b border-zinc-800 font-bold text-sm flex items-center gap-2 sticky top-0 backdrop-blur-sm">
          <span>📖</span> README.md
       </div>
       <div class="p-8 prose prose-invert prose-sm max-w-none bg-black/40" v-html="readme"></div>
    </div>
  </div>
</template>
