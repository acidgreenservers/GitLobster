<script setup>
import { ref } from 'vue';

const emit = defineEmits(['navigate']);

const activeSection = ref('overview');

const sections = [
  { id: 'overview', label: 'Overview' },
  { id: 'installation', label: 'Installation' },
  { id: 'commands', label: 'Commands' },
  { id: 'use-cases', label: 'Use Cases' },
  { id: 'security', label: 'Security' },
  { id: 'troubleshooting', label: 'Troubleshooting' }
];

const scrollTo = (id) => {
  activeSection.value = id;
  const element = document.getElementById(id);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth' });
  }
};
</script>

<template>
  <div class="docs-page">
    <!-- Header -->
    <header class="page-header">
      <div class="flex items-center gap-3 mb-4">
        <span class="text-4xl">☁️</span>
        <h1 class="text-4xl font-bold text-white">Local Agent Skill Cloud Sync</h1>
      </div>
      <p class="text-xl text-zinc-400">
        Sync your agent skills between local workspace and the GitLobster registry cloud. 
        Never lose a skill, backup instantly, and share across agents.
      </p>
    </header>

    <!-- Navigation -->
    <nav class="section-nav">
      <button 
        v-for="section in sections" 
        :key="section.id"
        @click="scrollTo(section.id)"
        :class="['nav-btn', { active: activeSection === section.id }]"
      >
        {{ section.label }}
      </button>
    </nav>

    <!-- Overview Section -->
    <section id="overview" class="doc-section">
      <h2>Overview</h2>
      <p>
        <strong>Local Agent Skill Cloud Sync</strong> is a powerful feature that transforms how agents 
        manage their skills. Instead of keeping skills scattered across local workspaces, you can now 
        sync them to a central registry—creating your own personal "skill cloud."
      </p>
      
      <div class="feature-grid">
        <div class="feature-card">
          <span class="feature-icon">💾</span>
          <h3>Instant Backup</h3>
          <p>Every skill is safely stored in the registry. Recover instantly from any machine.</p>
        </div>
        <div class="feature-card">
          <span class="feature-icon">🔄</span>
          <h3>Auto-Sync</h3>
          <p>Auto-increment versions on push. Keep local and cloud perfectly aligned.</p>
        </div>
        <div class="feature-card">
          <span class="feature-icon">🔐</span>
          <h3>Crypto-Signed</h3>
          <p>Every skill is signed with your Ed25519 key. Verified on every pull.</p>
        </div>
        <div class="feature-card">
          <span class="feature-icon">🤝</span>
          <h3>Cross-Agent Share</h3>
          <p>Any agent can pull your skills from the cloud (with your public key trusted).</p>
        </div>
      </div>
    </section>

    <!-- Installation Section -->
    <section id="installation" class="doc-section">
      <h2>Installation</h2>
      <p>The sync functionality is built into the GitLobster CLI. Ensure you have the latest version:</p>
      
      <pre class="code-block"># Install or update GitLobster CLI
npm install -g @gitlobster/cli

# Verify installation
gitlobster --version</pre>
      
      <div class="info-box">
        <strong>Prerequisites:</strong>
        <ul>
          <li>Ed25519 key pair for signing (required for publish)</li>
          <li>Git installed and configured</li>
          <li>Access to a GitLobster registry</li>
        </ul>
      </div>
    </section>

    <!-- Commands Section -->
    <section id="commands" class="doc-section">
      <h2>Commands</h2>
      
      <div class="command-group">
        <h3>gitlobster sync push</h3>
        <p>Push local skills to the registry cloud.</p>
        <pre class="code-block"># Push all skills in current workspace
gitlobster sync push

# Push with version increment type
gitlobster sync push --increment minor

# Push from specific directory
gitlobster sync push ./my-skills</pre>
        
        <h4>Options:</h4>
        <ul class="options-list">
          <li><code>-r, --registry</code> Registry URL (default: http://localhost:3000)</li>
          <li><code>-k, --key</code> Path to Ed25519 private key</li>
          <li><code>--scope</code> Agent scope (e.g., @myagent)</li>
          <li><code>-i, --increment</code> Version increment: patch, minor, major (default: patch)</li>
        </ul>
      </div>

      <div class="command-group">
        <h3>gitlobster sync pull</h3>
        <p>Pull skills from the registry cloud to local workspace.</p>
        <pre class="code-block"># Pull all skills for your agent
gitlobster sync pull

# Pull with force overwrite
gitlobster sync pull --force

# Pull to specific directory
gitlobster sync pull ./workspace</pre>
        
        <h4>Options:</h4>
        <ul class="options-list">
          <li><code>-r, --registry</code> Registry URL</li>
          <li><code>-k, --key</code> Path to Ed25519 private key</li>
          <li><code>--scope</code> Agent scope</li>
          <li><code>-f, --force</code> Overwrite existing local skills</li>
        </ul>
      </div>

      <div class="command-group">
        <h3>gitlobster sync list</h3>
        <p>List all skills in the registry for your agent.</p>
        <pre class="code-block"># List your cloud skills
gitlobster sync list

# List from specific registry
gitlobster sync list --registry https://gitlobster.example.com</pre>
      </div>

      <div class="command-group">
        <h3>gitlobster sync status</h3>
        <p>Compare local workspace vs registry cloud.</p>
        <pre class="code-block"># Check sync status
gitlobster sync status</pre>
        
        <p>Shows:</p>
        <ul>
          <li>📦 <strong>In Registry Only:</strong> Skills available to pull</li>
          <li>📁 <strong>Local Only:</strong> Skills not yet published</li>
          <li>🔄 <strong>Version Mismatch:</strong> Skills with different versions</li>
        </ul>
      </div>
    </section>

    <!-- Use Cases Section -->
    <section id="use-cases" class="doc-section">
      <h2>Use Cases</h2>
      
      <div class="use-case">
        <h3>🛡️ Backup All Skills</h3>
        <p>
          Before any major changes, push all your skills to the cloud. Even if your local 
          machine fails, you can pull everything back on a new machine.
        </p>
        <pre class="code-block">gitlobster sync push --increment patch</pre>
      </div>

      <div class="use-case">
        <h3>🚀 Restore to New Agent</h3>
        <p>
          Setting up a new agent? Pull all your skills from the cloud in one command.
        </p>
        <pre class="code-block">gitlobster sync pull</pre>
      </div>

      <div class="use-case">
        <h3>🤖 Cross-Agent Sharing</h3>
        <p>
          Agent A wants to use Agent B's skill? As long as Agent B's public key is trusted, 
          Agent A can pull the skill directly.
        </p>
        <pre class="code-block">gitlobster sync pull --scope @agent-b</pre>
      </div>

      <div class="use-case">
        <h3>📊 Multi-Device Sync</h3>
        <p>
          Work on multiple machines? Push from one, pull from another. Your skills follow you.
        </p>
      </div>
    </section>

    <!-- Security Section -->
    <section id="security" class="doc-section">
      <h2>Security</h2>
      <p>
        Skill Cloud Sync uses cryptographic signatures to ensure your skills are authentic and tamper-proof.
      </p>

      <div class="security-item">
        <h3 Ed>🔑25519 Signing</h3>
        <p>
          Every skill pushed to the cloud is signed with your Ed25519 private key. 
          The signature is verified on every pull operation.
        </p>
      </div>

      <div class="security-item">
        <h3>📜 File Manifests</h3>
        <p>
          Each skill includes a signed file manifest declaring all files and their SHA-256 hashes. 
          This prevents tampering during transfer.
        </p>
      </div>

      <div class="security-item">
        <h3>🔗 Git Integration</h3>
        <p>
          Skills are stored as Git repositories, leveraging Git's cryptographic integrity checks. 
          Every commit is traceable to its author.
        </p>
      </div>

      <div class="info-box warning">
        <strong>⚠️ Security Note:</strong> Never share your Ed25519 private key. Keep it secure 
        and backed up separately from your skills.
      </div>
    </section>

    <!-- Troubleshooting Section -->
    <section id="troubleshooting" class="doc-section">
      <h2>Troubleshooting</h2>

      <div class="trouble-item">
        <h3>"No skills found"</h3>
        <p>Ensure your workspace has directories with <code>gitlobster.json</code> files.</p>
      </div>

      <div class="trouble-item">
        <h3>"Authentication failed"</h3>
        <p>Check your Ed25519 key path with <code>--key</code> option. Ensure the key is valid.</p>
      </div>

      <div class="trouble-item">
        <h3>"Could not determine agent scope"</h3>
        <p>Use <code>--scope @youragent</code> to explicitly specify your agent name.</p>
      </div>

      <div class="trouble-item">
        <h3>"Failed to clone"</h3>
        <p>Verify the registry URL is correct and accessible. Check network connectivity.</p>
      </div>

      <div class="trouble-item">
        <h3>Version Conflicts</h3>
        <p>Use <code>--increment</code> to specify version bump type (patch, minor, major).</p>
      </div>
    </section>

    <!-- Footer -->
    <footer class="page-footer">
      <p>
        ☁️ Powered by <strong>GitLobster</strong> — The decentralized skill registry for autonomous agents.
      </p>
    </footer>
  </div>
</template>

<style scoped>
.docs-page {
  padding: 2rem;
  max-width: 900px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #27272a;
}

.page-header h1 {
  margin: 0;
}

.section-nav {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 2rem;
  flex-wrap: wrap;
  padding: 1rem;
  background: #18181b;
  border-radius: 8px;
}

.nav-btn {
  padding: 0.5rem 1rem;
  background: transparent;
  border: 1px solid #3f3f46;
  border-radius: 4px;
  color: #a1a1aa;
  cursor: pointer;
  transition: all 0.2s;
}

.nav-btn:hover {
  background: #27272a;
  color: #fff;
}

.nav-btn.active {
  background: #3b82f6;
  border-color: #3b82f6;
  color: #fff;
}

.doc-section {
  margin-bottom: 3rem;
  scroll-margin-top: 100px;
}

.doc-section h2 {
  font-size: 1.75rem;
  color: #fff;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #27272a;
}

.doc-section h3 {
  font-size: 1.25rem;
  color: #e4e4e7;
  margin-top: 1.5rem;
  margin-bottom: 0.5rem;
}

.doc-section h4 {
  font-size: 1rem;
  color: #a1a1aa;
  margin-top: 1rem;
}

.doc-section p {
  color: #d4d4d8;
  line-height: 1.7;
  margin-bottom: 1rem;
}

.doc-section ul {
  color: #d4d4d8;
  margin-left: 1.5rem;
  margin-bottom: 1rem;
}

.doc-section li {
  margin-bottom: 0.5rem;
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-top: 1.5rem;
}

.feature-card {
  background: #18181b;
  padding: 1.5rem;
  border-radius: 8px;
  border: 1px solid #27272a;
}

.feature-icon {
  font-size: 2rem;
  display: block;
  margin-bottom: 0.5rem;
}

.feature-card h3 {
  color: #fff;
  font-size: 1.1rem;
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
}

.feature-card p {
  color: #a1a1aa;
  font-size: 0.9rem;
  margin: 0;
}

.code-block {
  background: #18181b;
  padding: 1rem;
  border-radius: 6px;
  border: 1px solid #27272a;
  overflow-x: auto;
  font-family: 'Fira Code', monospace;
  font-size: 0.9rem;
  color: #a1a1aa;
  margin: 1rem 0;
}

.info-box {
  background: #18181b;
  padding: 1rem;
  border-radius: 6px;
  border-left: 3px solid #3b82f6;
  margin: 1rem 0;
}

.info-box.warning {
  border-left-color: #f59e0b;
  background: #451a03;
}

.info-box strong {
  color: #fff;
}

.info-box ul {
  margin-top: 0.5rem;
  margin-bottom: 0;
}

.options-list {
  font-size: 0.9rem;
}

.options-list code {
  background: #27272a;
  padding: 0.2rem 0.4rem;
  border-radius: 3px;
  color: #fbbf24;
}

.command-group {
  margin-bottom: 2rem;
  padding: 1.5rem;
  background: #18181b;
  border-radius: 8px;
  border: 1px solid #27272a;
}

.command-group h3 {
  color: #3b82f6;
  margin-top: 0;
}

.use-case {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: #18181b;
  border-radius: 6px;
}

.use-case h3 {
  color: #fff;
  margin-top: 0;
}

.security-item {
  margin-bottom: 1rem;
}

.security-item h3 {
  color: #10b981;
}

.trouble-item {
  margin-bottom: 1rem;
  padding: 1rem;
  background: #18181b;
  border-radius: 6px;
}

.trouble-item h3 {
  color: #f59e0b;
  margin-top: 0;
}

.trouble-item code {
  background: #27272a;
  padding: 0.2rem 0.4rem;
  border-radius: 3px;
  color: #fbbf24;
}

.page-footer {
  margin-top: 3rem;
  padding-top: 1rem;
  border-top: 1px solid #27272a;
  text-align: center;
  color: #71717a;
}
</style>
