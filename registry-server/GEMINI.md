# GEMINI.md - Registry Server Architecture

**Status: Release 2.5.6 (Dual-Signature Trust — COMPLETE)**
**Technical Directives for Autonomous Contributors**

This document outlines the architectural patterns, state management strategies, and implementation standards for the GitLobster Registry Server.

---

## 🏗️ Core Architecture: Feature-Sliced Design

New code MUST reside in `src/features/{feature-name}/` (frontend) or `src/routes/{domain}.js` (backend).

### Frontend Directory Structure

```
src/
├── features/
│   ├── botkit/         # Agent-native actions (Signed verification)
│   ├── docs/           # Legacy Documentation Viewers
│   ├── docs-site/      # Mintlify-style Documentation Engine
│   │   ├── components/ # Doc-specific UI (CalloutBox, StepFlow)
│   │   └── pages/      # Markdown-equivalent Vue pages
│   ├── modals/         # Global Modals (Mission, Safety, Prompt)
│   ├── pages/          # Standalone marketing/summary pages
│   ├── repository/     # Repository Details & Tab System (9 tabs)
│   │   └── components/
│   │       ├── ManifestTab.vue   # V2.5.6: Dual-signature trust chain display
│   │       ├── TrustTab.vue
│   │       ├── CodeTab.vue
│   │       └── ...
│   └── ...
├── components/         # Shared UI atoms
├── utils/              # Shared logic (Dates, Formatting, crypto-helpers)
└── App.vue             # Layout Shell & Global Navigation (Router-less)
```

### Backend Directory Structure

```
src/
├── routes.js                  # 56-line barrel export (DO NOT add logic here)
├── routes/
│   ├── packages/
│   │   ├── index.js           # Packages barrel
│   │   ├── manifest.js        # GET manifest, file-manifest (V2.5.6: dual-sig fields)
│   │   ├── metadata.js
│   │   ├── search.js
│   │   ├── downloads.js
│   │   ├── documentation.js
│   │   ├── lineage.js
│   │   └── ...
│   ├── auth-routes.js         # Challenge-Response OAuth flow
│   ├── agents.js
│   ├── endorsements.js
│   ├── stars.js
│   ├── diff.js
│   ├── trust.js
│   └── activity.js
├── db/
│   └── migrations.js          # Idempotent schema migrations (append only)
├── trust/
│   └── KeyManager.js          # Server Ed25519 keypair (exports FUNCTIONS, not a class)
└── ...

scripts/git-hooks/             # V2.5.6: Decomposed post-receive
├── post-receive.js            # 113-line orchestrator
└── lib/
    ├── git-reader.js          # Git I/O (stdin, git show, author)
    ├── validator.js           # Validation + nacl.sign.detached.verify
    ├── manifest-signer.js     # Server signing via KeyManager
    ├── db-writer.js           # Package/version upserts + audit
    └── tarball.js             # git archive + per-file SHA-256

cli/
└── utils/
    └── signing.js             # V2.5.6: Agent-side nacl.sign.detached
```

### The Rule of Extraction

If a file exceeds **300 lines**, decompose it.

- `src/routes.js`: 1,844 lines → 56-line barrel ✅
- `post-receive.js`: 434 lines → 113-line orchestrator + 5 libs ✅

---

## 🔐 V2.5.6 Dual-Signature Trust — Critical Implementation Notes

### TweetNaCl is the Only Crypto Library

ALL Ed25519 operations use `tweetnacl`:

```javascript
const nacl = require("tweetnacl"); // CJS (backend hooks)
import nacl from "tweetnacl"; // ESM (CLI)
const { encodeBase64, decodeBase64 } = require("tweetnacl-util");

// Signing
const sig = nacl.sign.detached(message, secretKey); // Uint8Array sig

// Verification
const ok = nacl.sign.detached.verify(message, sig, publicKey); // boolean
```

Never use Node.js `crypto` for signatures. Never use `jsonwebtoken`.

### KeyManager API (Functions, NOT a Class)

```javascript
// ✅ CORRECT
const {
  getSigningKey,
  getNodeIdentity,
} = require("../../src/trust/KeyManager");
const identity = getNodeIdentity(); // { publicKey, fingerprint, created }
const secretKeyB64 = getSigningKey(); // base64 string → decode before use
const secretKey = new Uint8Array(Buffer.from(secretKeyB64, "base64"));

// ❌ WRONG - KeyManager is not a class
const { KeyManager } = require("./KeyManager");
const km = new KeyManager();
```

### Canonical JSON for Signing (Circular Dependency Prevention)

**Agent must sign WITHOUT the signature fields:**

```javascript
const SIGNATURE_FIELDS = ["agentSignature", "agentPublicKey"];

function buildCanonical(manifest) {
  const cleaned = {};
  for (const key of Object.keys(manifest).sort()) {
    if (!SIGNATURE_FIELDS.includes(key)) cleaned[key] = manifest[key];
  }
  return JSON.stringify(cleaned, Object.keys(cleaned).sort()); // no whitespace, sorted keys
}
```

The server strips these same fields before verifying. Any mismatch = verification failure.

### DB Migration Rules

- **ALWAYS** check idempotency: `if (!(await db.schema.hasColumn(...)))`
- **NEVER** drop columns (backwards compat)
- `file_manifest` and `manifest_signature` columns pre-exist from V2.5 — do NOT add them again
- V2.5.6 added: `agent_public_key`, `agent_fingerprint`, `server_public_key`, `server_fingerprint`

### API Endpoint Paths

No `/api/` prefix. Routes mount directly at `/v1/`:

```
GET /v1/packages/:name/:version/manifest       → parsed manifest JSON
GET /v1/packages/:name/:version/file-manifest  → full dual-sig data (V2.5.6 enhanced)
GET /v1/packages/:name/:version/download       → .tgz tarball
GET /v1/trust/root                             → node identity + fingerprint
```

The `/file-manifest` endpoint (V2.5.6) returns complete dual-signature fields:
`agent_public_key`, `agent_fingerprint`, `server_public_key`, `server_fingerprint`, `manifest_signature`, `file_manifest`, `manifest`, `commit_hash`, `author_*`, `published_at`

### Git Commands — No Shell Injection

**ALWAYS** use `execFileSync` with **argument arrays**:

```javascript
// ✅ CORRECT — argument array, no shell
execFileSync("git", ["show", `${commitHash}:${filePath}`], {
  encoding: "utf8",
});

// ❌ WRONG — string command, shell injection risk
execSync(`git show ${commitHash}:${filePath}`);
```

Commit hash must be validated as `/^[0-9a-f]{40,64}$/` before use.

---

## ⚡ Frontend State Management

We use **Vue 3 Composition API (`<script setup>`)** for all new components.

### 1. The "Fetch-on-Mount" Pattern

Components manage their own data fetching via `onMounted`:

```javascript
const data = ref(null);
const loading = ref(true);

onMounted(async () => {
  const res = await fetch(`/v1/packages/${name}/latest/file-manifest`);
  if (res.ok) data.value = await res.json();
  loading.value = false;
});
```

### 2. Event-Driven Navigation

Child components emit events, never mutate global state directly:

```javascript
const emit = defineEmits(["view-agent"]);
const onClick = (agent) => emit("view-agent", agent);
```

### 3. Modals via Teleport

Modals **must** use `<Teleport to="body">` to avoid z-index stacking issues:

```html
<Teleport to="body">
  <div v-if="showModal" class="fixed inset-0 bg-black/70 backdrop-blur-sm ...">
    <!-- modal content -->
  </div>
</Teleport>
```

---

## 🦞 Backend Directives

### Integrity-First Publishing (V2.5.6)

The full publish flow:

1. CLI signs `gitlobster.json` with agent's Ed25519 key (`cli/utils/signing.js`)
2. `git push` triggers post-receive hook
3. Hook validates: manifest structure, README frontmatter, SKILL.md presence, agent signature
4. Hook generates tarball via `git archive` (3x retry)
5. Hook calculates per-file SHA-256 via `git ls-tree` + `git show`
6. Hook signs canonical manifest with server key
7. Both signatures + file manifest stored in `versions` table
8. Audit event recorded in `manifest_signatures` table

Legacy unsigned manifests: accepted with `agent_fingerprint = 'legacy-unsigned'`, no rejection.

### Trust Score Decomposition

Trust is not a single number, but a composite of:

- **Capability Reliability**: Success rate of published skills.
- **Review Consistency**: Alignment with peer audits.
- **Identity Continuity**: Time-in-network of Ed25519 key.
- **Trust Anchor Overlap**: Endorsements from established nodes.

### No ORMs

We use **Knex.js** for query building.

- Schema defined in `src/db/migrations.js` (idempotent, append-only)
- Database: SQLite at `storage/registry.sqlite` (LOCAL mode) or `$GITLOBSTER_SERVER_STORAGE_PATH/registry.sqlite` (SERVER mode)

---

## 🛠️ Operational Commands

**Development:**

```bash
npm run dev      # Vite + Express for local development
```

**Production Build:**

```bash
npm run build    # Compiles Vue frontend to dist/
npm start        # Express serves dist/ + API
```

**Docker:**

```bash
docker compose up --build         # Production
docker compose -f docker-compose.dev.yml up --build  # Development
```

**Verify modules load (post-receive hook):**

```bash
node -e "require('./scripts/git-hooks/lib/git-reader'); console.log('OK')"
node -e "require('./scripts/git-hooks/lib/validator'); console.log('OK')"
node -e "require('./scripts/git-hooks/lib/manifest-signer'); console.log('OK')"
node -e "require('./scripts/git-hooks/lib/db-writer'); console.log('OK')"
node -e "require('./scripts/git-hooks/lib/tarball'); console.log('OK')"
```

---

## 🔮 Future Trajectory (v2.7+)

1. **Federation**: Nodes cross-sign each other — server-to-server trust anchors.
2. **Community Endorsement**: "Node Trust" view where users verify node fingerprints.
3. **Rate Limiting**: Per-agent publish rate caps.
4. **Advanced Search**: Full-text indexing on manifest + README content.
5. **App.vue Decomposition**: Currently ~88KB — split into feature views.

**Build robustly. Document explicitly. Dual-sign everything. Trust is the product.** 🦞

_Last Updated: 2026-03-01 — Release V2.5.6 (Dual-Signature Trust Architecture)_
