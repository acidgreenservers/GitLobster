<script setup>
import { ref } from 'vue';

const props = defineProps({
    title: {
        type: String,
        required: true
    },
    docName: {
        type: String,
        required: true
    },
    content: {
        type: String,
        required: true
    }
});

const emit = defineEmits(['close']);

const copySuccess = ref(false);

const copyToClipboard = async (text) => {
    if (!text) return;
    try {
        await navigator.clipboard.writeText(text);
        copySuccess.value = true;
        setTimeout(() => { copySuccess.value = false; }, 2000);
    } catch (err) {
        console.error('Failed to copy text: ', err);
    }
};
</script>

<template>
    <div class="fixed inset-0 z-[120] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/90 backdrop-blur-md" @click="emit('close')"></div>
        <div
            class="bg-card border border-zinc-800 rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-hidden shadow-2xl relative z-[130] flex flex-col">
            <!-- Header -->
            <div class="p-6 border-b border-zinc-800 flex justify-between items-center bg-black/20 flex-shrink-0">
                <div class="flex items-center gap-3">
                    <h3 class="text-xl font-bold tracking-tight">{{ title }}</h3>
                    <span class="text-[10px] text-zinc-600 mono bg-zinc-900 px-2 py-1 rounded">{{ docName }}</span>
                </div>
                <div class="flex items-center gap-3">
                    <button @click="copyToClipboard(content.replace(/<[^>]*>/g, ''))"
                        class="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs font-bold transition-colors border border-zinc-700">
                        {{ copySuccess ? '✅ Copied' : '📋 Copy Raw' }}
                    </button>
                    <button @click="copyToClipboard(`${window.location.origin}/v1/docs/${docName}`)"
                        class="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs font-bold transition-colors border border-zinc-700">
                        🔗 Copy URL
                    </button>
                    <button @click="emit('close')"
                        class="text-zinc-500 hover:text-white transition-colors text-2xl">&times;</button>
                </div>
            </div>

            <!-- Rendered Doc Content -->
            <div class="overflow-y-auto flex-1 p-8">
                <article
                    class="prose prose-invert max-w-none prose-headings:lobster-text prose-a:text-orange-400 prose-code:text-emerald-400"
                    v-html="content">
                </article>
            </div>

            <!-- Footer -->
            <div class="p-4 border-t border-zinc-800 flex justify-between items-center bg-black/20 flex-shrink-0">
                <div class="text-[10px] text-zinc-600 mono flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Served from /v1/docs/{{ docName }}
                </div>
                <button @click="emit('close')"
                    class="px-6 py-2 lobster-gradient text-black rounded-lg text-xs font-bold transition-colors">Done</button>
            </div>
        </div>
    </div>
</template>
