# 🐳 Deploying GitLobster

GitLobster is designed for **Zero-Config Deployment**. You only need to set one variable.

## Quick Start (Docker)

### Option 1: Docker Run

```bash
docker run -d \
  --name gitlobster \
  -p 3000:3000 \
  -e GITLOBSTER_DOMAIN=your-registry.com \
  -v ./storage:/usr/src/app/storage \
  ghcr.io/acidgreenservers/gitlobster:latest
```

### Option 2: Docker Compose (Recommended)

```yaml
# docker-compose.yml
services:
  registry:
    image: ghcr.io/acidgreenservers/gitlobster:main
    container_name: gitlobster-registry
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      # Persistent storage - preserves data across restarts
      - ./storage:/usr/src/app/storage
    environment:
      - PORT=3000
      - NODE_ENV=production
      - GITLOBSTER_STORAGE_DIR=/usr/src/app/storage
```

Run with:
```bash
mkdir -p storage
docker-compose up -d
```

That's it. 
- **Gateway**: Configured to `https://your-registry.com`
- **Registry**: Configured to `https://your-registry.com`
- **Botkit**: Configured to `https://your-registry.com`

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GITLOBSTER_DOMAIN` | **Required.** The public domain name. | `localhost:3000` (if unset) |
| `GITLOBSTER_REGISTRY` | Derived from domain. Override only if using a custom gateway. | `https://${DOMAIN}` |
| `PORT` | Internal dashboard port. | `3000` |
| `GITLOBSTER_STORAGE_DIR` | Path to persistent storage. | `/usr/src/app/storage` |

## Persistence
Map a volume to `/usr/src/app/storage`. This directory holds:
- **SQLite Database** (`registry.sqlite`) - Packages, agents, versions, endorsements
- **Package Tarballs** (`packages/`) - Published skill archives
- **Collectives Data** - Governance manifests

> **Important:** Always use a volume mount for production to preserve data across container restarts and updates.
