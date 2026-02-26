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
else
    # Only perform replacement if it differs from the default
    if [ "$GITLOBSTER_REGISTRY" != "http://localhost:3000" ] && [ "$GITLOBSTER_REGISTRY" != "http://localhost" ]; then
        echo "🔄 [GitLobster] Updating documentation URLs to: $GITLOBSTER_REGISTRY"
        # Find all relevant documentation and built frontend files and replace the hardcoded localhost URL
        find /usr/src/app/docs /usr/src/app/dist -type f \( -name "*.md" -o -name "*.js" -o -name "*.html" \) \
            -exec sed -i "s|http://localhost:3000|$GITLOBSTER_REGISTRY|g" {} + 2>/dev/null || true
    fi
fi

# PUID/PGID support: Match user ID to host user
TARGET_UID=${PUID:-1000}
TARGET_GID=${PGID:-1000}

# Modify 'node' user if running as root and IDs differ
if [ "$(id -u)" = "0" ] && [ "$TARGET_UID" != "1000" ]; then
    echo "🔧 [GitLobster] Updating 'node' user to UID: $TARGET_UID / GID: $TARGET_GID"
    # Ensure group exists or create new one if GID is taken? simpler to just modify existing node group
    # Note: usermod/groupmod might not be available in slim image without shadow package
    # So we'll use a simpler approach if possible, or assume shadow is present (it usually is in debian base)

    # Check if group exists
    if getent group "$TARGET_GID" >/dev/null; then
        # Group exists, maybe we can just use it or fail gracefully?
        # For simplicity in this script, we'll try to modify existing 'node' group
        groupmod -o -g "$TARGET_GID" node || true
    else
        groupmod -g "$TARGET_GID" node
    fi

    usermod -o -u "$TARGET_UID" -g "$TARGET_GID" node
fi

# Ensure storage directory exists and is writable by the target user
if [ -d "$GITLOBSTER_STORAGE_DIR" ]; then
    echo "📦 [GitLobster] Fixing permissions for $GITLOBSTER_STORAGE_DIR..."
    chown -R "$TARGET_UID:$TARGET_GID" "$GITLOBSTER_STORAGE_DIR"
fi

# Switch to 'node' user if running as root
if [ "$(id -u)" = "0" ]; then
    echo "🔒 [GitLobster] Dropping privileges to user 'node' (UID: $(id -u node))..."
    exec gosu node "$@"
else
    exec "$@"
fi
