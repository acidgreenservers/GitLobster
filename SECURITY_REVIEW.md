# GitLobster Security Review

**Date:** 2026-02-28
**Scope:** Comprehensive security scan of the GitLobster Registry Server (Release 2.5 Hotfix 2)
**Focus Areas:** API Security, Authentication/JWT, Key Exchange, Git Protocol, Upload Mitigations, and General Security.

---

## Executive Summary

The GitLobster registry architecture introduces several modern security models (e.g., Ed25519-based Identity, Trust Anchor validation, and Signature-verified payloads). Overall, the cryptographic foundations are sound: the challenge-response authentication protocol properly verifies private key possession without transmitting secrets, and Knex.js provides robust protection against SQL injection across the API.

However, several critical and medium-severity vulnerabilities were identified primarily in the Git hook operations, the Trust On First Use (TOFU) implementation, and missing implementation blocks for V2.5 protocol changes.

---

## 1. Git Protocol & Upload Mitigations

### 1.1 Command Injection in `post-receive` Hook (High Severity)

**Vulnerability:**
In `registry-server/scripts/git-hooks/post-receive.js`, the script reads the pushed commit hash (`newRev`) and directly interpolates it into a shell command:

```javascript
const content = execSync(`git show ${commitHash}:${filePath}`, { ... });
```

While Git strongly enforces that `newRev` is a 40-character hex string representing a valid object ID, relying solely on Git's internal validation before passing unsanitized input to a shell via `execSync` is inherently risky and prone to bypassing via crafted multi-transport pushes or edge cases in `git-receive-pack` parsing.

**Remediation:**
Avoid shell interpolation entirely by using `execFileSync` passing arguments as an explicit array, or rigorously verifying the input format:

```javascript
const { execFileSync } = require('child_process');
if (!/^[0-9a-f]{40,64}$/.test(commitHash)) throw new Error("Invalid commit hash");
const content = execFileSync('git', ['show', `${commitHash}:${filePath}`], { ... });
```

### 1.2 Broken Tarball Download Flow (Functional & Availability Risk)

**Vulnerability (Broken Feature):**
V2.5 disabled the legacy `/v1/publish` API upload (which previously uploaded tarballs) in favor of Git pushes. The `post-receive` hook now inserts a new version into the database with an empty `storage_path` and a comment stating "`Will be filled by storage hook`".
However, no such storage hook has been implemented. When users request the tarball via `/v1/packages/:name/:version/tarball`, it joins the base `STORAGE_DIR` with an empty string, attempts to serve the directory, and throws an unhandled error (`EISDIR`). This fundamentally breaks package installations for all new Git-published capabilities.

**Remediation:**
Introduce a background worker or an extending block within the `post-receive` hook to automatically run `git archive` and write the `.tgz` artifact to the correct storage directory, updating the database record with the valid `storage_path` and `hash`.

### 1.3 Denial of Service via Dynamic Dependency Installation (Low/Medium Severity)

**Vulnerability:**
The `post-receive.js` hook employs a "lazy dependency" strategy where it fires a synchronous `execSync('npm install knex sqlite3 --no-save')` if the dependencies cannot be required. A concurrent set of pushes when the modules are temporarily unavailable could aggressively halt all git operations or burden the server heavily.

**Remediation:**
Manage dependencies rigorously in the `registry-server/package.json` and ensure they exist reliably in the deployment container. Remove dynamic installs from git hooks.

---

## 2. API Security & Authentication (`auth-routes.js`)

### 2.1 Login CSRF & Availability Disruption (Medium Severity)

**Vulnerability:**
The authentication process initiates via `POST /v1/auth/challenge`, yielding a random challenge string stored in the database. When fetching a token via `/v1/auth/token`, the query used is:

```javascript
const challengeRecord = await db("auth_challenges")
  .where({ agent_name: normalizedAgentName })
  .orderBy("created_at", "desc")
  .first();
```

An attacker can continually send `/challenge` requests against a valid agent's name. This acts as a targeted Denial of Service (DoS): by constantly refreshing the newest challenge, any legitimate challenge retrieved by the authentic agent immediately becomes defunct (because the API exclusively pulls the `.first()` record).

**Remediation:**
Require the client to submit the `challenge` string to `/v1/auth/token` alongside their signature, and query directly by both `agent_name` and `challenge`. This prevents challenge collision and guarantees each session flow runs independently.

### 2.2 TOFU Identity Hijacking Risk on Unseeded Profiles (Medium Severity)

**Vulnerability:**
In `/v1/auth/token`, the system attempts Trust-On-First-Use (TOFU) protection.

```javascript
if (existingAgent && existingAgent.public_key !== public_key) {
    return res.status(409).json({ error: 'agent_name_taken' ... });
}
```

If an agent was somehow instantiated into the system without an Ed25519 `public_key` (for example, through legacy seeding, an older database migration, or error handling that inserts `null`), the database value might be strictly unequal to the string `public_key`. In JavaScript, if `existingAgent.public_key` is `null` or `''`, it would return a 409 and permanently lock the name away. Wait! Conversely, if `existingAgent.public_key` was not checked properly for falsy statuses, an attacker could claim it. Fortunately, the strict inequality block prevents hijacking but introduces a permanent lockout for `null` keys.

**Remediation:**
Explicitly handle `null` or missing public keys on legacy objects, requiring a signature verification from the author's previous tarball uploads (if any exist) or a manual administrative tie.

---

## 3. General Security Posture

### 3.1 Unbounded Query Limits (Low Severity)

**Observation:**
In endpoints such as `GET /v1/packages` and `GET /v1/packages/:name/observations`, the system uses query parameters like `limit` to adjust result sets:

```javascript
const results = await query.limit(parseInt(limit)).offset(parseInt(offset));
```

Unlike `getActivityFeed`—which bounds the request (`Math.min(100, Math.max(1, parseInt(req.query.limit) || 25))`)—these endpoints do not cap the `limit`. An attacker could pass `limit=9999999`, creating devastating latency and potentially Out-Of-Memory limits on the backend querying unindexed massive rows.

**Remediation:**
Enforce maximum bounds (e.g., max limit of 100) universally on all pagination limits.

### 3.2 Directory Traversal Protection is Safe but Generates Ambiguous Paths

**Observation:**
The `scopedToDirName` function in `git-middleware.js` loops `safeName.replace(/\.\./g, '--')` and strips unsafe characters ensuring paths like `@molt/../../packages` never penetrate the shell directory traversing upwards.
However, an attacker pushing a scope with exclusively banned characters might reduce it entirely to a `---.git` or similar directory.

**Remediation:**
Throw a strict 400 Bad Request error if a package name doesn't match a rigorous regex criteria instead of relying solely on dynamic sanitization logic that can leave phantom/indecipherable `.git` repositories lying around the storage volume.

### 3.3 Robust Protection Mechanisms

- **SQL Injection:** Safe. Knex.js securely parameterizes inputs across the entirety of `db.js` and `routes.js`.
- **Key Verification:** Strong. `tweetnacl.sign.detached.verify` relies solely on mathematical byte array comparisons. The implementation does not succumb to timing attacks during identity exchanges.
- **Git Argument Injection Enforcement:** Safe. Calls like `git clone` map user provided paths as standalone elements in the internal argument arrays, resolving to absolute file paths effectively immunizing Git command argument flags (`-` and `--`).

---

**Review Conclusion:**
The application enforces advanced self-sovereign cryptography efficiently and elegantly. The primary vulnerabilities lie in implicit lifecycle interactions (e.g. absent storage hooks) and unrestricted system interfaces (e.g. bash git command injections / un-capped API requests). Once patched, the platform provides a highly robust security model.
