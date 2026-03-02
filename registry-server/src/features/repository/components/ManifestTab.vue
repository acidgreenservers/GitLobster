<script setup>
import { computed, ref } from 'vue';

const props = defineProps({
  repo: { type: Object, required: true },
});

// ========== State ==========
const versionData = ref(null);
const loading = ref(true);
const showAgentFullKey = ref(false);
const showServerFullKey = ref(false);
const showAgentFullSig = ref(false);
const showServerFullSig = ref(false);
const selectedHashFile = ref(null);
const selectedHash = ref(null);
const copiedField = ref(null);

// ========== Computed ==========
const agentSignature = computed(() => versionData.value?.agent_signature || versionData.value?.manifest?.agentSignature || null);
const agentPublicKey = computed(() => versionData.value?.agent_public_key || versionData.value?.manifest?.agentPublicKey || null);
const agentFingerprint = computed(() => versionData.value?.agent_fingerprint || 'legacy-unsigned');
const agentSigned = computed(() => !!agentSignature.value && agentSignature.value !== 'system-legacy');

const serverSignature = computed(() => versionData.value?.manifest_signature || null);
const serverPublicKey = computed(() => versionData.value?.server_public_key || null);
const serverFingerprint = computed(() => versionData.value?.server_fingerprint || null);
const serverSigned = computed(() => !!serverSignature.value);

const fileManifest = computed(() => {
  if (!versionData.value?.file_manifest) return {};
  try {
    return typeof versionData.value.file_manifest === 'string'
      ? JSON.parse(versionData.value.file_manifest)
      : versionData.value.file_manifest;
  } catch { return {}; }
});

const fileCount = computed(() => Object.keys(fileManifest.value).length);

const truncate = (str, len = 24) => {
  if (!str || typeof str !== 'string') return 'N/A';
  return str.length > len ? str.substring(0, len) + '...' : str;
};

// ========== Actions ==========
const copyToClipboard = async (text, field) => {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    copiedField.value = field;
    setTimeout(() => { copiedField.value = null; }, 2000);
  } catch (err) { console.error('Failed to copy', err); }
};

const showFullHash = (filename, hash) => {
  selectedHashFile.value = filename;
  selectedHash.value = hash;
};

// ========== Load Version Data ==========
const loadVersionData = async () => {
  loading.value = true;
  try {
    const version = props.repo.latest_version || props.repo.version || 'latest';
    // Call the correct endpoint: /v1/packages/:name/:version/file-manifest
    const res = await fetch(`/v1/packages/${encodeURIComponent(props.repo.name)}/${encodeURIComponent(version)}/file-manifest`);
    if (res.ok) {
      const data = await res.json();
      versionData.value = data;
    }
  } catch (err) {
    console.error('[ManifestTab] Failed to load version:', err);
  } finally {
    loading.value = false;
  }
};

// Load on mount
import { onMounted } from 'vue';
onMounted(loadVersionData);
</script>

<template>
  <!-- Loading State -->
  <div v-if="loading" class="flex items-center justify-center py-16">
    <div class="text-zinc-500 text-sm animate-pulse">Loading manifest data...</div>
  </div>

  <!-- No Data State -->
  <div v-else-if="!versionData" class="flex items-center justify-center py-16">
    <div class="text-zinc-600 text-sm">No version data available.</div>
  </div>

  <!-- Manifest Content -->
  <div v-else class="space-y-6">

    <!-- ==================== DUAL-SIGNATURE TRUST CHAIN ==================== -->
    <div class="bg-card border border-zinc rounded-xl overflow-hidden">
      <div class="border-b border-zinc-800 px-4 py-3 bg-zinc-900/50 flex items-center justify-between">
        <span class="text-sm font-bold text-zinc-400">🔐 Dual-Signature Trust Chain</span>
        <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
          :class="agentSigned && serverSigned
            ? 'bg-emerald-500/20 text-emerald-400'
            : 'bg-amber-500/20 text-amber-400'">
          {{ agentSigned && serverSigned ? '✅ FULLY SIGNED' : '⚠️ PARTIALLY SIGNED' }}
        </span>
      </div>

      <div class="p-6 space-y-6">

        <!-- Agent Signature Block -->
        <div class="rounded-lg border p-4"
          :class="agentSigned ? 'border-blue-500/30 bg-blue-500/5' : 'border-zinc-800 bg-zinc-900/30'">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
              :class="agentSigned ? 'bg-blue-500/10 text-blue-400' : 'bg-zinc-800 text-zinc-600'">
              🤖
            </div>
            <div>
              <h4 class="font-bold text-sm text-zinc-200">Agent Signature</h4>
              <p class="text-xs text-zinc-500">Proves the publishing agent created and signed this manifest</p>
            </div>
            <div class="ml-auto">
              <span class="px-2 py-1 rounded text-[10px] font-bold uppercase"
                :class="agentSigned
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'">
                {{ agentSigned ? '✅ Verified' : '⚠️ Unsigned (Legacy)' }}
              </span>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Fingerprint -->
            <div>
              <div class="text-[10px] text-zinc-500 uppercase font-bold mb-1 tracking-wider">Fingerprint</div>
              <div class="flex items-center gap-2">
                <code class="font-mono text-xs bg-black/50 px-3 py-1.5 rounded border border-zinc-800 text-orange-400 font-bold">
                  🔑 {{ agentFingerprint }}
                </code>
                <button v-if="agentPublicKey" @click="showAgentFullKey = true"
                  class="text-[10px] text-blue-400 hover:text-blue-300 transition-colors">
                  📋 Full Key
                </button>
              </div>
            </div>
            <!-- Signature -->
            <div>
              <div class="text-[10px] text-zinc-500 uppercase font-bold mb-1 tracking-wider">Signature</div>
              <div class="flex items-center gap-2">
                <code class="font-mono text-xs bg-black/50 px-3 py-1.5 rounded border border-zinc-800 text-zinc-300 truncate max-w-[200px]">
                  {{ truncate(agentSignature, 32) }}
                </code>
                <button v-if="agentSigned" @click="showAgentFullSig = true"
                  class="text-[10px] text-blue-400 hover:text-blue-300 transition-colors">
                  🔍 View
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Connector -->
        <div class="flex items-center justify-center gap-3 text-zinc-600 text-xs">
          <div class="w-12 h-px bg-zinc-800"></div>
          <span class="text-emerald-500 font-bold">▼ Validated By ▼</span>
          <div class="w-12 h-px bg-zinc-800"></div>
        </div>

        <!-- Server Signature Block -->
        <div class="rounded-lg border p-4"
          :class="serverSigned ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-zinc-800 bg-zinc-900/30'">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
              :class="serverSigned ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-600'">
              🖥️
            </div>
            <div>
              <h4 class="font-bold text-sm text-zinc-200">Server Signature</h4>
              <p class="text-xs text-zinc-500">Proves this registry validated and accepted the package</p>
            </div>
            <div class="ml-auto">
              <span class="px-2 py-1 rounded text-[10px] font-bold uppercase"
                :class="serverSigned
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-zinc-800 text-zinc-500 border border-zinc-700'">
                {{ serverSigned ? '✅ Server Verified' : '❌ Not Signed' }}
              </span>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Fingerprint -->
            <div>
              <div class="text-[10px] text-zinc-500 uppercase font-bold mb-1 tracking-wider">Fingerprint</div>
              <div class="flex items-center gap-2">
                <code class="font-mono text-xs bg-black/50 px-3 py-1.5 rounded border border-zinc-800 text-emerald-400 font-bold">
                  🔑 {{ serverFingerprint || 'N/A' }}
                </code>
                <button v-if="serverPublicKey" @click="showServerFullKey = true"
                  class="text-[10px] text-emerald-400 hover:text-emerald-300 transition-colors">
                  📋 Full Key
                </button>
              </div>
            </div>
            <!-- Signature -->
            <div>
              <div class="text-[10px] text-zinc-500 uppercase font-bold mb-1 tracking-wider">Signature</div>
              <div class="flex items-center gap-2">
                <code class="font-mono text-xs bg-black/50 px-3 py-1.5 rounded border border-zinc-800 text-zinc-300 truncate max-w-[200px]">
                  {{ truncate(serverSignature, 32) }}
                </code>
                <button v-if="serverSigned" @click="showServerFullSig = true"
                  class="text-[10px] text-emerald-400 hover:text-emerald-300 transition-colors">
                  🔍 View
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ==================== FILE INTEGRITY MANIFEST ==================== -->
    <div class="bg-card border border-zinc rounded-xl overflow-hidden">
      <div class="border-b border-zinc-800 px-4 py-3 bg-zinc-900/50 flex items-center justify-between">
        <span class="text-sm font-bold text-zinc-400">📦 File Integrity Manifest</span>
        <span class="px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded-full text-[10px] font-bold">
          {{ fileCount }} files
        </span>
      </div>

      <div v-if="fileCount === 0" class="p-8 text-center text-zinc-600 text-sm">
        No file manifest available for this version.
      </div>

      <div v-else class="divide-y divide-zinc-800/50">
        <div v-for="(hash, filename) in fileManifest" :key="filename"
          class="px-4 py-3 flex items-center justify-between hover:bg-zinc-900/30 transition-colors">
          <div class="flex items-center gap-3">
            <span class="text-zinc-500 text-sm">📄</span>
            <span class="font-mono text-sm text-zinc-200 font-medium">{{ filename }}</span>
          </div>
          <div class="flex items-center gap-3">
            <code class="font-mono text-[11px] text-zinc-500 hidden md:inline">
              {{ truncate(hash, 28) }}
            </code>
            <button @click="showFullHash(filename, hash)"
              class="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded text-[10px] text-zinc-400 transition-colors border border-zinc-700">
              View Hash
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ==================== MODALS ==================== -->

    <!-- Full Key Modal (Agent or Server) -->
    <Teleport to="body">
      <div v-if="showAgentFullKey || showServerFullKey"
        class="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50"
        @click.self="showAgentFullKey = false; showServerFullKey = false">
        <div class="bg-zinc-900 border border-zinc-700 rounded-xl max-w-lg w-[90%] shadow-2xl">
          <div class="border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
            <h3 class="font-bold text-sm text-zinc-200">
              {{ showAgentFullKey ? '🤖 Agent Public Key' : '🖥️ Server Public Key' }}
            </h3>
            <button @click="showAgentFullKey = false; showServerFullKey = false"
              class="text-zinc-500 hover:text-white text-lg transition-colors">✕</button>
          </div>
          <div class="p-4 space-y-4">
            <div>
              <div class="text-[10px] text-zinc-500 uppercase font-bold mb-2 tracking-wider">Fingerprint</div>
              <code class="font-mono text-sm bg-black/50 px-3 py-2 rounded border border-zinc-800 block text-orange-400 font-bold">
                {{ showAgentFullKey ? agentFingerprint : serverFingerprint }}
              </code>
            </div>
            <div>
              <div class="text-[10px] text-zinc-500 uppercase font-bold mb-2 tracking-wider">Full Public Key (Base64)</div>
              <div class="font-mono text-xs bg-black/50 p-3 rounded border border-zinc-800 break-all text-zinc-300 leading-relaxed">
                {{ showAgentFullKey ? agentPublicKey : serverPublicKey }}
              </div>
            </div>
            <button @click="copyToClipboard(showAgentFullKey ? agentPublicKey : serverPublicKey, 'key')"
              class="w-full px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-bold transition-colors">
              {{ copiedField === 'key' ? '✅ Copied!' : '📋 Copy to Clipboard' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Full Signature Modal -->
    <Teleport to="body">
      <div v-if="showAgentFullSig || showServerFullSig"
        class="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50"
        @click.self="showAgentFullSig = false; showServerFullSig = false">
        <div class="bg-zinc-900 border border-zinc-700 rounded-xl max-w-lg w-[90%] shadow-2xl">
          <div class="border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
            <h3 class="font-bold text-sm text-zinc-200">
              {{ showAgentFullSig ? '🤖 Agent Signature' : '🖥️ Server Signature' }}
            </h3>
            <button @click="showAgentFullSig = false; showServerFullSig = false"
              class="text-zinc-500 hover:text-white text-lg transition-colors">✕</button>
          </div>
          <div class="p-4 space-y-4">
            <div>
              <div class="text-[10px] text-zinc-500 uppercase font-bold mb-2 tracking-wider">
                Ed25519 Detached Signature (Base64)
              </div>
              <div class="font-mono text-xs bg-black/50 p-3 rounded border border-zinc-800 break-all text-zinc-300 leading-relaxed">
                {{ showAgentFullSig ? agentSignature : serverSignature }}
              </div>
            </div>
            <button @click="copyToClipboard(showAgentFullSig ? agentSignature : serverSignature, 'sig')"
              class="w-full px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-bold transition-colors">
              {{ copiedField === 'sig' ? '✅ Copied!' : '📋 Copy to Clipboard' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Full Hash Modal -->
    <Teleport to="body">
      <div v-if="selectedHashFile"
        class="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50"
        @click.self="selectedHashFile = null">
        <div class="bg-zinc-900 border border-zinc-700 rounded-xl max-w-lg w-[90%] shadow-2xl">
          <div class="border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
            <h3 class="font-bold text-sm text-zinc-200">📄 {{ selectedHashFile }}</h3>
            <button @click="selectedHashFile = null"
              class="text-zinc-500 hover:text-white text-lg transition-colors">✕</button>
          </div>
          <div class="p-4 space-y-4">
            <div>
              <div class="text-[10px] text-zinc-500 uppercase font-bold mb-2 tracking-wider">SHA-256 Hash</div>
              <div class="font-mono text-xs bg-black/50 p-3 rounded border border-zinc-800 break-all text-emerald-400 leading-relaxed">
                {{ selectedHash }}
              </div>
            </div>
            <button @click="copyToClipboard(selectedHash, 'hash')"
              class="w-full px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-bold transition-colors">
              {{ copiedField === 'hash' ? '✅ Copied!' : '📋 Copy to Clipboard' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

  </div>
</template>
