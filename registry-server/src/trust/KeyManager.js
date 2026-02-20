/**
 * KeyManager.js
 * Manages the node's cryptographic identity (Ed25519 keypair).
 * Auto-generates a keypair on first run and persists it to storage.
 */

const fs = require('fs');
const path = require('path');
const nacl = require('tweetnacl');
const { encodeBase64 } = require('tweetnacl-util');

let identity = null;

// Storage configuration
const STORAGE_DIR = process.env.GITLOBSTER_STORAGE_DIR
    ? path.resolve(process.env.GITLOBSTER_STORAGE_DIR)
    : path.join(__dirname, '../../storage');

const KEYS_DIR = path.join(STORAGE_DIR, 'keys');
const KEY_FILE = path.join(KEYS_DIR, 'node_root.key');

/**
 * Initialize Node Identity
 * Loads existing key or generates a new one.
 */
function initNodeIdentity() {
    try {
        // Ensure keys directory exists
        if (!fs.existsSync(KEYS_DIR)) {
            fs.mkdirSync(KEYS_DIR, { recursive: true });
        }

        if (fs.existsSync(KEY_FILE)) {
            // Load existing key
            const keyData = JSON.parse(fs.readFileSync(KEY_FILE, 'utf8'));
            identity = {
                publicKey: keyData.public_key,
                secretKey: Buffer.from(keyData.secret_key, 'base64'),
                created: keyData.created,
                fingerprint: generateFingerprint(keyData.public_key)
            };
            console.log(`🔐 Node Identity Loaded: ${identity.fingerprint}`);
        } else {
            // Generate new keypair
            const keyPair = nacl.sign.keyPair();
            const publicKeyB64 = encodeBase64(keyPair.publicKey);
            const secretKeyB64 = encodeBase64(keyPair.secretKey);
            const created = new Date().toISOString();
            const fingerprint = generateFingerprint(publicKeyB64);

            identity = {
                publicKey: publicKeyB64,
                secretKey: keyPair.secretKey,
                created: created,
                fingerprint: fingerprint
            };

            // Save to disk
            fs.writeFileSync(KEY_FILE, JSON.stringify({
                public_key: identity.publicKey,
                secret_key: secretKeyB64,
                created: created
            }, null, 2));

            console.log(`🔐 New Node Identity Generated: ${fingerprint}`);
        }
    } catch (error) {
        console.error('❌ Failed to initialize node identity:', error);
        // Do not crash, but log error. Allow server to start without identity if FS fails? 
        // No, identity is critical for trust model.
        process.exit(1);
    }
}

/**
 * Get the node's public identity
 */
function getNodeIdentity() {
    if (!identity) {
        // Auto-init if not initialized
        initNodeIdentity();
    }
    return {
        publicKey: identity.publicKey,
        fingerprint: identity.fingerprint,
        created: identity.created
    };
}

/**
 * Get the node's private signing key (base64)
 * SECURITY: Use only for signing tokens or system messages
 */
function getSigningKey() {
    if (!identity) {
        initNodeIdentity();
    }
    return encodeBase64(identity.secretKey);
}

/**
 * Generate a visual fingerprint (short hash) from public key
 */
function generateFingerprint(publicKey) {
    if (!publicKey) return 'UNKNOWN';
    return publicKey.substring(0, 8) + '...' + publicKey.substring(publicKey.length - 8);
}

module.exports = {
    initNodeIdentity,
    getNodeIdentity,
    getSigningKey
};