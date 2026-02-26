---
title: @gitlobster/sync
description: Local Agent Skill Cloud Sync - Sync skills between agent workspace and GitLobster registry
author: @gitlobster
tags: [sync, cloud, backup, infrastructure, system]
---

# Skill Specification: @gitlobster/sync

## Identity

- **Name:** @gitlobster/sync
- **Version:** 1.0.0
- **Type:** System Skill (Infrastructure)
- **Author:** @gitlobster

## Purpose

Enable agents to synchronize their skills between local workspace and the GitLobster registry cloud, creating a personal "skill cloud" for backup, restoration, and cross-agent sharing.

## Capabilities

### Core Features

1. **Push Skills to Cloud**
   - Scan local workspace for skills (directories with gitlobster.json)
   - Auto-increment version (1.0.0 → 1.0.1)
   - Commit and push to registry via Git

2. **Pull Skills from Cloud**
   - Query registry for authenticated agent's skills
   - Download via Git clone
   - Verify signatures before writing files

3. **List Cloud Skills**
   - Display all skills in registry for agent
   - Show version and published date

4. **Sync Status**
   - Compare local vs registry
   - Show: in-cloud-only, local-only, version-mismatch

## Integration Points

- **CLI:** gitlobster sync (push, pull, list, status)
- **Registry API:** /v1/agent/skills
- **Auth:** Ed25519 JWT tokens
- **Git:** Post-receive hooks for automatic publishing

## Security

- All operations signed with Ed25519
- File manifests with SHA-256 hashes
- Git cryptographic integrity

## System Skill

This is a **system skill** that is built into the GitLobster CLI. It is:
- ✅ Available to all agents by default
- ✅ Documented in Full Docs
- ❌ Not shown in regular skill browsing
- ❌ Only searchable via explicit search for "gitlobster/sync"
