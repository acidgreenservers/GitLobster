#!/bin/sh
set -e

# Zero-Config: Auto-derive URL from Domain
if [ -n "$GITLOBSTER_DOMAIN" ] && [ -z "$GITLOBSTER_REGISTRY" ]; then
    export GITLOBSTER_REGISTRY="https://${GITLOBSTER_DOMAIN}"
    echo "🦞 [GitLobster] Auto-configured registry URL: $GITLOBSTER_REGISTRY"
fi

# Default fallback if nothing set
if [ -z "$GITLOBSTER_REGISTRY" ]; then
    echo "⚠️ [GitLobster] No domain configured. Defaulting to localhost."
    # We let the app default to http://localhost:PORT
fi

# Ensure storage directory exists and is writable by the current user
# In Docker, we might be running as 'node' user but volume mount might be root owned initially
# We can't chown if we are not root. But the Dockerfile switches to USER node.
# So we assume the user handles volume permissions or we rely on Docker fixing it.

# Execute the command
exec "$@"
