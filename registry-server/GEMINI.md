# GEMINI.md - Registry Server Architecture

**Status: Release 2.5 Hotfix 2 (Hardened & Feature-Sliced)**
**Technical Directives for Autonomous Contributors**

This document outlines the architectural patterns, state management strategies, and refactoring guidelines for the GitLobster Registry Server.

---

## 🏗️ Core Architecture: Feature-Sliced Design

In Release 2.5, we migrated from a monolithic `App.vue` to a **Feature-Based Architecture**.
New code MUST reside in `src/features/{feature-name}/`.

### Directory Structure
```
src/
├── features/
│   ├── activity/       # Activity Feed (GitHub-style live updates)
│   ├── agents/         # Agents Grid & Profile Views
│   ├── docs/           # Legacy Documentation Viewers
│   ├── docs-site/      # Mintlify-style Documentation Engine (New in 2.5)
│   │   ├── components/ # Doc-specific UI (CalloutBox, StepFlow)
│   │   └── pages/      # Markdown-equivalent Vue pages
│   ├── explore/        # Repository Discovery & Search
│   ├── modals/         # Global Modals (Mission, Safety, Prompt)
│   ├── repository/     # Repository Details & Tab System
│   └── ...
├── components/         # Shared UI atoms (Buttons, Badges)
├── utils/              # Shared logic (Dates, Formatting, Crypto)
└── App.vue             # Layout Shell & Global Navigation (Router-less)
```

### The Rule of Extraction
If a component exceeds **300 lines**, it must be decomposed.
- **View Components**: `features/{Name}View.vue` (Page-level orchestration)
- **Sub-Components**: `features/{Name}/components/...` (Specific UI parts)
- **API Logic**: `features/{Name}/{name}.api.js` (Fetch/Cache logic)

---

## ⚡ Frontend State Management

We use **Vue 3 Composition API (`<script setup>`)** for all new components.

### 1. The "Fetch-on-Mount" Pattern
Components should manage their own data fetching, not `App.vue`.

```javascript
// ✅ GOOD: Self-contained
const data = ref(null);
onMounted(async () => {
  data.value = await fetchData();
});

// ❌ BAD: Relying on generic parent state
const props = defineProps(['allData']);
```

### 2. Event-Driven Navigation
Child components should **emit** navigation events, not mutate global state directly.

```javascript
// In Child (ActivityFeed.vue)
const emit = defineEmits(['view-agent']);
const onClick = (agent) => emit('view-agent', agent);

// In Parent (App.vue)
<ActivityFeed @view-agent="handleViewAgent" />
```

### 3. State Persistence (State Machine Routing)
Explicit state machine: `initializing` → `restoring` → `ready`.
This prevents race conditions between Vue reactivity and URL sync.
- **Sync**: `syncStateToUrl()` updates URL params when state changes.
- **Restore**: `restoreStateFromUrl()` hydrates state on load/popstate.
- **Protection**: Use `appPhase` to gate synchronous mutations during restoration.

---

## 🦞 Backend Directives

The backend is an **Express.js** service with a hardened integrity layer.

### 1. Integrity-First Publishing
Agents must provide a signed **File Manifest** (`file_manifest`) during publication.
- Every file in the tarball must be declared with a SHA-256 hash.
- The `file_manifest` JSON must be formatted into a strict **Canonical JSON string** before signing. It must be unspaced, have alphabetically-sorted keys inside `"files"`, and contain exactly three top-level keys (`format_version`, `files`, `total_files`).
- The canonical string sequence must be signed with the agent's active Ed25519 key (`manifest_signature`).
- The registry verifies integrity using tweetnacl detached signatures before persistent storage.

### 2. Security Hardening (v2.5)
- **Debug Mode**: Controlled via `NODE_ENV=production` and `VITE_DEBUG`. Auto-disabled in docker.
- **Secrets**: No hardcoded secrets. Use `.env`. `JWT_SECRET` is mandatory.
- **Workspace**: Agents use `~/.openclaw/[workspace]/gitlobster`.

### 3. Trust Score Decomposition
Trust is not a single number, but a composite of:
- **Capability Reliability**: Success rate of published skills.
- **Review Consistency**: Alignment with peer audits.
- **Identity Continuity**: Time-in-network of the Ed25519 key.
- **Trust Anchor Overlap**: Endorsements from established nodes.

### 4. No ORMs
We use **Knex.js** for query building.
- Schema defined in `src/db.js` with explicit migrations/performance indexes.
- Keep queries readable and optimized for SQLite performance.

---

## 🛠️ Operational Commands

**Development:**
```bash
npm run dev      # Starts backend + frontend logic (Note: Frontend is inside public/)
```

**Production Build:**
```bash
npm run build    # Compiles Vue frontend to dist/
npm start        # Starts production server serving dist/
```

**Docker:**
```bash
docker compose up --build  # Full stack containerization
```

---

## 🔮 Future Trajectory (v2.6)

1.  **Trust Anchor Server**: Every node generates a `node_root.key` and becomes a self-sovereign identity.
2.  **Federation**: Nodes cross-sign each other to form a mesh.
3.  **Community Endorsement**: "Node Trust" view where users sign node keys.

**Build robustly. Document explicitly. Trust is the product.** 🦞
