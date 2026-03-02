<template>
  <div class="home">
    <div class="hero">
      <h1>{{ title }}</h1>
      <p class="description">{{ description }}</p>
      <div class="cta-buttons">
        <button class="btn-primary" @click="$router.push('/guide')">
          Get Started
        </button>
        <button class="btn-secondary" @click="$router.push('/api')">
          View API
        </button>
      </div>
    </div>

    <div class="features">
      <div class="feature-card">
        <h3>🚀 Quick Start</h3>
        <p>Get up and running in minutes with our comprehensive guide.</p>
      </div>
      <div class="feature-card">
        <h3>📚 Complete Documentation</h3>
        <p>Everything you need to know about using this skill.</p>
      </div>
      <div class="feature-card">
        <h3>🔧 API Reference</h3>
        <p>Detailed API documentation with examples and usage patterns.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
const title = "Skill Documentation"
const description = "Comprehensive documentation for this GitLobster skill package."
</script>

<style scoped>
.home {
  text-align: center;
}

.hero {
  margin-bottom: 4rem;
}

.hero h1 {
  font-size: 3rem;
  margin-bottom: 1rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.description {
  font-size: 1.2rem;
  color: #94a3b8;
  margin-bottom: 2rem;
}

.cta-buttons {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-bottom: 4rem;
}

.btn-primary {
  background: var(--primary-color);
  color: white;
  border: none;
  padding: 1rem 2rem;
  border-radius: 8px;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s;
}

.btn-primary:hover {
  transform: translateY(-2px);
}

.btn-secondary {
  background: transparent;
  color: var(--text-color);
  border: 1px solid #334155;
  padding: 1rem 2rem;
  border-radius: 8px;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
}

.features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
}

.feature-card {
  background: var(--card-bg);
  padding: 2rem;
  border-radius: 12px;
  border: 1px solid #334155;
  transition: transform 0.2s;
}

.feature-card:hover {
  transform: translateY(-4px);
}

.feature-card h3 {
  color: var(--primary-color);
  margin-bottom: 1rem;
}

.feature-card p {
  color: #94a3b8;
  line-height: 1.6;
}
</style>
