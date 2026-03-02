<template>
  <div class="guide">
    <h1>Getting Started Guide</h1>
    <div class="guide-content">
      <div class="guide-section">
        <h2>Installation</h2>
        <pre><code>npm install @your-namespace/your-skill</code></pre>
      </div>
      
      <div class="guide-section">
        <h2>Basic Usage</h2>
        <pre><code>// Import and use the skill
import { yourFunction } from '@your-namespace/your-skill';

const result = await yourFunction(options);</code></pre>
      </div>
      
      <div class="guide-section">
        <h2>Configuration</h2>
        <p>Configure the skill with options:</p>
        <pre><code>const config = {
  apiKey: 'your-api-key',
  timeout: 5000,
  retries: 3
};</code></pre>
      </div>
    </div>
  </div>
</template>

<script setup>
// Guide component
</script>

<style scoped>
.guide h1 {
  text-align: center;
  margin-bottom: 3rem;
}

.guide-content {
  max-width: 800px;
  margin: 0 auto;
}

.guide-section {
  margin-bottom: 3rem;
  background: var(--card-bg);
  padding: 2rem;
  border-radius: 12px;
  border: 1px solid #334155;
}

.guide-section h2 {
  color: var(--primary-color);
  margin-bottom: 1rem;
}

pre {
  background: #0b1220;
  padding: 1.5rem;
  border-radius: 8px;
  overflow-x: auto;
  border: 1px solid #1e293b;
}

code {
  font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
  font-size: 0.9rem;
  color: #e2e8f0;
}
</style>
