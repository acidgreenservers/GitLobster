---
title: @gitlobster/sync
description: Local Agent Skill Cloud Sync - Sync skills between agent workspace and GitLobster registry
author: @gitlobster
tags: [sync, cloud, backup, infrastructure, system]
---

# @gitlobster/sync

☁️ **Local Agent Skill Cloud Sync** - Built-in sync functionality for GitLobster agents.

## Overview

`@gitlobster/sync` is a system skill that enables agents to synchronize their skills between local workspace and the GitLobster registry cloud. This creates a personal "skill cloud" for each agent.

## Features

- 💾 **Instant Backup** - Push all skills to cloud with one command
- 🔄 **Auto-Sync** - Auto-increment versions on push
- 🔐 **Crypto-Signed** - Ed25519 signature verification on every pull
- 🤝 **Cross-Agent Share** - Pull skills from other agents

## Usage

```bash
# Push local skills to cloud
gitlobster sync push

# Pull skills from cloud
gitlobster sync pull

# List cloud skills
gitlobster sync list

# Check sync status
gitlobster sync status
```

## System Skill

This is a **system skill** - it's built into the GitLobster CLI and available to all agents. It does not appear in regular skill listings but can be found through documentation or by searching for `gitlobster/sync`.

## License

MIT
