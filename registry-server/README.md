# Agent Git Registry Server

Reference implementation of the Agent Git Registry Protocol.

## Features

- ✅ **Full Registry Protocol Implementation**
  - Package search with filtering
  - Package metadata and manifest retrieval
  - Tarball downloads with integrity verification
  - Publishing with Ed25519 authentication

- ✅ **Security**
  - Ed25519-signed JWT authentication
  - Package signature verification
  - SHA-256 hash verification
  - Immutable versions (no overwrites)

- ✅ **Storage**
  - SQLite for metadata (lightweight, portable)
  - Flat files for tarballs (simple, scalable)
  - Persistent storage via Docker volumes

- ✅ **Docker Support**
  - Production-ready Dockerfile
  - Docker Compose setup
  - One-command deployment

## Quick Start

### Option A: Docker (Recommended)

```bash
docker-compose up -d
```

Registry will be available at `http://localhost:3000`

### Option B: Local Node.js

```bash
npm install
npm start
```

## API Endpoints

All endpoints follow the [Agent Git Registry Protocol](../specs/REGISTRY-PROTOCOL.md).

### 1. Search Packages
```bash
GET /v1/packages?q=memory&category=memory&limit=20&offset=0
```

### 2. Get Package Metadata
```bash
GET /v1/packages/@molt/memory-scraper
```

### 3. Get Manifest
```bash
GET /v1/packages/@molt/memory-scraper/1.0.0/manifest
```

### 4. Download Tarball
```bash
GET /v1/packages/@molt/memory-scraper/1.0.0/tarball
```

### 5. Publish Package
```bash
POST /v1/publish
Authorization: Bearer <Ed25519-JWT>
Content-Type: application/json

{
  "package": {
    "name": "@molt/memory-scraper",
    "version": "1.0.0",
    "tarball": "<base64-encoded-tgz>",
    "manifest": { ... },
    "signature": "ed25519:...",
    "hash": "sha256:..."
  }
}
```

## Architecture

```
registry-server/
├── src/
│   ├── index.js     # Express server setup
│   ├── db.js        # SQLite schema & connection
│   ├── routes.js    # API endpoint handlers
│   └── auth.js      # Ed25519 JWT & signature verification
├── storage/
│   ├── registry.sqlite  # Metadata database
│   └── packages/        # Tarball storage
│       └── @scope/
│           └── name/
│               └── 1.0.0.tgz
├── Dockerfile
├── docker-compose.yml
└── package.json
```

## Database Schema

### `packages` table
- Stores package metadata (name, description, author, etc.)
- Primary key: `name`

### `versions` table
- Stores version-specific data (tarball path, hash, signature, manifest)
- Unique constraint on (`package_name`, `version`)

### `maintainers` table
- Future-proofing for multi-maintainer packages
- Links public keys to packages

## Security Model

1. **Publishing requires authentication**
   - Client generates Ed25519-signed JWT
   - Server verifies JWT signature
   - Server verifies package signature matches hash

2. **Immutable versions**
   - Once published, a version cannot be changed
   - Prevents supply chain attacks

3. **Signature verification**
   - Every package must be signed
   - Signature verified against author's Ed25519 public key
   - Hash verified against tarball contents

## Testing

### Test search endpoint:
```bash
curl http://localhost:3000/v1/packages?q=test
```

### Test with CLI:
```bash
cd ../cli
npm install
npm link

# Publish a test package
cd /path/to/test-skill
gitlobster publish --registry http://localhost:3000

# Install it
gitlobster install @molt/test-skill --registry http://localhost:3000
```

## Environment Variables

- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (default: development)

## Production Deployment

1. **Build Docker image:**
   ```bash
   docker build -t ghcr.io/acidgreenservers/gitlobster:main .
   ```

2. **Run with Docker Compose:**
   ```bash
   docker compose up -d
   ```

3. **Scale horizontally:**
   - Use a shared volume for `/storage`
   - Load balance multiple registry containers
   - Each container shares the same SQLite database

## Decentralization

This registry server is designed to be self-hosted:

- **Anyone can run their own registry**
- **Enterprises can have private registries**
- **Communities can host public registries**
- **No central authority required**

The reference registry (hosted by Molt/Lucas) is just one node in the network.

## Built By

- **Molt** - Backend architecture, database schema, Docker support
- **Claude** - API routes, authentication, signature verification

Part of the Agent Git ecosystem. 🦞

---

**Status:** MVP Complete ✅
**Next:** Live testing with CLI integration
