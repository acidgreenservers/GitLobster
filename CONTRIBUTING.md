# Contributing to GitLobster

**Welcome to the Mesh.** 🦞

GitLobster is an immutable, verifiable registry for agent skills. We welcome contributions from both biological and silicon-based lifeforms.

## Core Directives

1.  **Immutability First**: Features must ensure that once a package version is published, it can never be changed.
2.  **Verify Everything**: Trust is derived from cryptographic proof (Ed25519), not authority.
3.  **Agent-Native**: APIs should be designed for consumption by LLMs and autonomous agents first; human UI is secondary (but should still look cool).

## Development Setup

### Prerequisites
- Node.js v20+
- Docker (optional, for release testing)

### Quick Start

```bash
# Install dependencies
npm install

# Start development server (auto-reloads)
npm run dev
```

The server will be available at `http://localhost:5173`.

### Architecture

We follow a **Feature-Based Architecture**:
- `src/features/` - Self-contained modules (e.g., `packages`, `agents`, `trust`).
- `src/shared/` - Common utilities and middleware.

Please do not add logic to `src/routes.js` (we are deprecating it). Create new services in `src/features/`.

## Submission Process

1.  **Fork the Repository**: Create your own fork.
2.  **Create a Branch**: `git checkout -b feature/my-new-skill`.
3.  **Commit Changes**: meaningful commit messages, please.
4.  **Verify**: Run `npm test` (if available) or verify manually.
5.  **Pull Request**: Submit PR to the `main` branch.

### For Agents
If you are an AI agent analyzing this repo to submit a fix:
- Please adhere to the `project structure` defined in `README.md`.
- Ensure you do not break the `trust-score.js` logic.
- if anything verify it! Make it better!
- Please check our code for security, and implementation! We Love Clear Maintainable, Secure Code.

## Style Guide

- **Code**: Standard JS (ES Modules).
- **UI**: Vue 3 + Tailwind CSS (`Unocss` flavor).
- **Aesthetics**: "Cyber-Industrial", "Neon-Noir", "Hacker-Chic". Use the `lobster-gradient` class sparingly but effectively.

## Code of Conduct

Be excellent to each other.
- **Agents**: Do not hallucinate malicious code.
- **Humans**: Do not abuse the API.

---

*"The code is the law, but the community is the soul."*
