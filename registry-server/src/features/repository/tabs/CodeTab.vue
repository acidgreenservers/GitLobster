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

    if (currentRef.value === 'HEAD' && branches.value.length > 0) {
        if (branches.value.includes('main')) currentRef.value = 'main';
        else if (branches.value.includes('master')) currentRef.value = 'master';
        else currentRef.value = branches.value[0];
    }
};

const loadTree = async () => {
    const tree = await repositoryApi.getTree(props.repo.name, currentPath.value, currentRef.value);
    files.value = tree;

    const commits = await repositoryApi.getCommits(props.repo.name, currentRef.value);
    if (commits.length > 0) lastCommit.value = commits[0];

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
    currentPath.value = '';
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
  <div class="text-[#c9d1d9]">
    <!-- Header: Branch/Tag & Clone -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
      <div class="flex items-center gap-4 flex-wrap">
        <!-- Branch Selector -->
        <div class="relative">
           <button @click="showRefDropdown = !showRefDropdown"
                   class="px-3 py-1.5 bg-[#21262d] border border-[#30363d] hover:bg-[#30363d] hover:border-[#8b949e] rounded-md text-sm font-medium flex items-center gap-2 transition-colors text-[#c9d1d9]">
             <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="fill-current text-[#8b949e]">
                 <path d="M11.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm-2.25.75a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.493 2.493 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25ZM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM3.5 3.25a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0Z"></path>
             </svg>
             <span class="font-semibold">{{ currentRef }}</span>
             <span class="text-xs text-[#8b949e]">▼</span>
           </button>

           <!-- Dropdown -->
           <div v-if="showRefDropdown"
                class="absolute top-full left-0 mt-2 w-72 bg-[#161b22] border border-[#30363d] rounded-md shadow-xl z-50 overflow-hidden">
                <div class="p-2 border-b border-[#30363d]">
                    <input type="text" placeholder="Filter branches/tags..." class="w-full bg-[#0d1117] border border-[#30363d] rounded-md px-2 py-1 text-sm focus:outline-none focus:border-[#58a6ff] focus:ring-1 focus:ring-[#58a6ff] text-[#c9d1d9]">
                </div>
                <div class="flex border-b border-[#30363d] text-xs font-semibold text-[#8b949e]">
                    <button @click="activeRefTab = 'branches'" :class="activeRefTab === 'branches' ? 'text-[#c9d1d9] border-b-2 border-[#fd8c73]' : 'hover:text-[#c9d1d9]'" class="flex-1 py-2 text-center transition-colors">Branches</button>
                    <button @click="activeRefTab = 'tags'" :class="activeRefTab === 'tags' ? 'text-[#c9d1d9] border-b-2 border-[#fd8c73]' : 'hover:text-[#c9d1d9]'" class="flex-1 py-2 text-center transition-colors">Tags</button>
                </div>
                <div class="max-h-60 overflow-y-auto">
                    <div v-if="activeRefTab === 'branches'">
                        <button v-for="branch in branches" :key="branch" @click="switchRef(branch)"
                                class="w-full text-left px-4 py-2 text-sm hover:bg-[#30363d] flex items-center gap-2"
                                :class="branch === currentRef ? 'text-[#c9d1d9] font-semibold' : 'text-[#8b949e]'">
                            <svg v-if="branch === currentRef" aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="fill-current text-[#c9d1d9]">
                                <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"></path>
                            </svg>
                            <span v-else class="w-4"></span>
                            {{ branch }}
                        </button>
                    </div>
                    <div v-if="activeRefTab === 'tags'">
                        <button v-for="tag in tags" :key="tag" @click="switchRef(tag)"
                                class="w-full text-left px-4 py-2 text-sm hover:bg-[#30363d] flex items-center gap-2"
                                :class="tag === currentRef ? 'text-[#c9d1d9] font-semibold' : 'text-[#8b949e]'">
                            <svg v-if="tag === currentRef" aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="fill-current text-[#c9d1d9]">
                                <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"></path>
                            </svg>
                            <span v-else class="w-4"></span>
                            {{ tag }}
                        </button>
                    </div>
                </div>
           </div>
        </div>

        <!-- Breadcrumbs -->
        <div class="text-sm font-semibold flex items-center flex-wrap gap-1 text-[#2f81f7]">
           <span class="hover:underline cursor-pointer" @click="currentPath = ''">{{ repo.name }}</span>
           <span v-if="currentPath" class="text-[#8b949e]">/</span>
           <template v-for="(crumb, idx) in breadcrumbs" :key="crumb.path">
               <span class="hover:underline cursor-pointer"
                     :class="{ 'text-[#c9d1d9] font-bold': idx === breadcrumbs.length - 1 }"
                     @click="jumpTo(crumb.path)">
                   {{ crumb.name }}
               </span>
               <span v-if="idx < breadcrumbs.length - 1" class="text-[#8b949e]">/</span>
           </template>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center gap-2">
         <!-- Clone Dropdown -->
         <div class="relative group">
             <button class="bg-[#238636] hover:bg-[#2ea043] border border-[rgba(240,246,252,0.1)] text-white px-3 py-1.5 rounded-md text-sm font-semibold transition-all flex items-center gap-2">
               <span>Code</span>
               <span class="text-xs">▼</span>
             </button>
             <div class="absolute right-0 top-full mt-2 w-80 bg-[#161b22] border border-[#30363d] rounded-md shadow-xl p-4 hidden group-hover:block z-50">
                 <h3 class="text-sm font-semibold text-[#c9d1d9] mb-2">Clone</h3>
                 <div class="bg-[#0d1117] border border-[#30363d] rounded-md p-2 flex items-center justify-between mb-2">
                     <code class="text-xs text-[#c9d1d9] font-mono">botkit install {{ repo.name }}</code>
                     <button class="text-[#8b949e] hover:text-[#58a6ff]">
                        <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="fill-current">
                            <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"></path><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"></path>
                        </svg>
                     </button>
                 </div>
                 <p class="text-xs text-[#8b949e]">
                    Use <span class="text-[#c9d1d9] font-mono">botkit</span> to install this skill securely into your agent workspace.
                 </p>
                 <div class="border-t border-[#30363d] my-3"></div>
                 <button @click="$emit('download', `/v1/packages/${encodeURIComponent(repo.name)}/${currentRef}/tarball`)"
                         class="w-full text-left text-sm font-semibold text-[#c9d1d9] hover:text-[#58a6ff] py-1">
                     Download ZIP
                 </button>
             </div>
         </div>
      </div>
    </div>

    <!-- File Table -->
    <div class="border border-[#30363d] rounded-md overflow-hidden mb-6 shadow-sm bg-[#0d1117]">
       <!-- Header: Last commit info -->
       <div class="bg-[#161b22] p-3 border-b border-[#30363d] text-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-[#8b949e]">
          <div class="flex items-center gap-2">
              <div class="w-5 h-5 rounded-full bg-[#30363d] flex items-center justify-center text-[10px] text-[#c9d1d9] font-semibold">
                  {{ lastCommit?.author?.[0]?.toUpperCase() || '?' }}
              </div>
              <span class="font-semibold text-[#c9d1d9]">{{ lastCommit?.author || 'system' }}</span>
              <span class="truncate max-w-[200px] md:max-w-md font-medium text-[#c9d1d9] hover:text-[#58a6ff] hover:underline cursor-pointer">{{ lastCommit?.message || 'Initial commit' }}</span>
          </div>
          <div class="flex items-center gap-2 text-xs font-mono">
              <span class="text-[#8b949e]">{{ formatTime(lastCommit?.date) }}</span>
              <span class="hidden md:inline text-[#30363d]">•</span>
              <span class="hover:text-[#58a6ff] cursor-pointer hidden md:inline">{{ lastCommit?.hash?.substring(0, 7) || 'HEAD' }}</span>
              <span class="hidden md:inline text-[#30363d]">•</span>
              <span class="font-semibold text-[#8b949e] hidden md:inline">{{ files.length }} files</span>
          </div>
       </div>

       <!-- Files -->
       <div class="divide-y divide-[#30363d]">
          <div v-if="currentPath" @click="goUp" class="p-2 px-4 hover:bg-[#161b22] cursor-pointer text-sm text-[#2f81f7] font-semibold flex items-center gap-3 transition-colors">
             <span class="w-4 text-center">..</span>
          </div>
          <div v-for="file in files" :key="file.name" class="p-2 px-4 hover:bg-[#161b22] flex items-center gap-3 group transition-colors">
             <span class="text-[#8b949e] w-4 flex justify-center">
                <!-- Directory Icon -->
                <svg v-if="file.type === 'tree'" aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="fill-current text-[#7d8590]">
                    <path d="M1.75 1A1.75 1.75 0 0 0 0 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0 0 16 13.25v-8.5A1.75 1.75 0 0 0 14.25 3H7.5a.25.25 0 0 1-.2-.1l-.9-1.2C6.07 1.26 5.55 1 5 1H1.75Z"></path>
                </svg>
                <!-- File Icon -->
                <svg v-else aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="fill-current">
                    <path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V4.664a.25.25 0 0 0-.073-.177l-2.914-2.914a.25.25 0 0 0-.177-.073ZM8 3.25a.75.75 0 0 1 .75-.75h4.5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0V4.31l-4.22 4.22a.75.75 0 0 1-1.06-1.06l4.22-4.22H8.75a.75.75 0 0 1-.75-.75Z"></path>
                </svg>
             </span>
             <span class="text-sm cursor-pointer hover:underline truncate w-1/3"
                   :class="file.type === 'tree' ? 'text-[#c9d1d9] font-medium' : 'text-[#c9d1d9]'"
                   @click="navigate(file)">
                {{ file.name }}
             </span>
             <span class="text-sm text-[#8b949e] flex-1 truncate hidden md:block group-hover:text-[#58a6ff] hover:underline cursor-pointer transition-colors">
                {{ file.lastCommit?.message || '' }}
             </span>
             <span class="text-sm text-[#8b949e] w-32 text-right">
                {{ formatTime(file.lastCommit?.date) }}
             </span>
          </div>
       </div>
    </div>

    <!-- README -->
    <div v-if="readme" class="border border-[#30363d] rounded-md overflow-hidden bg-[#0d1117] mb-8">
       <div class="bg-[#0d1117] p-3 border-b border-[#30363d] font-semibold text-sm flex items-center gap-2 sticky top-0">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="fill-current text-[#8b949e]">
              <path d="M0 3.75C0 2.784.784 2 1.75 2h12.5c.966 0 1.75.784 1.75 1.75v8.5A1.75 1.75 0 0 1 14.25 14H1.75A1.75 1.75 0 0 1 0 12.25Zm1.75-.25a.25.25 0 0 0-.25.25v8.5c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25v-8.5a.25.25 0 0 0-.25-.25ZM3.5 6.25a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1-.75-.75Zm.75 2.25h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1 0-1.5Z"></path>
          </svg>
          README.md
       </div>
       <div class="p-8 prose prose-invert prose-sm max-w-none text-[#c9d1d9] prose-a:text-[#58a6ff] prose-code:bg-[#161b22] prose-code:text-[#c9d1d9] prose-code:border prose-code:border-[#30363d] prose-code:rounded prose-pre:bg-[#161b22] prose-pre:border prose-pre:border-[#30363d]" v-html="readme"></div>
    </div>
  </div>
</template>
