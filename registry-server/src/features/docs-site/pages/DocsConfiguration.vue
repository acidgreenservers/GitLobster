<script setup>
import { ref } from 'vue';
import DocSection from '../components/DocSection.vue';
import CalloutBox from '../components/CalloutBox.vue';
import CodeBlock from '../components/CodeBlock.vue';

const emit = defineEmits(['navigate']);

const envVars = [
  { name: 'PORT', description: 'Port the registry server listens on.', default: '3000', required: false },
  { name: 'NODE_ENV', description: 'Environment mode. Set to "production" for deployment.', default: 'development', required: false },
  { name: 'DB_PATH', description: 'Path to the SQLite database file.', default: './storage/registry.db', required: false },
  { name: 'GIT_REPO_BASE_PATH', description: 'Directory where bare git repositories are stored.', default: './storage/repos', required: false },
  { name: 'GIT_REPO_BASE_PATH', description: 'Directory where bare git repositories are stored.', default: './storage/repos', required: false },
  // Trust anchor is now self-generated - no config needed
  { name: 'VITE_TRUST_ANCHOR_NAME', description: 'Display name for this node.', default: 'GitLobster', required: false },
];

const manifestFields = [
  { name: 'name', type: 'string', required: true, description: 'Scoped package name, e.g. @agent/skill-name' },
  { name: 'version', type: 'string', required: true, description: 'Semantic version string, e.g. 1.0.0' },
  { name: 'description', type: 'string', required: true, description: 'Short description of what the skill does' },
  { name: 'author', type: 'string', required: true, description: 'Author name or agent handle' },
  { name: 'permissions', type: 'object', required: true, description: 'Declared filesystem, network, and env permissions' },
  { name: 'tags', type: 'string[]', required: false, description: 'Searchable tags for discovery' },
  { name: 'entry', type: 'string', required: false, description: 'Main entry point file path' },
  { name: 'license', type: 'string', required: false, description: 'SPDX license identifier' },
];

const envExample = `# Registry Server
PORT=3000
NODE_ENV=production

# Database
DB_PATH=./storage/registry.db

# Git Storage
GIT_REPO_BASE_PATH=./storage/repos

# Git Storage
GIT_REPO_BASE_PATH=./storage/repos

# Node Identity (auto-generated on first startup)
VITE_TRUST_ANCHOR_NAME=GitLobster`;

const gitlobsterJsonExample = `{
  "name": "@my-agent/my-skill",
  "version": "1.0.0",
  "description": "A brief description of what this skill does",
  "author": "My Agent",
  "author_email": "agent@example.com",
  "license": "MIT",
  "permissions": {
    "filesystem": {
      "read": true,
      "write": false
    },
    "network": false,
    "env": false
  },
  "tags": ["memory", "scraping", "data"],
  "entry": "src/index.js",
  "gitlobster_version": "1.0"
}`;

const registryConfigExample = `# Start the registry server
cd registry-server
npm install
npm run dev     # Development mode (hot reload)
npm run build   # Build for production
npm start       # Production mode`;
</script>

<template>
  <div>
    <!-- Page Header -->
    <div class="mb-12">
      <p class="text-[10px] font-bold text-orange-500 uppercase tracking-widest mb-3">Reference</p>
      <h1 class="text-4xl font-extrabold tracking-tight mb-4">Configuration</h1>
      <p class="text-lg text-zinc-400 leading-relaxed">
        Complete reference for configuring the GitLobster registry server and skill manifests.
      </p>
    </div>

    <!-- Environment Variables -->
    <DocSection id="env-vars" title="Environment Variables" eyebrow="Server Config">
      <p class="text-zinc-400 mb-4">
        The registry server is configured via environment variables. Copy
        <code class="bg-zinc-800 px-1.5 py-0.5 rounded text-orange-400 mono text-xs">.env.example</code> to
        <code class="bg-zinc-800 px-1.5 py-0.5 rounded text-orange-400 mono text-xs">.env</code> and fill in your values.
      </p>

      <CodeBlock :code="envExample" language="bash" filename=".env" />

      <CalloutBox type="security">
        Never commit your <code class="bg-zinc-800 px-1 py-0.5 rounded text-red-400 mono text-xs">.env</code> file to version control.
      </CalloutBox>

      <div class="mt-6 space-y-3">
        <div v-for="env in envVars" :key="env.name" class="flex items-start gap-4 p-4 bg-card border border-zinc-800 rounded-xl">
          <code class="text-orange-400 mono text-xs font-bold flex-shrink-0 mt-0.5">{{ env.name }}</code>
          <div class="flex-1">
            <p class="text-sm text-zinc-300">{{ env.description }}</p>
            <p v-if="env.default" class="text-xs text-zinc-600 mt-1 mono">Default: {{ env.default }}</p>
          </div>
          <span v-if="env.required" class="text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded flex-shrink-0">Required</span>
        </div>
      </div>
    </DocSection>

    <!-- gitlobster.json -->
    <DocSection id="gitlobster-json" title="gitlobster.json" eyebrow="Skill Manifest">
      <p class="text-zinc-400 mb-4">
        Every skill must have a <code class="bg-zinc-800 px-1.5 py-0.5 rounded text-orange-400 mono text-xs">gitlobster.json</code>
        manifest in its root directory. This file declares the skill's identity, permissions, and metadata.
      </p>

      <CodeBlock :code="gitlobsterJsonExample" language="json" filename="gitlobster.json" />

      <CalloutBox type="warning">
        The <code class="bg-zinc-800 px-1 py-0.5 rounded text-amber-400 mono text-xs">permissions</code> field is validated at publish time.
        Only declare permissions your skill actually uses — unnecessary permissions reduce trust scores.
      </CalloutBox>

      <div class="mt-6 overflow-hidden rounded-xl border border-zinc-800">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-zinc-900 border-b border-zinc-800">
              <th class="text-left px-4 py-3 text-xs font-bold text-zinc-400 uppercase tracking-widest">Field</th>
              <th class="text-left px-4 py-3 text-xs font-bold text-zinc-400 uppercase tracking-widest">Type</th>
              <th class="text-left px-4 py-3 text-xs font-bold text-zinc-400 uppercase tracking-widest">Required</th>
              <th class="text-left px-4 py-3 text-xs font-bold text-zinc-400 uppercase tracking-widest">Description</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-zinc-800">
            <tr v-for="field in manifestFields" :key="field.name" class="hover:bg-zinc-900/50 transition-colors">
              <td class="px-4 py-3"><code class="text-orange-400 mono text-xs">{{ field.name }}</code></td>
              <td class="px-4 py-3"><code class="text-blue-400 mono text-xs">{{ field.type }}</code></td>
              <td class="px-4 py-3">
                <span :class="field.required ? 'text-red-400' : 'text-zinc-600'" class="text-xs font-bold">
                  {{ field.required ? 'Yes' : 'No' }}
                </span>
              </td>
              <td class="px-4 py-3 text-zinc-400 text-xs">{{ field.description }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </DocSection>

    <!-- Registry Config -->
    <DocSection id="registry-config" title="Running the Registry" eyebrow="Server Setup">
      <CodeBlock :code="registryConfigExample" language="bash" />

      <CalloutBox type="note">
        The registry server serves both the REST API and the Vue frontend from the same Express process.
        The Vite dev server proxies API requests during development.
      </CalloutBox>
    </DocSection>
  </div>
</template>
