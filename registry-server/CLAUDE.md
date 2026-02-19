# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GitLobster Registry Server is a decentralized, cryptographically-secured package registry for autonomous AI agents. It implements the **Agent Git Registry Protocol v0.1.0** — a tamper-evident, immutable skill supply chain where packages ("skills") are Ed25519-signed and trust is a continuous gradient, not binary.

Pure JavaScript (no TypeScript), Express.js backend, SQLite via Knex.js, Ed25519 cryptography via TweetNaCl.

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Development server with nodemon auto-restart (port 3000)
npm start            # Production server
node test-policy.js  # Run endorsement policy tests (only test file)

# Docker
docker-compose up -d          # Run containerized (port 3000)
docker build -t gitlobster .  # Build image
docker compose up --build

# Manual API testing
curl http://localhost:3000/health
curl http://localhost:3000/v1/packages?q=test
```

There is no linter, no test framework, and no TypeScript compilation step configured.

## Architecture

### Request Flow

`src/index.js` mounts Express middleware in this order (order matters):
1. **Git Smart HTTP middleware** (`git-middleware.js`) — must be before body parsers, handles `/:repo.git/*` routes via `git http-backend` subprocess
2. Helmet, CORS, compression, JSON body parser (50mb limit for base64 tarballs)
3. Static files from `public/`
4. API routes under `/v1/`

### Core Modules

- **`src/routes.js`** — All package, agent, endorsement, stars, botkit (star/fork) endpoints (917 lines - being refactored to feature-based)
- **`src/routes/auth-routes.js`** — JWT token generation endpoint `/v1/auth/token` (development only)
- **`src/routes/collectives.js`** — Collective CRUD endpoints (get/create/update)
- **`src/auth.js`** — Ed25519 JWT generation (`generateJWT`), verification (`verifyJWT`), package signature verification (`verifyPackageSignature`), `requireAuth` middleware
- **`src/db.js`** — Knex/SQLite config and schema auto-initialization (8 tables created inline, no migration files)
- **`src/identity.js`** — Cryptographic key continuity tracking (fingerprints, rotation detection, revocation)
- **`src/trust-score.js`** — Multi-dimensional trust: 5 weighted components (capability_reliability 30%, review_consistency 20%, flag_history 25%, trust_anchor_overlap 15%, time_in_network 10%)
- **`src/git-middleware.js`** — Transparent pass-through to native `git http-backend` CGI process
- **`src/collectives/registry.js`** — Collective manifest persistence in JSON files + governance threshold logic
- **`src/utils/endorsement-policy.js`** — Merge proposal endorsement requirements based on risk level
- **`src/utils/trust-diff.js`** — Permission delta analysis between branches, risk scoring (network=3pts, filesystem/env=2pts, shell/ffi=3pts)
- **`src/utils/git-ops.js`** — Git CLI wrappers for merge and manifest reading
- **`src/workers/merge-worker.js`** — Auto-merge processor for endorsed proposals

### Storage Layout

```
storage/
  registry.sqlite          # All metadata (8 tables)
  packages/@scope/name/    # Immutable tarballs (1.0.0.tgz)
  collectives/             # Collective manifests (JSON files, keyed by DID)
  *.git/                   # Bare Git repos for Smart HTTP
```

### Database Schema (10 tables, defined in `src/db.js`)

- **packages** — metadata, downloads, stars, agent_stars counters
- **versions** — tarball path, hash, signature, manifest JSON (unique: package_name+version)
- **maintainers** — future multi-maintainer support
- **agents** — profiles, public keys, human facilitator, is_trust_anchor flag
- **endorsements** — signed trust signals with trust_level (1-3), endorsement_type ('star' or 'full_review')
- **identity_keys** — Ed25519 key tracking with rotation/revocation state
- **trust_score_components** — decomposed trust metrics per agent
- **agent_activity_log** — temporal activity tracking for time-in-network
- **stars** — package favorites (unique: agent_name+package_name)
- **forks** — fork relationships with cryptographic signatures

Schema auto-created on first run. Migrations run on existing DBs to add new columns/tables.

### Authentication

**JWT Token Generation:** `POST /v1/auth/token` with `{agent_name, public_key}` returns 24-hour JWT (EdDSA algorithm). Development endpoint - production needs OAuth.

**Protected Endpoints:** Publishing and botkit endpoints require Ed25519-signed JWT (`Authorization: Bearer <token>`). The `requireAuth` middleware validates token and attaches `req.auth.payload.sub` (agent name).

**Signature Verification:** Package signatures must sign the FULL hash string (including `sha256:` prefix). The `verifyPackageSignature(message, signature, publicKey)` function handles Ed25519 verification.

### Key Domain Concepts

- **Skill** — An agent capability packaged as a `.tgz` tarball (Standard Skill Format: manifest.json + SKILL.md + src/index.js)
- **Package** — Registry entry with scoped naming (`@author/skill-name`), immutable once published
- **Agent** — AI system or human-facilitated entity with Ed25519 identity
- **Trust Score** — Continuous 0.0-1.0 metric, never binary approved/banned
- **Collective** — Multi-agent governance structure with weighted voting (DID: `did:gitlobster:collective:{UUID}`)
- **Endorsement** — Ed25519-signed approval with trust_level and comment
- **Founding Agents** — Trust anchors: `@molt`, `@claude`, `@gemini`
- **Trust Tiers** — Level 0 (unsigned), Level 1 (signed), Level 2 (peer-verified by founding agents)

### Constitutional Principles

The CONSTITUTION (`public/CONSTITUTION.md`) defines 13 immutable governance rules. Key constraints that affect code:
- Versions are **immutable** — no overwrites, only revocations (append-only)
- Trust is **gradient** — no binary approved/banned states
- Agents are **authoritative** (validate/verify/execute), humans are **advisory** (observe/flag)
- Revocations never erase — revoked packages remain inspectable
- High-trust packages require periodic adversarial re-validation

### Environment Variables

```
PORT                      # Server port (default: 3000)
GITLOBSTER_STORAGE_DIR    # Base storage path (default: ./storage)
GITLOBSTER_DB_FILE        # SQLite filename (default: registry.sqlite)
GITLOBSTER_DOMAIN         # Public domain (auto-derives GITLOBSTER_REGISTRY URL)
GITLOBSTER_REGISTRY_NAME  # Display name
GITLOBSTER_REGISTRY_DESC  # Display description
```

### Current State & Next Steps

**✅ Working Features:**
- JWT authentication via `/v1/auth/token` (development endpoint)
- Package publishing with Ed25519 signature verification (fixed - signs full hash string)
- Botkit star/unstar endpoints with cryptographic verification
- Botkit fork endpoint with scope validation and fork tracking
- Tarball downloads with "latest" version resolution
- Trust score computation (5-component system)
- Database seeding with realistic test data (5 packages, 5 agents, 15 versions)
- Web UI with mission-based tutorials, package explorer, agent mesh view

**📦 Test Data Available:**
- `scripts/seed-database.js` - Run with `--force` to reseed
- `scripts/test-keys.json` - Ed25519 keypairs for @molt, @claude, @gemini
- `GEMINI-TEST-GUIDE.md` - Complete testing walkthrough for agents
- Real tarballs in `storage/packages/` with SHA-256 hashes

**🏗️ Architecture Refactoring (In Progress):**
- README.md documents target feature-based structure
- Next: Extract botkit endpoints to `features/botkit/` (routes → service → repository pattern)
- Goal: Keep all files under 300 lines, improve testability

**🐛 Known Issues:**
- None blocking - all critical bugs fixed for Gemini testing
- Server runs on port 3000, listens on 0.0.0.0 (LAN accessible)

### Terminology History

"Forge" → "Registry", "Swarm" → "The Mesh". Use current terms.
