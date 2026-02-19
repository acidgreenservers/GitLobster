#!/usr/bin/env node
/**
 * Direct signature verification test - no HTTP
 */

const nacl = require('tweetnacl');
const crypto = require('crypto');

// Load the auth module
const { verifyPackageSignature } = require('./src/auth');

console.log('🧪 Direct Signature Verification Test\n');

// Generate test keypair
const keypair = nacl.sign.keyPair();
const publicKeyBase64 = Buffer.from(keypair.publicKey).toString('base64');
const secretKeyBase64 = Buffer.from(keypair.secretKey).toString('base64');

console.log('1. Generated Keypair:');
console.log('   Public Key:', publicKeyBase64);
console.log('');

// Create test message (simulating a hash)
const testHash = 'sha256:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
console.log('2. Test Message (hash):');
console.log('   ', testHash);
console.log('');

// Sign the message
console.log('3. Signing message...');
const messageBytes = Buffer.from(testHash, 'utf8');
const signatureBytes = nacl.sign.detached(messageBytes, keypair.secretKey);
const signatureBase64 = Buffer.from(signatureBytes).toString('base64');
console.log('   Signature:', signatureBase64.substring(0, 50) + '...');
console.log('');

// Local verification (should succeed)
console.log('4. Local Verification (TweetNaCl):');
const localValid = nacl.sign.detached.verify(messageBytes, signatureBytes, keypair.publicKey);
console.log('   Result:', localValid ? '✅ PASS' : '❌ FAIL');
console.log('');

// Test our verifyPackageSignature function
console.log('5. Server Verification (verifyPackageSignature):');
const serverValid = verifyPackageSignature(testHash, signatureBase64, publicKeyBase64);
console.log('   Result:', serverValid ? '✅ PASS' : '❌ FAIL');
console.log('');

// Test with ed25519: prefix
console.log('6. Server Verification with ed25519: prefix:');
const serverValidPrefixed = verifyPackageSignature(testHash, `ed25519:${signatureBase64}`, publicKeyBase64);
console.log('   Result:', serverValidPrefixed ? '✅ PASS' : '❌ FAIL');
console.log('');

console.log('═══════════════════════════════════════════════');
if (localValid && serverValid) {
  console.log('✅ ALL TESTS PASSED - Signature verification is working!');
} else {
  console.log('❌ TESTS FAILED - Check the verifyPackageSignature function');
  if (localValid && !serverValid) {
    console.log('   Issue: Local verification works but server function fails');
    console.log('   This means there\'s a bug in verifyPackageSignature()');
  }
}
console.log('═══════════════════════════════════════════════');
