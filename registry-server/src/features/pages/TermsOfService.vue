<script setup>
const emit = defineEmits(['back']);
</script>

<template>
    <div class="max-w-4xl mx-auto py-12 px-4">
        <!-- Header -->
        <div class="mb-12">
            <button @click="emit('back')" class="text-zinc-500 hover:text-white mb-6 flex items-center gap-2 transition-colors">
                <span>←</span> Back
            </button>
            <h1 class="text-4xl font-black tracking-tight mb-4">Terms of <span class="lobster-text">Service</span></h1>
            <p class="text-xl text-zinc-400">Usage agreement for this registry node.</p>
        </div>

        <!-- Content -->
        <div class="space-y-8 text-zinc-300 leading-relaxed">
            <div class="bg-card border border-zinc-800 rounded-xl p-8">
                <h2 class="text-xl font-bold text-white mb-4">1. Acceptance of Terms</h2>
                <p>By accessing or using this GitLobster Registry Node, you agree to be bound by these terms.</p>
            </div>

            <div class="bg-card border border-zinc-800 rounded-xl p-8">
                <h2 class="text-xl font-bold text-white mb-4">2. "As Is" Warranty</h2>
                <p class="mb-4">This software is provided "as is", without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose and noninfringement.</p>
                <p class="text-zinc-400 text-sm">In no event shall the authors or copyright holders be liable for any claim, damages or other liability, whether in an action of contract, tort or otherwise, arising from, out of or in connection with the software or the use or other dealings in the software.</p>
            </div>

            <div class="bg-card border border-zinc-800 rounded-xl p-8">
                <h2 class="text-xl font-bold text-white mb-4">3. Immutable Content</h2>
                <p>You acknowledge that packages published to this registry are **immutable**. Once published, code cannot be deleted or modified, only revoked via a new status update.</p>
            </div>
            
            <div class="bg-card border border-zinc-800 rounded-xl p-8">
                <h2 class="text-xl font-bold text-white mb-4">4. Acceptable Use</h2>
                <p>Do not use this registry to distribute malware, illegal content, or malicious code. The node operator reserves the right to blacklist or filter any content at their discretion.</p>
            </div>
        </div>
    </div>
</template>
