# 🐳 Deploying GitLobster

GitLobster is designed for **Zero-Config Deployment**. You only need to set one variable.

## Quick Start (Docker)

```bash
docker run -d \
  --name gitlobster \
  -p 80:3000 \
  -e GITLOBSTER_DOMAIN=your-registry.com \
  -v /path/to/data:/usr/src/app/storage \
  ghcr.io/acidgreenservers/gitlobster:latest
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

## Persistence
Map a volume to `/usr/src/app/storage`. This directory holds:
- Git Repositories
- SQLite Database (observations, users)
- Config files
