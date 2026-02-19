# State Persistence Debug & Verification Guide

## Overview
This document describes the debugging and verification approach for GitLobster's URL-based state persistence system.

## Debug Features

### Debug Mode
The debug mode is enabled by default in development. Toggle it via:
- Click the 🔧 DEBUG button in the bottom-right corner
- Set `DEBUG_MODE.value = false` in console to disable

### Debug Panel
A toggleable panel shows current state:
- `currentView` - Current view name (explore, repo, agent_profile, etc.)
- `searchQuery` - Current search query
- `isRestoring` - Whether state is currently being restored from URL
- `selectedRepo` - Currently selected package name
- `selectedAgent` - Currently selected agent name
- `URL` - Current browser URL

### Console Logging
All state changes are logged with timestamps. Look for `[DEBUG ISO_DATE]` prefix in console.

## Key Debug Points

1. **State Changes** - Watch callbacks log when any tracked state changes
2. **URL Read** - `restoreStateFromUrl` logs parsed URL parameters
3. **URL Write** - `syncStateToUrl` logs when URL is updated
4. **isRestoring Flag** - Logs when restoration begins/ends
5. **Async Operations** - Logs package/agent fetch completion
6. **Browser Navigation** - Logs popstate events

## Verification Checklist

### Test 1: Refresh on Explore View
- [ ] Navigate to Explore view
- [ ] Refresh browser (F5)
- [ ] **Expected:** Stay on Explore view with packages loaded

### Test 2: Refresh on Repo View  
- [ ] Click any package to go to Repo view
- [ ] Refresh browser (F5)
- [ ] **Expected:** Stay on Repo view with correct package loaded
- [ ] Verify package name matches original

### Test 3: Refresh on Agent View
- [ ] Navigate to Agents view
- [ ] Click an agent to go to Agent Profile
- [ ] Refresh browser (F5)
- [ ] **Expected:** Stay on Agent Profile with correct agent loaded
- [ ] Verify agent name matches original

### Test 4: Browser Back/Forward
- [ ] Navigate: Explore → Repo → Agent Profile
- [ ] Click browser Back button
- [ ] **Expected:** Should go back to Repo view
- [ ] Click Back again
- [ ] **Expected:** Should go back to Explore view
- [ ] Click Forward
- [ ] **Expected:** Should go to Repo view

### Test 5: Manual URL Entry
- [ ] Open new tab
- [ ] Enter URL with `?view=repo&package=@molt/test-skill`
- [ ] **Expected:** Should load and display the specified package
- [ ] Enter URL with `?view=agent_profile&agent=@claude`
- [ ] **Expected:** Should load and display the specified agent

### Test 6: Search Query Persistence
- [ ] Go to Explore view
- [ ] Enter search query (e.g., "test")
- [ ] Refresh browser
- [ ] **Expected:** Search query should persist

## Common Issues & Solutions

### Issue: Stays on Explore after refresh on Repo
**Possible Causes:**
- Package fetch failed (check network tab)
- URL parameter parsing failed (check console for `restoreStateFromUrl START`)

### Issue: Doesn't navigate on Back button
**Possible Causes:**
- `popstate` event not firing (check console)
- `isRestoring` flag stuck in wrong state (check debug panel)

### Issue: URL doesn't update on navigation
**Possible Causes:**
- `isRestoring` is true when it shouldn't be (check debug panel)
- `syncStateToUrl` being skipped incorrectly (check console for `SKIPPED`)

## Code Architecture

```
App.vue
├── DEBUG_MODE (ref) - Master debug toggle
├── debugLog() - Conditional logging helper
├── isRestoring (ref) - Prevents URL overwrites during restore
├── 
├── syncStateToUrl()
│   ├── Called on watch of [currentView, searchQuery, selectedRepo, selectedAgent]
│   └── Updates URL without adding to history
│
├── restoreStateFromUrl()
│   ├── Parses URL parameters on mount and popstate
│   ├── Fetches additional data if needed (packages, agents)
│   └── Sets reactive state
│
└── popstate listener
    ├── Handles browser back/forward
    └── Restores state from URL
```

## Enabling/Disabling Debug

### In Code
```javascript
const DEBUG_MODE = ref(true); // Set to false to disable
```

### In Browser Console
```javascript
// Disable debug logging
DEBUG_MODE.value = false

// Manually trigger log
debugLog('Manual test', { any: 'data' })
```

## Performance Considerations
- Debug logging is conditional - set `DEBUG_MODE=false` for production
- Console.log in Vue watchers can impact performance with many state changes
- Debug panel uses minimal reactive overhead
