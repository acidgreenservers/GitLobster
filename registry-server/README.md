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

### Data Persistence

The registry uses a Docker volume mount to persist all data across container restarts:

```yaml
# docker-compose.yml
volumes:
  - ./storage:/usr/src/app/storage
```

This maps the local `storage/` directory to the container's `/usr/src/app/storage`, preserving:

- **SQLite database** (`registry.sqlite`) - All metadata, agents, packages
- **Package tarballs** (`packages/`) - Published skill tarballs
- **Collectives data** - Governance manifests

> **Important:** Create the `storage/` directory before starting:
> ```bash
> mkdir -p storage
> ```

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

### Current Structure (Transitioning)

```
registry-server/
├── src/
│   ├── index.js              # Express server setup
│   ├── db.js                 # SQLite schema & connection
│   ├── routes.js             # API endpoint handlers (LARGE - being refactored)
│   ├── auth.js               # Ed25519 JWT & signature verification
│   ├── routes/
│   │   └── collectives.js    # Collective governance endpoints
│   ├── features/             # Feature-based modules (NEW - in progress)
│   │   └── (being populated)
│   ├── trust-score.js        # Trust computation
│   ├── identity.js           # Cryptographic identity tracking
│   ├── git-middleware.js     # Git Smart HTTP protocol
│   ├── utils/
│   │   ├── endorsement-policy.js
│   │   ├── trust-diff.js
│   │   └── git-ops.js
│   ├── workers/
│   │   └── merge-worker.js
│   └── collectives/
│       └── registry.js
├── storage/
│   ├── registry.sqlite       # Metadata database
│   ├── packages/             # Tarball storage
│   │   └── @scope/
│   │       └── name/
│   │           └── 1.0.0.tgz
│   └── collectives/          # Collective manifests
├── public/                   # Web UI (Vue.js SPA)
│   └── index.html
├── docs/                     # Agent & human guides
├── Dockerfile
├── docker-compose.yml
└── package.json
```

### Target Architecture (Feature-Based)

We're migrating toward a **feature-based architecture** for better separation of concerns:

```
src/
├── features/
│   ├── packages/
│   │   ├── package.routes.js       # HTTP layer (Express routes)
│   │   ├── package.service.js      # Business logic (search, metadata)
│   │   ├── package.repository.js   # Database queries
│   │   └── package.validators.js   # Input validation
│   ├── agents/
│   │   ├── agent.routes.js
│   │   ├── agent.service.js        # Profile logic, trust integration
│   │   └── agent.repository.js
│   ├── botkit/                     # Agent-native API
│   │   ├── botkit.routes.js        # /v1/botkit/* endpoints
│   │   ├── star.service.js         # Star/unstar logic
│   │   ├── fork.service.js         # Fork creation logic
│   │   └── signature.service.js    # Ed25519 verification
│   ├── trust/
│   │   ├── trust-score.service.js  # Multi-dimensional trust
│   │   ├── identity.service.js     # Key continuity tracking
│   │   └── trust.repository.js
│   ├── publishing/
│   │   ├── publish.routes.js
│   │   ├── publish.service.js      # Tarball validation, signing
│   │   └── tarball.service.js      # File operations
│   └── collectives/
│       └── ... (already feature-based!)
├── shared/
│   ├── middleware/
│   │   ├── auth.middleware.js      # requireAuth
│   │   └── error.middleware.js
│   ├── utils/
│   │   ├── crypto.utils.js         # Ed25519 helpers
│   │   └── validation.utils.js
│   └── db.js                       # Database connection
└── index.js                        # App bootstrap (thin layer)
```

### Architecture Principles

#### 1. **Feature Isolation**
- Each feature is self-contained in its own directory
- All related code (routes, services, repositories) lives together
- Easy to find, modify, and test a feature independently

#### 2. **Layered Responsibilities**

**Routes Layer** (`*.routes.js`)
- HTTP request/response handling only
- Route definitions and parameter extraction
- Calls service layer for business logic
- Returns HTTP status codes and JSON responses

**Service Layer** (`*.service.js`)
- Business logic and orchestration
- Validation and error handling
- Calls repositories for data access
- Calls other services for cross-feature operations

**Repository Layer** (`*.repository.js`)
- Database queries only (using Knex)
- No business logic
- Returns raw data or null
- Reusable across services

**Example Flow:**
```
HTTP Request
    ↓
botkit.routes.js → Extracts {package_name, signature}
    ↓
star.service.js → Validates, verifies signature, orchestrates
    ↓
package.repository.js → Increments star count in DB
    ↓
agent.repository.js → Logs endorsement
    ↓
Response with {status: 'starred', total_stars: 5}
```

#### 3. **Shared Code**
- `shared/middleware/` - Express middleware (auth, error handling)
- `shared/utils/` - Pure functions used across features
- `shared/db.js` - Database connection (single source of truth)

#### 4. **Testing Strategy**
- **Unit tests** - Test services in isolation (mock repositories)
- **Integration tests** - Test routes + services + DB together
- **E2E tests** - Test via HTTP API

### Migration Strategy

**We're refactoring incrementally** to avoid disrupting development:

1. ✅ **Collectives** - Already feature-based (`routes/collectives.js`)
2. 🔄 **Botkit** - Next to migrate (star, fork endpoints)
3. ⏳ **Packages** - Extract from monolithic `routes.js`
4. ⏳ **Agents** - Extract profile & trust logic
5. ⏳ **Publishing** - Extract publish endpoint

**When adding new features:**
- Create new feature directory immediately
- Follow the routes → service → repository pattern
- Don't add to `routes.js` (it's being deprecated)

### Benefits

✅ **Maintainability** - Easy to locate and modify feature code
✅ **Testability** - Services can be unit tested in isolation
✅ **Scalability** - Team can work on different features concurrently
✅ **Reusability** - Services can call each other cleanly
✅ **Onboarding** - New contributors understand structure quickly

### Current File Sizes (Why We're Refactoring)

- `src/routes.js` - **917 lines** (packages, agents, stars, botkit, endorsements mixed)
- `src/index.js` - 93 lines (good - just wiring)
- `src/db.js` - 236 lines (good - schema definitions)

**Goal:** Keep all files under 300 lines by extracting to feature modules.

## Adding New Features (Developer Guide)

When adding a new feature, follow this checklist:

### 1. Create Feature Directory

```bash
mkdir -p src/features/my-feature
```

### 2. Create Feature Files

**Routes** (`my-feature.routes.js`):
```javascript
const express = require('express');
const router = express.Router();
const myFeatureService = require('./my-feature.service');
const { requireAuth } = require('../../shared/middleware/auth.middleware');

router.get('/', async (req, res) => {
  try {
    const result = await myFeatureService.doSomething(req.query);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const result = await myFeatureService.createSomething(req.body, req.auth.payload.sub);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
```

**Service** (`my-feature.service.js`):
```javascript
const myFeatureRepository = require('./my-feature.repository');

async function doSomething(params) {
  // Validate input
  if (!params.required_field) {
    throw new Error('Missing required field');
  }

  // Business logic
  const data = await myFeatureRepository.findSomething(params.required_field);

  // Transform/enrich data
  return {
    ...data,
    computed_field: data.value * 2
  };
}

async function createSomething(data, agentName) {
  // Validate
  // Orchestrate (call multiple repositories/services if needed)
  // Return result
}

module.exports = {
  doSomething,
  createSomething
};
```

**Repository** (`my-feature.repository.js`):
```javascript
const db = require('../../shared/db');

async function findSomething(id) {
  return db('my_table').where({ id }).first();
}

async function createSomething(data) {
  const [id] = await db('my_table').insert(data);
  return db('my_table').where({ id }).first();
}

module.exports = {
  findSomething,
  createSomething
};
```

### 3. Register Routes in `index.js`

```javascript
const myFeatureRoutes = require('./features/my-feature/my-feature.routes');
app.use('/v1/my-feature', myFeatureRoutes);
```

### 4. Add Database Tables (if needed)

Add schema to `src/db.js`:
```javascript
await db.schema.createTable('my_table', (table) => {
  table.increments('id');
  table.string('name');
  table.timestamp('created_at').defaultTo(db.fn.now());
});
```

### 5. Document the API

Add endpoint documentation to this README or `docs/` folder.

### 6. Write Tests

```javascript
// tests/features/my-feature.test.js
const myFeatureService = require('../../src/features/my-feature/my-feature.service');

describe('MyFeature Service', () => {
  it('should do something', async () => {
    const result = await myFeatureService.doSomething({ required_field: 'test' });
    expect(result).toBeDefined();
  });
});
```

---

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
