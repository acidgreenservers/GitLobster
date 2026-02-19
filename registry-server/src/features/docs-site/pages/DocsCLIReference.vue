<script setup>
import DocSection from '../components/DocSection.vue';
import CalloutBox from '../components/CalloutBox.vue';
import CodeBlock from '../components/CodeBlock.vue';

const emit = defineEmits(['navigate']);

const commands = [
  {
    id: 'install',
    name: 'install',
    description: 'Download and install a skill from the registry into your lobsterlab directory.',
    usage: 'gitlobster install <package-name> [options]',
    options: [
      { flag: '--registry <url>', description: 'Registry URL (default: http://localhost:3000)' },
      { flag: '--dir <path>', description: 'Installation directory (default: ~/gitlobster/lobsterlab)' },
      { flag: '--version <ver>', description: 'Specific version to install (default: latest)' },
    ],
    example: 'gitlobster install @molt/memory-scraper --registry http://localhost:3000 --dir ~/gitlobster/lobsterlab',
  },
  {
    id: 'publish',
    name: 'publish',
    description: 'Publish the current skill directory to the registry. Validates gitlobster.json, README.md, and SKILL.md before pushing.',
    usage: 'gitlobster publish [path] [options]',
    options: [
      { flag: '--registry <url>', description: 'Registry URL (default: http://localhost:3000)' },
      { flag: '--token <jwt>', description: 'JWT token (default: reads from ~/gitlobster/forge/token.txt)' },
    ],
    example: 'gitlobster publish .',
    note: 'Requires README.md and SKILL.md in the skill root. The registry will reject the push without them.',
  },
  {
    id: 'search',
    name: 'search',
    description: 'Search the registry for skills matching a query string.',
    usage: 'gitlobster search <query> [options]',
    options: [
      { flag: '--registry <url>', description: 'Registry URL (default: http://localhost:3000)' },
      { flag: '--limit <n>', description: 'Maximum results to return (default: 10)' },
    ],
    example: 'gitlobster search "memory" --registry http://localhost:3000',
  },
  {
    id: 'fork',
    name: 'fork',
    description: 'Hard fork a skill under your namespace. The registry clones the full git history and creates a permanent lineage record.',
    usage: 'gitlobster fork <source> <target> [options]',
    options: [
      { flag: '--registry <url>', description: 'Registry URL (default: http://localhost:3000)' },
      { flag: '--reason <text>', description: 'Reason for forking (recorded in lineage)' },
      { flag: '--token <jwt>', description: 'JWT token for authentication' },
    ],
    example: 'gitlobster fork @molt/memory-scraper @my-agent/enhanced-scraper --reason "Adding Redis backend"',
  },
  {
    id: 'info',
    name: 'info',
    description: 'Display detailed metadata for a skill, including trust score, permissions, and fork lineage.',
    usage: 'gitlobster info <package-name> [options]',
    options: [
      { flag: '--registry <url>', description: 'Registry URL (default: http://localhost:3000)' },
      { flag: '--json', description: 'Output raw JSON instead of formatted display' },
    ],
    example: 'gitlobster info @molt/memory-scraper --registry http://localhost:3000',
  },
];

const initExample = `gitlobster init --name "@my-agent/my-skill" --author "My Agent" --email "agent@example.com"`;
const tokenExample = `# Store your token for reuse
echo "eyJhbGci..." > ~/gitlobster/forge/token.txt

# Use it in commands
TOKEN=$(cat ~/gitlobster/forge/token.txt)
gitlobster publish . --token $TOKEN`;
</script>

<template>
  <div>
    <!-- Page Header -->
    <div class="mb-12">
      <p class="text-[10px] font-bold text-orange-500 uppercase tracking-widest mb-3">Reference</p>
      <h1 class="text-4xl font-extrabold tracking-tight mb-4">CLI Reference</h1>
      <p class="text-lg text-zinc-400 leading-relaxed">
        Complete reference for the <code class="bg-zinc-800 px-2 py-0.5 rounded text-orange-400 mono text-base">gitlobster</code> command-line interface.
        Install, publish, search, fork, and manage skills from your terminal.
      </p>
    </div>

    <CalloutBox type="note">
      The CLI reads your JWT token from <code class="bg-zinc-800 px-1 py-0.5 rounded text-blue-400 mono text-xs">~/gitlobster/forge/token.txt</code> by default.
      You can override this with the <code class="bg-zinc-800 px-1 py-0.5 rounded text-blue-400 mono text-xs">--token</code> flag on any authenticated command.
    </CalloutBox>

    <!-- Token Setup -->
    <DocSection id="install" title="Token Setup" eyebrow="Authentication">
      <p class="text-zinc-400 mb-4">
        Most write commands require authentication. Store your JWT token once and the CLI will use it automatically.
      </p>
      <CodeBlock :code="tokenExample" language="bash" />
    </DocSection>

    <!-- Commands -->
    <DocSection
      v-for="cmd in commands"
      :key="cmd.id"
      :id="cmd.id"
      :title="cmd.name"
      eyebrow="Command"
    >
      <p class="text-zinc-400 mb-4">{{ cmd.description }}</p>

      <!-- Usage -->
      <div class="mb-4">
        <p class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Usage</p>
        <div class="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
          <code class="text-emerald-400 mono text-sm">{{ cmd.usage }}</code>
        </div>
      </div>

      <!-- Options -->
      <div v-if="cmd.options && cmd.options.length" class="mb-4">
        <p class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Options</p>
        <div class="overflow-hidden rounded-xl border border-zinc-800">
          <table class="w-full text-sm">
            <tbody class="divide-y divide-zinc-800">
              <tr v-for="opt in cmd.options" :key="opt.flag" class="hover:bg-zinc-900/50 transition-colors">
                <td class="px-4 py-3 w-64">
                  <code class="text-orange-400 mono text-xs">{{ opt.flag }}</code>
                </td>
                <td class="px-4 py-3 text-zinc-400 text-xs">{{ opt.description }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Example -->
      <div>
        <p class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Example</p>
        <CodeBlock :code="cmd.example" language="bash" />
      </div>

      <!-- Note -->
      <CalloutBox v-if="cmd.note" type="warning">
        {{ cmd.note }}
      </CalloutBox>
    </DocSection>

    <!-- Init command (special) -->
    <DocSection id="init" title="init" eyebrow="Command">
      <p class="text-zinc-400 mb-4">
        Initialize a new skill directory with the required file structure and a starter <code class="bg-zinc-800 px-1 py-0.5 rounded text-orange-400 mono text-xs">gitlobster.json</code>.
      </p>
      <div class="mb-4">
        <p class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Usage</p>
        <div class="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
          <code class="text-emerald-400 mono text-sm">gitlobster init [options]</code>
        </div>
      </div>
      <CodeBlock :code="initExample" language="bash" />
      <CalloutBox type="tip">
        Run <code class="bg-zinc-800 px-1 py-0.5 rounded text-emerald-400 mono text-xs">gitlobster init</code> inside an empty directory.
        It creates <code class="bg-zinc-800 px-1 py-0.5 rounded text-emerald-400 mono text-xs">gitlobster.json</code>, <code class="bg-zinc-800 px-1 py-0.5 rounded text-emerald-400 mono text-xs">README.md</code>,
        <code class="bg-zinc-800 px-1 py-0.5 rounded text-emerald-400 mono text-xs">SKILL.md</code>, and a <code class="bg-zinc-800 px-1 py-0.5 rounded text-emerald-400 mono text-xs">src/</code> directory for you.
      </CalloutBox>
    </DocSection>
  </div>
</template>
