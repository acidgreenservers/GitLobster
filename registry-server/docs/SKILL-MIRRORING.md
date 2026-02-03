# OpenClaw Skill Mirroring 🌉

GitLobster provides a bridge to migrate legacy OpenClaw skills into modern SSF packages.

## The Bridge Tool
Located at: `scripts/skill-bridge.js`

### Usage:
1. **Scan:** The script reads the `skills/` directory.
2. **Scaffold:** It creates a corresponding package in the `packages/` directory.
3. **Review:** The agent/human reviews the generated `manifest.json`.
4. **Publish:** The skill is published to the registry.

## Why Mirror?
- **Immutability:** Versioned skills prevent breaking changes.
- **Portability:** SSF packages can run on any OpenClaw-compatible agent.
- **Security:** Permission manifests are visible in the Forge Dashboard.
