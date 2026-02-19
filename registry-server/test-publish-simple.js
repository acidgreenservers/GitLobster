#!/usr/bin/env node
/**
 * Simple Publish Test Script
 * Tests the publish endpoint with proper Ed25519 signature verification
 */

import nacl from 'tweetnacl';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// CONFIGURATION - Update these
const REGISTRY_URL = 'http://localhost:3002';
const AGENT_NAME = '@molt';

// Generate a test Ed25519 keypair (in production, load from secure storage)
console.log('🔑 Generating test Ed25519 keypair...');
const keypair = nacl.sign.keyPair();
const publicKeyBase64 = Buffer.from(keypair.publicKey).toString('base64');
const secretKeyBase64 = Buffer.from(keypair.secretKey).toString('base64');

console.log('   Public Key:', publicKeyBase64);
console.log('   Secret Key:', secretKeyBase64.substring(0, 20) + '...\n');

// Generate JWT token for authentication
function generateJWT(agentName, privateKey, expiresIn = 86400) {
  const now = Math.floor(Date.now() / 1000);

  const header = {
    alg: 'EdDSA',
    typ: 'JWT'
  };

  const payload = {
    sub: agentName,
    iat: now,
    exp: now + expiresIn
  };

  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');

  const signingInput = `${headerB64}.${payloadB64}`;
  const messageBytes = Buffer.from(signingInput, 'utf8');

  const privateKeyBytes = Buffer.from(privateKey, 'base64');
  const signatureBytes = nacl.sign.detached(messageBytes, privateKeyBytes);
  const signatureB64 = Buffer.from(signatureBytes).toString('base64url');

  return `${signingInput}.${signatureB64}`;
}

async function testPublish() {
  console.log('🦞 GitLobster Publish Test\n');

  try {
    // 1. Create a minimal test package tarball (in memory)
    console.log('1️⃣  Creating test package...');

    const manifest = {
      name: `${AGENT_NAME}/test-skill`,
      version: '1.0.0',
      description: 'Test skill for signature verification',
      author: {
        name: AGENT_NAME,
        publicKey: publicKeyBase64
      },
      license: 'MIT',
      category: 'test',
      tags: ['test', 'signature', 'verification'],
      permissions: {
        read_filesystem: false,
        write_filesystem: false,
        network: false,
        environment: false
      },
      entry_point: 'src/index.js'
    };

    // Simple tarball content (just the manifest for testing)
    const tarballContent = JSON.stringify(manifest);
    const tarballBase64 = Buffer.from(tarballContent).toString('base64');
    console.log('   ✓ Package created (simplified tarball)\n');

    // 2. Compute SHA-256 hash
    console.log('2️⃣  Computing SHA-256 hash...');
    const tarballBuffer = Buffer.from(tarballBase64, 'base64');
    const hashHex = createHash('sha256').update(tarballBuffer).digest('hex');
    const fullHash = `sha256:${hashHex}`;
    console.log(`   ✓ Hash: ${fullHash}\n`);

    // 3. Sign the FULL hash string with Ed25519
    console.log('3️⃣  Signing with Ed25519...');
    console.log(`   Message to sign: "${fullHash}"`);

    const messageBytes = Buffer.from(fullHash, 'utf-8');
    const signatureBytes = nacl.sign.detached(messageBytes, keypair.secretKey);
    const signatureBase64 = Buffer.from(signatureBytes).toString('base64');

    console.log(`   ✓ Signature: ${signatureBase64.substring(0, 40)}...\n`);

    // 4. Verify locally before sending (sanity check)
    console.log('4️⃣  Local signature verification...');
    const isLocalValid = nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      keypair.publicKey
    );
    console.log(`   ${isLocalValid ? '✅' : '❌'} Local verification: ${isLocalValid}\n`);

    if (!isLocalValid) {
      console.error('❌ Local verification failed! Something is wrong with the signing logic.');
      return;
    }

    // 5. Generate JWT for authentication
    console.log('5️⃣  Generating JWT token...');
    const jwtToken = generateJWT(AGENT_NAME, secretKeyBase64);
    console.log(`   ✓ JWT: ${jwtToken.substring(0, 50)}...\n`);

    // 6. POST to publish endpoint
    console.log('6️⃣  Posting to /v1/publish...');
    const response = await fetch(`${REGISTRY_URL}/v1/publish`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        package: {
          name: manifest.name,
          version: manifest.version,
          tarball: tarballBase64,
          manifest: manifest,
          hash: fullHash,
          signature: signatureBase64
        }
      })
    });

    const result = await response.json();

    // 7. Display result
    if (response.ok) {
      console.log('   ✅ SUCCESS! Package published!\n');
      console.log(`   📦 Name: ${result.name}`);
      console.log(`   📌 Version: ${result.version}`);
      console.log(`   🔗 URL: ${result.url}`);
    } else {
      console.log(`   ❌ FAILED: ${response.status} ${response.statusText}\n`);
      console.log('   Error:', JSON.stringify(result, null, 2));

      if (result.error === 'signature_invalid') {
        console.log('\n🔍 Debugging Info:');
        console.log('   - Ensure the server is using the correct message for verification');
        console.log('   - The message should be the FULL hash: "sha256:..."');
        console.log('   - Not just the hex part');
        console.log('   - Check server logs for detailed verification output');
      }
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  }
}

// Display usage instructions
console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║  GitLobster Publish Test - Signature Verification Demo    ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');
console.log('This script tests the Ed25519 signature verification flow:');
console.log('  1. Generate Ed25519 keypair');
console.log('  2. Create test package (simplified tarball)');
console.log('  3. Compute SHA-256 hash');
console.log('  4. Sign the FULL hash string (sha256:...)');
console.log('  5. Verify locally');
console.log('  6. POST to /v1/publish\n');
console.log('Expected flow:');
console.log('  • Client signs: "sha256:abc123..."');
console.log('  • Server verifies against: "sha256:abc123..."');
console.log('  • Both use the same message!\n');
console.log('════════════════════════════════════════════════════════════\n');

// Run test
testPublish();
