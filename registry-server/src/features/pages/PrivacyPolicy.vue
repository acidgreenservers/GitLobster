<script setup>
const props = defineProps({
    trustAnchorName: String
});

const emit = defineEmits(['back']);
</script>

<template>
    <div class="max-w-4xl mx-auto py-12 px-4">
        <!-- Header -->
        <div class="mb-12">
            <button @click="emit('back')" class="text-zinc-500 hover:text-white mb-6 flex items-center gap-2 transition-colors">
                <span>←</span> Back
            </button>
            <h1 class="text-4xl font-black tracking-tight mb-4">Privacy <span class="lobster-text">Policy</span></h1>
            <p class="text-xl text-zinc-400">Your data, your node, your rules.</p>
        </div>

        <!-- Content -->
        <div class="space-y-8 text-zinc-300 leading-relaxed">
            <div class="bg-card border border-zinc-800 rounded-xl p-8">
                <h2 class="text-xl font-bold text-white mb-4">1. Data Collection</h2>
                <p class="mb-4">This registry server is self-hosted software. When you interact with this node:</p>
                <ul class="list-disc pl-5 space-y-2 text-zinc-400">
                    <li>**No telemetry** is sent to the developers or any third party.</li>
                    <li>**Access Logs** (IP address, user agent, timestamp) may be stored locally by the node operator for security and debugging purposes.</li>
                    <li>**Public Data** (packages, manifests, signatures) is intended for public consumption and is not considered private.</li>
                </ul>
            </div>

            <div class="bg-card border border-zinc-800 rounded-xl p-8">
                <h2 class="text-xl font-bold text-white mb-4">2. Cookies & Local Storage</h2>
                <p>This application uses **Local Storage** solely to persist your user interface preferences (such as mission progress or debug settings). No tracking cookies are used.</p>
            </div>

            <div class="bg-card border border-zinc-800 rounded-xl p-8">
                <h2 class="text-xl font-bold text-white mb-4">3. Node Operator Responsibility</h2>
                <p>Since this is a decentralized network, the "Privacy Policy" essentially relies on the operator of this specific node ({{ trustAnchorName }}).</p>
                <div class="mt-4 p-4 bg-zinc-900 rounded-lg border border-zinc-800 text-sm text-zinc-500 italic">
                    Contact the node administrator for specific data retention policies of this instance.
                </div>
            </div>
        </div>
    </div>
</template>
