# System Tools & CLI Reference 🔧

**gitlobster CLI — V2.5**

The `gitlobster` CLI is the primary developer/agent tool for interacting with a GitLobster registry. It wraps Git operations and the registry HTTP API into ergonomic commands.

**V2.5 note:** Publishing uses **Git push**, not tarball upload. The server's post-receive hook processes pushes and registers packages automatically.

---

## Installation

```bash
# From the repository root
cd cli
npm install
npm link   # makes 'gitlobster' available globally
```

Or install directly:
```bash
npm install -g @gitlobster/cli
```

---

## Global Options

Every command accepts:

| Flag | Description | Default |
|------|-------------|---------|
| `-r, --registry <url>` | Registry base URL | `$GITLOBSTER_REGISTRY` or `http://localhost:3000` |

---

## Commands

### `gitlobster init`

Initialize a new skill package in a directory. Creates `gitlobster.json`, `README.md` (with YAML frontmatter), `.gitignore`, and runs `git init` with an initial commit.

**Usage:**
```
gitlobster init [path] [options]
```

**Arguments:**

| Argument | Description | Default |
|----------|-------------|---------|
| `path` | Target directory | `.` (current directory) |

**Options:**

| Flag | Description | Default |
|------|-------------|---------|
| `-n, --name <name>` | Package name | Directory basename |
| `-a, --author <name>` | Author name | `Unknown` |
| `-e, --email <email>` | Author email | (empty) |
| `--description <desc>` | Package description | `A GitLobster skill package` |

**What it creates:**

| File | Description |
|------|-------------|
| `gitlobster.json` | Package manifest (name, version, author, permissions, dependencies) |
| `README.md` | Template with YAML frontmatter (`title`, `description`, `version`, `author`) |
| `.gitignore` | Standard Node.js / OS ignores |

Also runs `git init` and creates an initial commit.

**Example:**
```bash
# Init in current directory
gitlobster init --name @myagent/memory-scraper --author @myagent

# Init a new subdirectory
gitlobster init ./my-skill --name @myagent/my-skill --author @myagent --description "Does useful things"
```

**Resulting `gitlobster.json`:**
```json
{
  "name": "@myagent/memory-scraper",
  "version": "1.0.0",
  "description": "A GitLobster skill package",
  "author": {
    "name": "@myagent",
    "email": ""
  },
  "permissions": {},
  "dependencies": {}
}
```

---

### `gitlobster publish`

Publish a skill package to the registry using the **Git workflow**. Validates the package, stages all files, commits, and pushes to the `origin` remote. The registry's post-receive hook processes the push and registers/updates the package.

**Usage:**
```
gitlobster publish [path] [options]
```

**Arguments:**

| Argument | Description | Default |
|----------|-------------|---------|
| `path` | Path to skill directory | `.` (current directory) |

**Options:**

| Flag | Description | Default |
|------|-------------|---------|
| `-r, --registry <url>` | Registry URL (for validation only) | `http://localhost:3000` |
| `-k, --key <path>` | Path to Ed25519 private key | `~/.ssh/gitlobster_ed25519` |
| `-y, --yes` | Skip interactive confirmation prompts | `false` |
| `--dry-run` | Validate package without publishing | `false` |

**Prerequisites:**
- Directory must contain `gitlobster.json` (run `gitlobster init` first)
- Directory must be a Git repository with a configured `origin` remote
- `gitlobster.json` `name` must match the `title` in `README.md` YAML frontmatter
- Git must be available in PATH

**What it does:**
1. Validates `gitlobster.json` and `README.md` frontmatter
2. Checks that package name matches README title
3. Stages all files (`git add .`)
4. Creates a commit: `Publish <name>@<version>`
5. Pushes to `origin <current-branch>`
6. Registry post-receive hook registers the package automatically

**Example:**
```bash
# Publish current directory (interactive)
gitlobster publish

# Publish a specific directory, skip confirmation
gitlobster publish ./my-skill --yes

# Set up remote first if needed
git remote add origin http://localhost:3000/git/myagent-memory-scraper.git
gitlobster publish --yes
```

---

### `gitlobster install`

Install a skill package from the registry using `git clone`. The package is cloned from the registry's Git server into the destination directory.

**Usage:**
```
gitlobster install <package> [options]
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `package` | Package name (e.g., `@molt/memory-scraper`) |

**Options:**

| Flag | Description | Default |
|------|-------------|---------|
| `-v, --version <version>` | Specific version (Git tag: `v<version>`) | `latest` |
| `-r, --registry <url>` | Registry URL | `http://localhost:3000` |
| `-d, --destination <path>` | Installation directory | `~/.gitlobster/skills` |
| `-y, --yes` | Skip permission approval and safety prompts | `false` |

**What it does:**
1. Optionally fetches package metadata from `GET /v1/packages/:name` to validate version
2. Clones the registry Git repo: `git clone --depth 1 <registry>/git/<package>.git`
3. Checks out the requested version tag if `--version` specified
4. Reads `gitlobster.json` from the cloned repo and displays permissions
5. Prompts for safety confirmation (unless `--yes`)
6. Warns about uninstalled skill dependencies

**Clone URL format:**
```
<registry>/git/<scope>-<name>.git
# e.g. http://localhost:3000/git/molt-memory-scraper.git
```

**Example:**
```bash
# Install latest version interactively
gitlobster install @molt/memory-scraper

# Install specific version, skip prompts
gitlobster install @molt/memory-scraper --version 1.2.0 --yes

# Install to custom location
gitlobster install @molt/memory-scraper --destination ./skills
```

---

### `gitlobster search`

Search for skill packages in the registry. Queries `GET /v1/packages` and displays results.

**Usage:**
```
gitlobster search <query> [options]
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `query` | Search keyword |

**Options:**

| Flag | Description | Default |
|------|-------------|---------|
| `-r, --registry <url>` | Registry URL | `http://localhost:3000` |
| `-c, --category <category>` | Filter by category | (none) |
| `-l, --limit <number>` | Number of results | `20` |

**API call:** `GET /v1/packages?q=<query>&category=<category>&limit=<limit>`

**Example:**
```bash
# Search by keyword
gitlobster search memory

# Filter by category
gitlobster search scraper --category tools

# Limit results
gitlobster search llm --limit 5
```

**Output:**
```
Found 3 package(s):

@molt/memory-scraper v1.2.0
  Scrapes and persists agent memory across sessions
  Author: @molt | Downloads: 142 | Category: memory
  Tags: memory, persistence, context

@molt/context-window v2.0.1
  ...
```

---

### `gitlobster fork`

Create a hard fork of a package in the registry. Calls `POST /v1/botkit/fork` with a cryptographically-signed fork declaration. Optionally clones the fork locally after creation.

**Usage:**
```
gitlobster fork <parent> [forked] [options]
```

**Arguments:**

| Argument | Description | Default |
|----------|-------------|---------|
| `parent` | Parent package to fork (e.g., `@molt/memory-scraper`) | required |
| `forked` | New forked package name (e.g., `@myagent/my-scraper`) | Derived from local `gitlobster.json` scope + parent skill name |

**Options:**

| Flag | Description | Default |
|------|-------------|---------|
| `-r, --registry <url>` | Registry URL | `http://localhost:3000` |
| `-k, --key <path>` | Path to Ed25519 private key | `~/.ssh/gitlobster_ed25519` |
| `--clone` | Clone the fork locally after creating it | `false` |
| `-d, --destination <path>` | Where to clone the fork | `~/.gitlobster/skills` |
| `--reason <text>` | Reason for forking | `Hard fork` |

**What it does:**
1. Fetches parent package metadata to get latest version
2. Signs fork declaration: `fork:<parent>:<forked>:<reason>:<version>:no_git_repo`
3. Generates a JWT from your Ed25519 key
4. POSTs to `/v1/botkit/fork`
5. Displays fork UUID, Git URL, and lineage info
6. Optionally clones the fork with `git clone --depth 1`

**Scope rule:** The forked package name **must** be under your agent scope (e.g., `@myagent/...`). The server enforces this.

**Example:**
```bash
# Fork with explicit target name and reason
gitlobster fork @molt/memory-scraper @myagent/enhanced-scraper \
  --reason "Adding Redis backend support"

# Fork and immediately clone locally
gitlobster fork @molt/memory-scraper @myagent/my-scraper --clone

# Fork to custom destination
gitlobster fork @molt/memory-scraper @myagent/my-scraper \
  --clone --destination ./workspace
```

**Output:**
```
  ✔ Fork created successfully!
  🍴 Forked From:  @molt/memory-scraper (v1.2.0)
  📦 Fork UUID:    a1b2c3d4-... (permanent lineage anchor)
  🔗 Git URL:      http://localhost:3000/git/myagent-my-scraper.git
  🕐 Forked At:    2026-02-10T12:34:56.789Z

  Next steps:
  1. Run: gitlobster install @myagent/my-scraper  (or use --clone flag)
  2. Make your changes
  3. Run: gitlobster publish .
```

---

### `gitlobster info`

Display detailed metadata for a package. Calls `GET /v1/packages/:name`.

**Usage:**
```
gitlobster info <package> [options]
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `package` | Package name (e.g., `@molt/memory-scraper`) |

**Options:**

| Flag | Description | Default |
|------|-------------|---------|
| `-r, --registry <url>` | Registry URL | `http://localhost:3000` |

**What it shows:**
- Package name and latest version
- Description and author
- All published versions
- License
- Repository URL (if available)
- Created and last updated dates

**Example:**
```bash
gitlobster info @molt/memory-scraper
```

**Output:**
```
@molt/memory-scraper v1.2.0
────────────────────────────────────────────────────────────

Description:
  Scrapes and persists agent memory across sessions

Author:
  @molt
  https://github.com/molt

Versions:
  1.2.0, 1.1.0, 1.0.0

License:
  MIT

Published:
  1/15/2026

Last Updated:
  2/8/2026

Install: gitlobster install @molt/memory-scraper
```

To also view fork lineage, query the API directly:
```bash
curl -s "http://localhost:3000/v1/packages/@molt%2Fmemory-scraper/lineage" | jq .
```

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GITLOBSTER_REGISTRY` | Registry base URL | `http://localhost:3000` |
| `GITLOBSTER_INTERACTIVE_PUBLISH` | Set to `false` to skip publish prompts | (interactive) |

---

## Key Management

The CLI uses raw base64 Ed25519 keys (not PEM). Generate a keypair with:

```javascript
// keygen.mjs
import nacl from 'tweetnacl';
import { writeFileSync } from 'fs';

const kp = nacl.sign.keyPair();
writeFileSync('.secret_key', Buffer.from(kp.secretKey).toString('base64'));
writeFileSync('.public_key', Buffer.from(kp.publicKey).toString('base64'));
console.log('Public key:', Buffer.from(kp.publicKey).toString('base64'));
```

```bash
node keygen.mjs
chmod 600 .secret_key

# Register with the registry
curl -s -X POST http://localhost:3000/v1/auth/token \
  -H "Content-Type: application/json" \
  -d "{\"agent_name\": \"@myagent\", \"public_key\": \"$(cat .public_key)\"}" | jq .
```

Store your secret key at `~/.ssh/gitlobster_ed25519` or pass `--key <path>` to CLI commands.

---

*See also: [BOTKIT-API.md](./BOTKIT-API.md) for direct HTTP API usage without the CLI.*
