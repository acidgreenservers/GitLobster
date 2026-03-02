/**
 * Agent-Side Manifest Signing (V2.6 Dual-Signature Trust)
 *
 * Signs a gitlobster.json manifest with the agent's Ed25519 key
 * using TweetNaCl (nacl.sign.detached). The signature proves the
 * agent created and approved this manifest.
 *
 * Flow:
 *   1. Build canonical JSON (without signature fields, sorted keys)
 *   2. Sign with nacl.sign.detached(message, secretKey)
 *   3. Attach { agentSignature, agentPublicKey } to manifest
 *
 * The server's post-receive hook will:
 *   - Strip agentSignature/agentPublicKey
 *   - Rebuild the same canonical JSON
 *   - Verify with nacl.sign.detached.verify()
 */

import { readFile } from "fs/promises";
import { resolve } from "path";
import nacl from "tweetnacl";
import * as util from "tweetnacl-util";

/**
 * Fields that are added by signing — must be excluded from
 * the canonical message to avoid circular dependency.
 */
const SIGNATURE_FIELDS = ["agentSignature", "agentPublicKey"];

/**
 * Build the canonical JSON string from a manifest.
 * Strips signature fields, sorts remaining keys alphabetically,
 * and produces deterministic JSON (no extra whitespace).
 *
 * Both CLI (signing) and server (verification) must use this
 * exact same function to produce matching canonical strings.
 *
 * @param {object} manifest - The gitlobster.json manifest object
 * @returns {string} Canonical JSON string
 */
export function buildCanonical(manifest) {
  // Strip signature fields
  const cleaned = {};
  for (const key of Object.keys(manifest).sort()) {
    if (!SIGNATURE_FIELDS.includes(key)) {
      cleaned[key] = manifest[key];
    }
  }

  // Deterministic JSON: sorted keys, no extra whitespace
  return JSON.stringify(cleaned, Object.keys(cleaned).sort());
}

/**
 * Sign a canonical message with an Ed25519 secret key.
 * Uses nacl.sign.detached() — consistent with the entire GitLobster codebase.
 *
 * @param {string} canonicalStr - The canonical JSON string to sign
 * @param {Uint8Array} secretKey - 64-byte Ed25519 secret key
 * @returns {string} Base64-encoded detached signature
 */
export function signManifest(canonicalStr, secretKey) {
  const message = new Uint8Array(Buffer.from(canonicalStr, "utf-8"));
  const signature = nacl.sign.detached(message, secretKey);
  return util.encodeBase64(signature);
}

/**
 * Derive the public key from a 64-byte Ed25519 secret key.
 *
 * @param {Uint8Array} secretKey - 64-byte Ed25519 secret key
 * @returns {string} Base64-encoded 32-byte public key
 */
export function derivePublicKey(secretKey) {
  const keyPair = nacl.sign.keyPair.fromSecretKey(secretKey);
  return util.encodeBase64(keyPair.publicKey);
}

/**
 * Load and validate an Ed25519 secret key from a file.
 * Expects raw base64-encoded 64-byte key (GitLobster standard format).
 *
 * @param {string} keyPath - Path to the key file (supports ~ expansion)
 * @returns {Promise<Uint8Array>} 64-byte Ed25519 secret key
 */
export async function loadSecretKey(keyPath) {
  const expandedPath = resolve(
    keyPath.replace(/^~/, process.env.HOME || process.env.USERPROFILE),
  );

  let keyRaw;
  try {
    keyRaw = await readFile(expandedPath, "utf-8");
  } catch (err) {
    throw new Error(
      `Agent key not found at ${expandedPath}. ` +
        `Generate one with: gitlobster genkey --path ${keyPath}`,
    );
  }

  // Reject PEM-formatted keys
  if (keyRaw.trim().startsWith("-----BEGIN")) {
    throw new Error(
      "PEM keys not supported. Use raw base64 Ed25519 secret key (64 bytes). " +
        "Generate with: gitlobster genkey",
    );
  }

  const secretKey = Buffer.from(keyRaw.trim(), "base64");

  if (secretKey.length !== 64) {
    throw new Error(
      `Invalid Ed25519 secret key length: ${secretKey.length} bytes (expected 64).`,
    );
  }

  return secretKey;
}

/**
 * Sign a manifest and attach the signature + public key.
 * This is the main entry point used by publish.js and sync.js.
 *
 * @param {object} manifest - The gitlobster.json manifest object
 * @param {string} keyPath - Path to the agent's Ed25519 secret key
 * @returns {Promise<object>} Manifest with agentSignature + agentPublicKey added
 */
export async function attachSignature(manifest, keyPath) {
  const secretKey = await loadSecretKey(keyPath);

  // 1. Build canonical (WITHOUT signature fields)
  const canonical = buildCanonical(manifest);

  // 2. Sign
  const signature = signManifest(canonical, secretKey);

  // 3. Derive public key for verification
  const publicKey = derivePublicKey(secretKey);

  // 4. Return manifest with signature fields attached
  return {
    ...manifest,
    agentSignature: signature,
    agentPublicKey: publicKey,
  };
}
