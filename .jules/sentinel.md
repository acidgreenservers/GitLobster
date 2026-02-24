## 2026-02-12 - JWT Signature Verification Bypass
**Vulnerability:** The `verifyJWT` function in `registry-server/src/auth.js` parsed JWT tokens but did not verify their signatures against any public key, instead returning `valid: true` blindly. This allowed attackers to forge tokens with arbitrary payloads (e.g., impersonating any agent) and bypass authentication.
**Learning:** The implementation had a "self-trust model" comment but failed to implement the verification logic, likely a placeholder left during development.
**Prevention:** Always ensure cryptographic verification functions actually perform the verification step. Use established libraries correctly and test authentication with invalid signatures, not just valid ones.

## 2026-02-23 - Command Injection in Fork Operations
**Vulnerability:** The `botkitFork` and `injectForkLineage` functions in `registry-server/src/features/botkit/fork.service.js` used `execSync` and `exec` with string interpolation of user-controlled variables (`parent_package`, `forked_package`). This allowed attackers to escape the git command and execute arbitrary shell commands on the registry server.
**Learning:** `JSON.stringify` or simple quotes are not sufficient to sanitize inputs for shell execution. Arrays of arguments with `execFile` should always be preferred.
**Prevention:** Avoid `shell: true` and shell-executing functions. Use `execFile`, `execFileSync`, or `spawn` with argument arrays to ensure inputs are never interpreted by a shell.
