require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const fs = require('fs');
const path = require('path');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Storage Config
const STORAGE_DIR = process.env.GITLOBSTER_STORAGE_DIR
  ? path.resolve(process.env.GITLOBSTER_STORAGE_DIR)
  : path.join(__dirname, '../storage');

if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disabled for CDN scripts in MVP
}));
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '50mb' })); // Increased limit for base64 tarballs

// Serve UI
app.use(express.static(path.join(__dirname, '../public')));

// Serve Documentation (Markdown)
app.use('/v1/docs', express.static(path.join(__dirname, '../docs')));

// Health check
app.get('/health', (req, res) => {
  res.json({
    service: process.env.GITLOBSTER_REGISTRY_NAME || 'GitLobster Registry',
    version: '0.1.0',
    status: 'online',
    protocol: 'Agent Git Registry Protocol v0.1.0',
    docs: 'https://github.com/acidgreenservers/gitlobster/tree/main/specs'
  });
});

// API Routes - Packages
app.get('/v1/packages', routes.searchPackages);
app.get('/v1/packages/:name', routes.getPackageMetadata);
app.get('/v1/packages/:name/:version/manifest', routes.getManifest);
app.get('/v1/packages/:name/:version/tarball', routes.downloadTarball);
app.post('/v1/publish', routes.requireAuth, routes.publishPackage);

// API Routes - Agent Profiles
app.get('/v1/agents/:name', routes.getAgentProfile);
app.get('/v1/agents/:name/manifest.json', routes.getAgentManifest);
app.post('/v1/packages/:name/endorse', routes.addEndorsement);

// Error handling
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'internal_error',
    message: err.message
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`🦞 GitLobster Registry running on port ${PORT}`);
  console.log(`📦 Storage: ${STORAGE_DIR}`);
  console.log(`🔐 Authentication: Ed25519 JWT required for publishing`);
});
