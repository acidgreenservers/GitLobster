#!/bin/sh
# GitLobster Hook Wrapper
# Proxies the hook execution to the Node.js runtime

# Resolve the project root assuming standard structure
# If GIT_PROJECT_ROOT is set by http-backend, we might be in the repo dir.
# But we need to find the node script in registry-server/src/hooks/pre-receive.js

# Hardcode path for now based on known structure, or use relative to script loc?
# hooks/pre-receive is inside storage/repo.git/hooks/
# So script is at ../../../src/hooks/pre-receive.js

SCRIPT_DIR=$(dirname "$0")
REPO_DIR=$(cd "$SCRIPT_DIR/../.." && pwd)
REGISTRY_ROOT=$(cd "$REPO_DIR/.." && pwd)
HOOK_SCRIPT="$REGISTRY_ROOT/src/hooks/pre-receive.js"

# Debug logging
# echo "Running hook from $SCRIPT_DIR" >> /tmp/hook.log
# echo "Registry root: $REGISTRY_ROOT" >> /tmp/hook.log

if [ -f "$HOOK_SCRIPT" ]; then
    exec node "$HOOK_SCRIPT"
else
    echo "❌ [GitLobster] Critical Error: Hook script not found at $HOOK_SCRIPT"
    exit 1
fi
