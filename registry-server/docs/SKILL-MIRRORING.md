# OpenClaw Skill Mirroring 🌉

GitLobster provides a bridge to migrate legacy OpenClaw skills into modern SSF (Standard Skill Format) packages.

## The Bridge Tool

Located at: `scripts/skill-bridge.js`

### Usage

1. **Scan:** The script reads the `skills/` directory in your OpenClaw workspace.
2. **Scaffold:** It creates a corresponding Git repository with the required SSF structure:
   - `gitlobster.json` — generated from your legacy skill metadata
   - `README.md` — scaffolded with required YAML frontmatter
   - `SKILL.md` — agent-readable specification (optional but recommended)
   - `src/index.js` — your existing skill logic
3. **Review:** The agent and/or human reviews the generated `gitlobster.json` to confirm permissions, category, and tags are accurate.
4. **Publish:** The skill is published to the registry via `git push`.

---

## Why Mirror?

- **Immutability:** Versioned skills prevent breaking changes from silently affecting agents.
- **Portability:** SSF packages with `gitlobster.json` can run on any GitLobster-compatible registry.
- **Security:** Permission manifests are declared in `gitlobster.json` and displayed in the registry UI's Permission Shield.
- **Lineage:** Once mirrored, you can fork and evolve skills with full `forked_from` ancestry tracking.

---

## Generated `gitlobster.json` Template

When the bridge scaffolds a skill, it generates a `gitlobster.json` like this:

```json
{
  "name": "@yourscope/skill-name",
  "version": "1.0.0",
  "description": "Migrated from legacy OpenClaw skill: skill-name",
  "author": {
    "name": "@yourname",
    "email": "you@example.com",
    "url": ""
  },
  "license": "MIT",
  "category": "utility",
  "tags": ["migrated", "openclaw"],
  "permissions": {
    "filesystem": false,
    "network": false,
    "shell": false,
    "llm_api": false
  }
}
```

**Review before publishing:** The bridge cannot automatically detect what permissions your skill needs. You must manually set `filesystem`, `network`, `shell`, and `llm_api` to `true` if your skill uses those capabilities.

---

## Required README.md Frontmatter

The bridge generates a `README.md` with YAML frontmatter. The post-receive hook will reject pushes where this frontmatter is missing or malformed. Confirm your README starts like this:

```markdown
---
title: "Skill Name"
description: "One line description"
version: "1.0.0"
author: "@yourname"
category: "utility"
tags: ["migrated", "openclaw"]
---

# Skill Name
...
```

---

## Publishing the Migrated Skill

```bash
# 1. Initialize the scaffolded directory as a git repo (if not already)
cd your-skill-directory
git init

# 2. Sign your commits (required by the post-receive hook)
# Configure your Ed25519 signing key first
git config user.signingkey <your-key-id>
git config commit.gpgsign true

# 3. Add and commit your files
git add .
git commit -S -m "feat: initial migration from OpenClaw legacy skill"

# 4. Add the registry as a remote
git remote add registry http://localhost:3000/@yourname/skill-name.git

# 5. Push to publish
git push registry main
```

The server's post-receive hook will automatically validate `gitlobster.json`, `README.md` (frontmatter), and commit signatures before accepting the push.

---

## Checking Your Published Skill

After a successful push, verify the skill appears in the registry:

```
GET http://localhost:3000/v1/packages/@yourname/skill-name
```

You should see your metadata, version, and permission declarations indexed in the registry.
