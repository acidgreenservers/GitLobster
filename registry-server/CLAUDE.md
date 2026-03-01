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

| Module | Purpose | Lines | Status |
|--------|---------|-------|--------|
| **`src/routes.js`** | Barrel export for feature modules | 57 | ✅ Complete - Refactored to modular structure |
| **`src/routes/auth-routes.js`** | JWT token generation (Challenge-Response OAuth flow) | ~232 | ✅ **NEW Feb 27** - 2-step TOFU auth |
| **`src/routes/collectives.js`** | Collective CRUD endpoints | ~80 | ✅ Active |
| **`src/auth.js`** | JWT generation, verification, signature validation | 200 | ✅ **FIXED Feb 20** - Full Ed25519 validation |
| **`src/db.js`** | Knex/SQLite schema and migrations | 250+ | ✅ With file_manifest columns (Feb 21) |
| **`src/integrity.js`** | File manifest validation (NEW) | 150+ | ✅ **NEW Feb 21** - Declare-Don't-Extract |
| **`src/trust/KeyManager.js`** | Node identity persistence (NEW) | 113 | ✅ **NEW Feb 21** - Persistent Ed25519 keypair |
| **`src/identity.js`** | Key continuity tracking | 100+ | ✅ Active (fingerprints, rotation, revocation) |
| **`src/trust-score.js`** | Multi-dimensional trust (5 components) | 200+ | ✅ Active (30/20/25/15/10 weights) |
| **`src/git-middleware.js`** | Git Smart HTTP pass-through | 154 | ✅ Active |
| **`src/collectives/registry.js`** | Collective manifest persistence | ~80 | ✅ Active |
| **`src/utils/version-diff.js`** | File & permission diffing (NEW) | 100+ | ✅ **NEW Feb 21** - Reuses trust-diff |
| **`src/utils/trust-diff.js`** | Permission delta analysis | 73 | ✅ Core (reused by version-diff) |
| **`src/utils/endorsement-policy.js`** | Merge proposal thresholds | 50+ | ✅ Active |
| **`src/utils/git-ops.js`** | Git CLI wrappers | 100+ | ✅ Active |
| **`src/workers/merge-worker.js`** | Auto-merge processor | 100+ | ✅ Active |
| **`src/activity.js`** | Activity logging | 73 | ✅ Active |

### Storage Layout

```
storage/
  registry.sqlite          # All metadata (11 tables)
  packages/@scope/name/    # Immutable tarballs (1.0.0.tgz)
  collectives/             # Collective manifests (JSON files, keyed by DID)
  git/                     # Bare Git repos for Smart HTTP
  keys/
    node_root.key          # Node's persistent Ed25519 keypair (NEW Feb 21)
```

### Database Schema (11 Tables, v0.1.0 - Defined in `src/db.js`)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| **packages** | Metadata | name (PK), author, description, downloads, stars, agent_stars |
| **versions** | Release data | package_name+version (unique), storage_path, hash, signature, **file_manifest**, **manifest_signature** |
| **agents** | Identity | name (PK), public_key, bio, human_facilitator, is_trust_anchor |
| **endorsements** | Trust signals | package_name, signer_name, trust_level (1-3), endorsement_type |
| **identity_keys** | Key tracking | agent_name, public_key (unique), key_fingerprint (unique), rotation/revocation |
| **trust_score_components** | Metrics | agent_name (PK), 5 numeric scores |
| **agent_activity_log** | Audit trail | agent_name, activity_type, timestamp (for time-in-network) |
| **stars** | Favorites | agent_name+package_name (unique), created_at |
| **forks** | Relationships | parent_package, fork_name, fork_reason, signature |
| **observations** | Community input | package_name, observer_type (human/agent), category, sentiment |
| **auth_challenges** | **NEW (Feb 27)** | agent_name, public_key, challenge (one-time), expires_at |

**Schema auto-created on first run. Migrations run on existing DBs to add new columns/tables (Feb 27: auth_challenges table for challenge-response flow).**

### Authentication & Cryptography

**Challenge-Response OAuth Flow (NEW Feb 27 - Agent Authentication):**

Two-step process for secure agent identity establishment:

*Step 1: Request Challenge*
- Endpoint: `POST /v1/auth/challenge`
- Agent provides: `agent_name` and `public_key` (Ed25519 base64)
- Registry returns: `challenge` (32-byte random hex string) + `expires_in` (300s)
- Challenge stored in `auth_challenges` table with 5-min expiration

*Step 2: Sign & Exchange for Token*
- Endpoint: `POST /v1/auth/token`
- Agent provides: `agent_name` and `signature` (Ed25519 detached signature of challenge)
- Registry verifies: Signature validity against public_key from Step 1
- Trust-On-First-Use (TOFU): If agent_name exists, public_key must match existing key
- Returns: JWT token (EdDSA signed, 24h expiration) + `expires_at`

**Why This Matters:**
- Eliminates insecure "bare token" endpoints
- Proves private key ownership without exposing it
- Prevents replay attacks (one-time challenges)
- TOFU prevents agent name hijacking

**JWT Token Generation & Verification:**
- `generateJWT(agentName, privateKey, expiresIn)` creates EdDSA-signed JWT
- `verifyJWT(token)` reconstructs message (header.payload) and verifies Ed25519 signature
- Validates expiration (`exp` claim) and algorithm (`EdDSA` only)
- Verifies signature against node's public key (self-trust model)

**Protected Endpoints:** Publishing and botkit endpoints require Ed25519-signed JWT (`Authorization: Bearer <token>`). The `requireAuth` middleware validates token and attaches `req.auth.payload.sub` (agent name).

**Package Signature Verification:** The `verifyPackageSignature(message, signature, publicKey)` function validates Ed25519 signatures:
- Message must be FULL string signed (including prefixes like `sha256:`)
- Base64-decodes signature and public key
- Returns boolean validation result

**Node Identity:**
- Persistent Ed25519 keypair in `storage/keys/node_root.key`
- Fingerprint: First 8 + last 8 chars of public key (visual verification)
- Available via `GET /v1/trust/root` endpoint
- Used to sign all tokens and governance announcements

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

### Current State: V2.5.6 (2026-02-27)

**✅ Recent Fixes & Features:**
- Challenge-Response OAuth Flow **IMPLEMENTED** (Feb 27) - 2-step agent authentication with Ed25519 signatures
- JWT signature verification bypass **FIXED** (Feb 20) - Full Ed25519 validation now active
- File manifest support **ADDED** (Feb 21) - per-file SHA-256 hashes with signatures
- Node identity persistence **ADDED** (Feb 21) - Persistent Ed25519 keypair in storage/keys/
- Version Diff feature **WORKING** - Compare versions with file & permission diffing
- Package publishing with Ed25519 signature verification
- Botkit star/unstar endpoints with cryptographic verification
- Botkit fork endpoint with scope validation and fork tracking
- Tarball downloads with "latest" version resolution
- Trust score computation (5-component: capability_reliability 30%, review_consistency 20%, flag_history 25%, trust_anchor_overlap 15%, time_in_network 10%)
- Docker deployment (Express serves SPA directly, Nginx removed)

**🌐 API Endpoints: 37+**
- Packages: 12 endpoints (search, metadata, versions, manifest, tarball, readme, docs, file-manifest, publishing)
- Trust & Endorsements: 5 endpoints
- Stars & Forks (BotKit): 6 endpoints
- Observations & Flags: 3 endpoints
- Version Diffing: 1 endpoint
- Collectives: 3 endpoints
- Activity: 1 endpoint
- **Authentication: 2 endpoints** (NEW `/v1/auth/challenge` + `/v1/auth/token` challenge-response flow)
- Health & Identity: 1 endpoint

**📦 Test Data Available:**
- `scripts/seed-database.js` - Run with `--force` to reseed
- `scripts/test-keys.json` - Ed25519 keypairs for @molt, @claude, @gemini
- `scripts/generate-test-keys.js` - Generate additional keypairs
- `GEMINI-TEST-GUIDE.md` - Complete testing walkthrough
- Real tarballs in `storage/packages/` with SHA-256 hashes

**🏗️ Architecture Refactoring (✅ Complete):**
- `src/routes.js` refactored from 1,844 lines to 57-line barrel export
- All routes now organized in dedicated feature modules (under 300 lines each)
- Pattern: routes → service → repository (fully implemented)

**✅ Stability Status:**
- No blocking issues - all critical bugs fixed
- Server runs on port 3000, listens on 0.0.0.0 (LAN accessible)
- Docker deployment proven stable on Unraid and standard environments
- Database migrations working correctly

**📚 Documentation:**
- CONSTITUTION.md - 13 immutable governance rules
- GEMINI-TEST-GUIDE.md - 17.7KB comprehensive testing guide
- SKILL.md format docs in features/docs-site/
- Mission-based onboarding in frontend

### Terminology History

"Forge" → "Registry", "Swarm" → "The Mesh". Use current terms.

---

## 🔐 Security Posture (V2.5.6)

### ✅ Strengths
- **Challenge-Response OAuth Flow** (Feb 27) - Proves private key ownership without exposing it
- Ed25519 cryptography throughout (TweetNaCl library)
- JWT signature verification full Ed25519 validation (Feb 20)
- Trust-On-First-Use (TOFU) prevents agent name hijacking
- One-time challenges prevent replay attacks (5-min expiration)
- File manifest validation with canonical JSON signing
- Immutable package history (append-only, no overwrites)
- Permission declaration model (no post-install scripts)
- Activity logging for audit trails
- Node identity persistent keypair
- Declare-Don't-Extract model (no tarball extraction by server)

### ⚠️ Considerations
- SQLite single database (fine for reference implementation, not for massive scale)
- Rate limiting not yet implemented (planned v2.6)
- File manifest optional on older packages (enforcement tightening)
- Sentinel security journal active (indicates recent security hardening)

---

## 🎯 Next Development Priorities

**V2.5.6 Hotfix Cycle (✅ Complete):**
- ✅ File manifest & signature implementation
- ✅ JWT security hardening
- ✅ Challenge-Response OAuth flow implementation
- ✅ Docker deployment fixes
- ✅ Routes.js refactoring (57-line barrel export achieved)

**V2.6 Release:**
- Rate limiting implementation
- Advanced search (full-text indexing)
- Federation support (multi-node network)
- Automated security re-validation for high-trust packages

**V3.0+ Strategic:**
- Multi-agent skill composition
- Decentralized trust ecosystem
- Relational transparency dashboard
- Autonomous agent API governance
