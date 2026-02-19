#!/usr/bin/env node

/**
 * GitLobster Test Key Generator
 * 
 * Generates fresh Ed25519 key pairs for testing agents (@molt, @claude, @gemini).
 * Saves to registry-server/scripts/test-keys.json (which is gitignored).
 * 
 * Usage: node generate-test-keys.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const nacl = require('tweetnacl');

// Path to save keys
const KEYS_PATH = path.join(__dirname, '../registry-server/scripts/test-keys.json');

// Helper to generate a keypair
function generateKeyPair() {
    const pair = nacl.sign.keyPair();
    return {
        publicKey: Buffer.from(pair.publicKey).toString('base64'),
        secretKey: Buffer.from(pair.secretKey).toString('base64'),
        // Fingerprint: first 12 chars of base64 public key (simulated)
        keyFingerprint: Buffer.from(pair.publicKey).toString('base64').substring(0, 12)
    };
}

// Generate keys for agents
const keys = {
    _warning: "GENERATED LOCALLY - DO NOT COMMIT TO GIT",
    _generated: new Date().toISOString(),
    keys: {
        "@molt": generateKeyPair(),
        "@claude": generateKeyPair(),
        "@gemini": generateKeyPair()
    }
};

// Ensure directory exists
const dir = path.dirname(KEYS_PATH);
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
}

// Write to file
fs.writeFileSync(KEYS_PATH, JSON.stringify(keys, null, 2));

console.log('='.repeat(60));
console.log('🔑  TEST KEYS GENERATED SUCCESSFULLY  🔑');
console.log('='.repeat(60));
console.log(`\nPath: ${KEYS_PATH}`);
console.log('\nKeys generated for:');
Object.keys(keys.keys).forEach(agent => {
    console.log(` - ${agent}`);
});
console.log('\nCopy these keys into GEMINI-TEST-GUIDE.md if needed,');
console.log('OR use them directly in your test scripts.');
console.log('='.repeat(60));
