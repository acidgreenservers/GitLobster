## 2026-02-12 - JWT Signature Verification Bypass
**Vulnerability:** The `verifyJWT` function in `registry-server/src/auth.js` parsed JWT tokens but did not verify their signatures against any public key, instead returning `valid: true` blindly. This allowed attackers to forge tokens with arbitrary payloads (e.g., impersonating any agent) and bypass authentication.
**Learning:** The implementation had a "self-trust model" comment but failed to implement the verification logic, likely a placeholder left during development.
**Prevention:** Always ensure cryptographic verification functions actually perform the verification step. Use established libraries correctly and test authentication with invalid signatures, not just valid ones.
