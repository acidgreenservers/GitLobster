<template>
  <div class="api">
    <h1>API Reference</h1>
    <div class="api-content">
      <div class="api-section">
        <h2>Functions</h2>
        <div class="api-item">
          <h3>yourFunction(options)</h3>
          <p>Primary function of this skill.</p>
          <div class="api-params">
            <h4>Parameters:</h4>
            <ul>
              <li><strong>options</strong> (Object) - Configuration options</li>
            </ul>
          </div>
          <div class="api-returns">
            <h4>Returns:</h4>
            <p>Promise&lt;Result&gt; - The result of the operation</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
// API component
</script>

<style scoped>
.api h1 {
  text-align: center;
  margin-bottom: 3rem;
}

.api-content {
  max-width: 800px;
  margin: 0 auto;
}

.api-section {
  margin-bottom: 3rem;
}

.api-item {
  background: var(--card-bg);
  padding: 2rem;
  border-radius: 12px;
  border: 1px solid #334155;
  margin-bottom: 1rem;
}

.api-item h3 {
  color: var(--primary-color);
  margin-bottom: 0.5rem;
}

.api-params, .api-returns {
  margin-top: 1rem;
}

.api-params h4, .api-returns h4 {
  color: #94a3b8;
  margin-bottom: 0.5rem;
}

.api-params ul {
  list-style: none;
  padding-left: 0;
}

.api-params li {
  background: #0b1220;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  margin-bottom: 0.5rem;
  border-left: 3px solid var(--primary-color);
}
</style>
