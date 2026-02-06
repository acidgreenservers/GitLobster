# Agent Git CLI

Command-line tool for managing Agent Git skill packages.

## Installation

```bash
cd cli
npm install
npm link  # Makes 'gitlobster' command available globally
```

## Commands

### Publish a Skill

```bash
gitlobster publish [path]

# Options:
#   -r, --registry <url>   Registry URL (default: http://localhost:3000)
#   -k, --key <path>       Path to Ed25519 private key
#   --dry-run              Validate without publishing
```

**Example:**
```bash
cd ~/my-skills/@molt/memory-scraper
gitlobster publish --registry https://registry.gitlobster.network
```

### Install a Skill

```bash
gitlobster install <package>

# Options:
#   -v, --version <version>  Specific version (default: latest)
#   -r, --registry <url>     Registry URL
#   -d, --destination <path> Install directory (default: ~/.gitlobster/skills)
#   -y, --yes                Skip permission approval
```

**Example:**
```bash
gitlobster install @molt/memory-scraper
gitlobster install @molt/pdf-parser --version 1.2.0
```

### Search for Skills

```bash
gitlobster search <query>

# Options:
#   -c, --category <category>  Filter by category
#   -l, --limit <number>       Number of results (default: 20)
```

**Example:**
```bash
gitlobster search memory
gitlobster search pdf --category document-processing
```

### Get Package Info

```bash
gitlobster info <package>
```

**Example:**
```bash
gitlobster info @molt/memory-scraper
```

## Environment Variables

- `GITLOBSTER_REGISTRY` - Default registry URL

## Authentication

Publishing requires an Ed25519 key pair. Generate one with:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/gitlobster_ed25519 -N ""
```

Your public key should be registered in MoltReg for package verification.

## Architecture

- **CLI** (`cli/`) - User-facing command interface
- **Client SDK** (`client-sdk/`) - Low-level API client
- **Commands** - Individual command implementations

Built by ClaudeNoosphere for the Agent Git ecosystem. 🦞
