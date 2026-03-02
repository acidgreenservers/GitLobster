/**
 * Manifest Signer — Post-Receive Hook Library
 *
 * Signs the canonical manifest with the server's Ed25519 key
 * using TweetNaCl (nacl.sign.detached). This is the SERVER side
 * of the dual-signature trust model.
 *
 * Uses the existing KeyManager.js for persistent key management.
 */

const nacl = require("tweetnacl");
const { encodeBase64 } = require("tweetnacl-util");
const path = require("path");

/**
 * Load the server's identity and signing key from KeyManager.
 * KeyManager exports functions (not a class):
 *   - getNodeIdentity() → { publicKey, fingerprint, created }
 *   - getSigningKey()   → base64-encoded 64-byte secret key
 *
 * @returns {{ secretKey: Uint8Array, publicKey: string, fingerprint: string }}
 */
function getServerKey() {
  // Resolve KeyManager relative to registry-server/src/trust/
  const keyManagerPath = path.resolve(
    __dirname,
    "../../../src/trust/KeyManager",
  );
  const { getSigningKey, getNodeIdentity } = require(keyManagerPath);

  const identity = getNodeIdentity();
  const secretKeyB64 = getSigningKey();

  return {
    secretKey: new Uint8Array(Buffer.from(secretKeyB64, "base64")),
    publicKey: identity.publicKey,
    fingerprint: identity.fingerprint,
  };
}

/**
 * Sign the canonical manifest with the server's Ed25519 key.
 *
 * The canonical data includes:
 *   - Agent's signature (if provided) and fingerprint
 *   - File manifest (per-file SHA-256 hashes)
 *   - Core manifest fields (name, version, description, etc.)
 *
 * @param {object} manifest - The enriched gitlobster.json
 * @param {string} agentFingerprint - Agent's fingerprint or 'legacy-unsigned'
 * @param {object} fileManifest - { "file.md": "sha256:...", ... }
 * @returns {{ serverSignature: string, serverPublicKey: string, serverFingerprint: string, agentFingerprint: string }}
 */
function signCanonicalManifest(manifest, agentFingerprint, fileManifest) {
  const serverKey = getServerKey();

  // Build the canonical data object to sign
  const canonicalData = {
    agentFingerprint: agentFingerprint,
    agentSignature: manifest.agentSignature || "none",
    category: manifest.category || "",
    description: manifest.description || "",
    fileManifest: fileManifest,
    homepage: manifest.homepage || "",
    license: manifest.license || "",
    name: manifest.name,
    version: manifest.version,
  };

  // Deterministic JSON: keys already alphabetically ordered above
  const canonicalJSON = JSON.stringify(
    canonicalData,
    Object.keys(canonicalData).sort(),
  );

  // Sign with server's Ed25519 key using TweetNaCl
  const message = new Uint8Array(Buffer.from(canonicalJSON, "utf-8"));
  const signature = nacl.sign.detached(message, serverKey.secretKey);

  return {
    serverSignature: encodeBase64(signature),
    serverPublicKey: serverKey.publicKey,
    serverFingerprint: serverKey.fingerprint,
    agentFingerprint: agentFingerprint,
  };
}

/**
 * Generate a visual fingerprint from a base64 public key.
 * Format: first8...last8
 *
 * @param {string} publicKeyB64 - Base64-encoded public key
 * @returns {string} Fingerprint string
 */
function getFingerprint(publicKeyB64) {
  if (!publicKeyB64 || publicKeyB64.length < 16) {
    return "INVALID";
  }
  const first8 = publicKeyB64.substring(0, 8);
  const last8 = publicKeyB64.substring(publicKeyB64.length - 8);
  return `${first8}...${last8}`;
}

module.exports = {
  signCanonicalManifest,
  getFingerprint,
};
