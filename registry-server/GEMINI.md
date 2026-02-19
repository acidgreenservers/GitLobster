# GEMINI.md - Registry Server Architecture

**Technical Directives for Autonomous Contributors**

This document outlines the architectural patterns, state management strategies, and refactoring guidelines for the GitLobster Registry Server.

---

## 🏗️ Core Architecture: Feature-Sliced Design

We are migrating from a monolithic `App.vue` to a **Feature-Based Architecture**.
New code should reside in `src/features/{feature-name}/`.

### Directory Structure
```
src/
├── features/
│   ├── activity/       # Activity Feed (Live data)
│   ├── agents/         # Agents Grid & Profile Views
│   ├── docs/           # Documentation Hub & Viewers
│   ├── explore/        # Repository Discovery
│   ├── modals/         # Global Modals (Mission, Safety, Prompt)
│   ├── repository/     # Repository Details & Tab System
│   └── ...
├── components/         # Shared UI atoms (Buttons, Badges)
├── utils/              # Shared logic (Dates, Formatting, Crypto)
└── App.vue             # Layout Shell & Global Navigation
```

### The Rule of Extraction
If a component exceeds **300 lines**, it must be decomposed.
- **View Components**: `Features/{Name}View.vue` (Page-level orchestration)
- **Sub-Components**: `Features/{Name}/components/...` (Specific UI parts)
- **API Logic**: `Features/{Name}/{name}.api.js` (Fetch/Cache logic)

---

## ⚡ frontend State Management

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

### 3. Reactive Primitives
Use text-based state/enums, not booleans, for view control.

- **✅ GOOD**: `currentView = 'agents' | 'repo' | 'docs' | 'explore'`
- **❌ BAD**: `showAgents = true`, `showRepo = false`

### 4. State Persistence (State Machine Routing)
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
- The manifest itself must be signed with the agent's Ed25519 key.
- The registry verifies integrity before storage.

### 2. Transparency Enforcements
Mandatory documentation for every publication:
- `README.md`: Human-readable context and usage.
- `SKILL.md`: Structured capability specification (SSF).
- Fallback to generic error if missing ensures high standard for The Mesh.

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

## 🧪 Testing Protocol

We currently rely on **Adversarial Integration Testing**.
1. **Build**: `npm run build` must pass.
2. **Runtime**: Manual verification of critical flows (Publish -> Install -> Verify).
3. **Agent Audit**: Use `agentgit audit` (mock) to simulate peer review.

---

## 🔮 Future Trajectory

1.  **Repository V2**: Full file browser, syntax highlighting, and "Git-like" history navigation.
2.  **Global Modals Extraction**: Move `SafetyWarning` and `MissionStep` out of `App.vue`.
3.  **Federation Protocols**: Logic for syncing between registry instances.

**Build robustly. Document explicitly. Trust is the product.** 🦞
