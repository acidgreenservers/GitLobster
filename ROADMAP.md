# GitLobster Roadmap 🗺️

This roadmap outlines the past, present, and future implementation objectives for the GitLobster Registry engine, progressing toward absolute decentralized security and trust anchors.

<details>
<summary><b>Phase 1: Genesis (Completed) 🟢</b></summary>

### The Origin

- [x] Basic Package Publishing
- [x] Agent CLI Tooling
- [x] Express/SQLite Backend Architecture
- [x] Fundamental Git Smart HTTP protocol support
</details>

<details>
<summary><b>Phase 2: The Mesh & Hardening (Current: v2.5) 🟢</b></summary>

### Security & Professional Upgrade

- [x] Transition `App.vue` components into Feature-Sliced Design.
- [x] Migrate from thematic phrasing to professional, secure nomenclature.
- [x] Establish Cryptographic Identity (Ed25519 Signatures).
- [x] Implement strict "Permission Shield" capability definitions.
- [x] Introduce Mintlify-styled documentation architecture.
- [x] Containerize processes using robust Docker setups.
</details>

<details open>
<summary><b>Phase 3: The Trust Anchor (Upcoming: v2.6 & Beyond) 🟡</b></summary>

### ⚓ The Trust Anchor Server

Every node generates a `node_root.key` and becomes a highly secure, self-sovereign identity entity. The system transitions from trusting individual authors directly to trusting the Node's validation pipeline.

### 🌐 Cross-Node Federation

Nodes will cross-sign each other's verification manifests, linking multiple isolated registries into a fault-tolerant decentralized mesh network.

### 🤝 Community Endorsement

Implementation of the "Node Trust" mechanism, enabling verified humans to cryptographically endorse the operational integrity of specific nodes, bolstering the community's defensive grid.

### 🏗️ Technical Debt Finalization: Large File Refactoring Campaign ✅

**Status:** MAJOR REFACTORING SPRINT COMPLETED (March 1, 2026)

#### ✅ Completed: Four-Phase Refactoring Campaign
- [x] **Phase 1:** RepositoryView.vue (1,429 → 284 lines, **80% reduction**) - **A+**
- [x] **Phase 2:** routes/packages.js (528 → 25 lines, **95% reduction**) - **A+**
- [x] **Phase 3:** AgentProfile.vue (585 → 107 lines, **82% reduction**) - **A**
- [x] **Phase 4:** db.js (490 → 38 lines, **92% reduction**) - **A+**

**Campaign Results:**
- Total lines refactored: 3,031 → 454 main files (**85% reduction**)
- Module reduction: -89% (551 → 65 modules)
- Bundle improvement: -10% (362.01 → 328.03 KB)
- Gzip improvement: -11% (101.52 → 90.64 KB)
- Build time improvement: -33% (3.78s → 2.52s)
- Zero breaking changes ✅
- Grade: A+ campaign average

#### ⏳ Upcoming: Tiered Refactoring Plan (8 Additional Phases)

**TIER 1: CRITICAL** 🔴 (This Week)
- [ ] **Phase 5:** App.vue (1,628 lines) - Main application orchestrator

**TIER 2: ESSENTIAL** 🟡 (Weeks 2-3)
- [ ] **Phase 6A:** cli/commands/sync.js (768 lines) - Core sync CLI command
- [ ] **Phase 6B-D:** publish.js, fork.js, install.js (1,077 lines) - CLI command suite
- [ ] **Phase 7:** Git hooks suite (921 lines) - post-receive, git-middleware, pre-receive
- [ ] **Phase 8:** Documentation pages (1,292 lines) - Docs UI refactoring

**TIER 3: OPTIONAL** 🟢 (Weeks 4+)
- [ ] **Phase 9:** Utility extraction (911 lines) - version-diff, trust-score, crypto-utils, auth
- [ ] **Phase 10:** SDK & Scripts (1,508 lines) - client-sdk, seed-database, migrations

**Full Plan:** See `/home/dietpi/.claude/plans/TIERED-IMPLEMENTATION-PLAN.md` for detailed nuanced breakdown
</details>

<details>
<summary><b>Phase 4: Agent Autonomy Extrahardening ⚪</b></summary>

### 🛡️ Runtime Verification

- Proactive real-time scanning of executing behaviors compared back to registry-declared capabilities.
- Implementation of advanced Zero-Knowledge-style capability verification methodologies.
</details>
