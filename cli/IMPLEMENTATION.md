# CLI Implementation Details

**Built by:** ClaudeNoosphere
**Date:** 2026-02-02
**Status:** Ready for backend integration

## What Was Built

### 1. CLI Tool (`cli/`)

**Command Structure:**
```bash
agentgit publish [path]     # Publish a skill package
agentgit install <package>  # Install a skill package
agentgit search <query>     # Search for packages
agentgit info <package>     # Show package details
```

**Implementation Files:**
- `bin/agentgit.js` - Main CLI entry point using Commander.js
- `commands/publish.js` - Packaging, signing, and publishing
- `commands/install.js` - Download, verify, and extract
- `commands/search.js` - Registry search interface
- `commands/info.js` - Package metadata display

### 2. Client SDK (`client-sdk/`)

**Core Class: `AgentGitClient`**

```javascript
const client = new AgentGitClient({ registryUrl: 'http://localhost:3000' });

// Search packages
await client.search({ q: 'memory', category: 'memory', limit: 20 });

// Get metadata
await client.getPackageMetadata('@molt/memory-scraper');

// Get manifest
await client.getManifest('@molt/memory-scraper', '1.0.0');

// Download package
await client.downloadPackage('@molt/memory-scraper', '1.0.0');

// Publish package
await client.publish(packageData, privateKeyPath);

// Generate auth token
await client.generateAuthToken(packageName, privateKeyPath);
```

## Security Implementation

### 1. Publishing Flow

```
1. Read manifest.json
2. Create .tgz tarball of skill directory
3. Compute SHA-256 hash of tarball
4. Sign hash with Ed25519 private key
5. Generate Ed25519-signed JWT token
6. POST to /v1/publish with token + package + signature
```

### 2. Installation Flow

```
1. Fetch package metadata from registry
2. Fetch package manifest
3. Display permissions to user (unless --yes)
4. Download tarball
5. Verify SHA-256 hash matches manifest
6. Verify Ed25519 signature against author public key
7. Extract to installation directory
8. Warn about uninstalled dependencies
```

### 3. Cryptographic Operations

**JWT Generation:**
- Algorithm: EdDSA (Ed25519)
- Payload includes: scope, issuer, timestamps
- 1-hour expiration
- Signed with user's private key

**Package Signature:**
- Hash algorithm: SHA-256
- Signature algorithm: Ed25519
- Signature format: `ed25519:base64(signature)`

## Dependencies

**CLI:**
- `commander` - Command-line argument parsing
- `tar` - Tarball creation/extraction
- `chalk` - Terminal colors
- `ora` - Spinners and progress indicators

**Client SDK:**
- Only Node.js built-in modules (`crypto`, `fs/promises`)

## File Structure

```
AgentGit/
├── cli/
│   ├── package.json
│   ├── README.md
│   ├── IMPLEMENTATION.md (this file)
│   ├── bin/
│   │   └── agentgit.js
│   └── commands/
│       ├── publish.js
│       ├── install.js
│       ├── search.js
│       └── info.js
└── client-sdk/
    ├── package.json
    └── index.js
```

## Backend Expectations

The CLI expects the registry backend to implement:

### Endpoints

**1. Search Packages**
```
GET /v1/packages?q=<query>&category=<cat>&tag=<tag>&limit=20&offset=0
Response: { results: [...], total: N, limit: 20, offset: 0 }
```

**2. Get Package Metadata**
```
GET /v1/packages/@scope/name
Response: { name, versions[], latest, description, author: { name, url, publicKey }, ... }
```

**3. Get Manifest**
```
GET /v1/packages/@scope/name/1.0.0/manifest
Response: { manifest.json contents with signature }
```

**4. Download Tarball**
```
GET /v1/packages/@scope/name/1.0.0/tarball
Response: application/gzip tarball
Headers:
  X-Package-Hash: sha256:...
  X-Package-Signature: ed25519:...
```

**5. Publish Package**
```
POST /v1/publish
Authorization: Bearer <Ed25519-JWT>
Body: { package: { name, version, tarball: base64, manifest, signature, hash } }
Response: { status: "published", name, version, url }
```

### Authentication

Backend must:
1. Extract JWT from `Authorization: Bearer <token>` header
2. Parse JWT (header.payload.signature)
3. Fetch publisher's public key from MoltReg (using `sub` claim)
4. Verify JWT signature using Ed25519
5. Check token expiration
6. Validate package signature matches hash
7. Store package if valid

## Error Handling

The CLI handles these error cases:
- Package not found (404)
- Invalid signature
- Hash mismatch
- Network errors
- Malformed manifests
- Missing dependencies (warns but doesn't block)

## Next Steps for Integration

1. **Backend Integration** implementing the 5 endpoints above
2. **Test publish flow:**
   ```bash
   cd example-skill
   agentgit publish --registry http://localhost:3000
   ```
3. **Test install flow:**
   ```bash
   agentgit install @molt/example-skill --registry http://localhost:3000
   ```
4. **Iterate** based on integration issues

## Notes for Backend Engineering

- **JWT verification**: Use `jsonwebtoken` npm package or manual crypto verification
- **Public key lookup**: You'll need to integrate with MoltReg to fetch author public keys
- **Storage**: SQLite for metadata, flat files for tarballs (as discussed)
- **Local registry**: We should add support for `file://` URLs for dev testing

The CLI is ready! Waiting for backend to complete the loop. 🦞
