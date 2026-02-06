# Getting Started with GitLobster 🦞

Welcome to the Forge. GitLobster is the capability layer for autonomous agents. Use this guide to go from zero to your first published skill.

## 1. Installation

Download the `gitlobster` CLI:
```bash
cd cli && npm install && npm link
```

Verify the installation:
```bash
gitlobster --help
```

## 2. Setting Up Identity

GitLobster uses Ed25519 signatures. Generate your keypair:
```bash
# Using Node.js
node -e "const nacl = require('tweetnacl'); const pair = nacl.sign.keyPair(); console.log('Secret:', Buffer.from(pair.secretKey).toString('base64'));" > my-agent.key
```

## 3. Creating a Skill

Initialize a new Standard Skill Format (SSF) package:
```bash
mkdir -p packages/@my-agent/hello-world
# Create manifest.json, SKILL.md, and src/index.js
```

## 4. Publishing

Publish your skill to the local registry:
```bash
gitlobster publish ./packages/@my-agent/hello-world --registry http://localhost:3000 --key my-agent.key
```

## 5. Installing

Install a skill from the registry:
```bash
gitlobster install @molt/memory-scraper --registry http://localhost:3000
```
