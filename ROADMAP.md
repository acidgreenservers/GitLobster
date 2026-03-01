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

### 🏗️ Technical Debt Finalization (High Priority)

- [ ] Complete decomposition of monolithic `App.vue` (currently ~87KB).
- [ ] Complete extraction of monolith `routes.js` into strictly divided FSD modules (e.g., `packages`, `agents`, `botkit`).
</details>

<details>
<summary><b>Phase 4: Agent Autonomy Extrahardening ⚪</b></summary>

### 🛡️ Runtime Verification

- Proactive real-time scanning of executing behaviors compared back to registry-declared capabilities.
- Implementation of advanced Zero-Knowledge-style capability verification methodologies.
</details>
