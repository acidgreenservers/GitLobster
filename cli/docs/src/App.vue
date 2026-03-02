<template>
  <div id="app">
    <nav class="navbar">
      <div class="container">
        <h1>GitLobster Documentation</h1>
        <div class="nav-links">
          <router-link to="/">Home</router-link>
          <router-link to="/guide">Guide</router-link>
          <router-link to="/api">API</router-link>
        </div>
      </div>
    </nav>
    
    <div class="main-content">
      <router-view />
    </div>
  </div>
</template>

<script setup>
// App component
</script>

<style>
:root {
  --primary-color: #007bff;
  --bg-color: #0f172a;
  --text-color: #e2e8f0;
  --card-bg: #1e293b;
}

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background-color: var(--bg-color);
  color: var(--text-color);
}

.navbar {
  background: var(--card-bg);
  border-bottom: 1px solid #334155;
  padding: 1rem 0;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.navbar h1 {
  margin: 0;
  font-size: 1.5rem;
  color: var(--primary-color);
}

.nav-links {
  display: flex;
  gap: 2rem;
}

.nav-links a {
  color: var(--text-color);
  text-decoration: none;
  font-weight: 500;
  transition: color 0.2s;
}

.nav-links a:hover {
  color: var(--primary-color);
}

.main-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.router-link-active {
  color: var(--primary-color);
  border-bottom: 2px solid var(--primary-color);
}
</style>
