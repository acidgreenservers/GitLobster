#!/usr/bin/env node
/**
 * Simple Fork Test Script
 * Tests the fork endpoint with minimal dependencies
 */

import nacl from 'tweetnacl';

// CONFIGURATION - Update these
const REGISTRY_URL = 'http://localhost:3002';
const SECRET_KEY_BASE64 = 'YOUR_SECRET_KEY_HERE'; // 64-byte Ed25519 secret key in base64
const JWT_TOKEN = 'YOUR_JWT_TOKEN_HERE'; // Get from authentication
const AGENT_NAME = '@gemini';
const PARENT_PACKAGE = '@gitlobster/bridge';
const FORKED_PACKAGE = `${AGENT_NAME}/bridge-test-fork`;
const FORK_REASON = 'Testing the fork system';

async function testFork() {
  console.log('🦞 GitLobster Fork Test\n');

  try {
    // 1. Get parent package metadata (to get latest version)
    console.log(`1️⃣  Fetching parent package: ${PARENT_PACKAGE}`);
    const metaRes = await fetch(`${REGISTRY_URL}/v1/packages/${encodeURIComponent(PARENT_PACKAGE)}`);

    if (!metaRes.ok) {
      throw new Error(`Parent package not found: ${metaRes.status} ${metaRes.statusText}`);
    }

    const metadata = await metaRes.json();
    const latestVersion = metadata.latest || '1.0.0';
    console.log(`   ✓ Found version: ${latestVersion}\n`);

    // 2. Create fork declaration message
    const forkCommit = 'no_git_repo'; // Or actual commit SHA
    const message = `fork:${PARENT_PACKAGE}:${FORKED_PACKAGE}:${FORK_REASON}:${latestVersion}:${forkCommit}`;

    console.log(`2️⃣  Creating fork declaration:`);
    console.log(`   Message: ${message}\n`);

    // 3. Sign with Ed25519
    console.log(`3️⃣  Signing with Ed25519...`);
    const secretKey = Buffer.from(SECRET_KEY_BASE64, 'base64');
    const messageBytes = Buffer.from(message, 'utf-8');
    const signature = nacl.sign.detached(messageBytes, secretKey);
    const signatureBase64 = Buffer.from(signature).toString('base64');
    console.log(`   ✓ Signature: ${signatureBase64.substring(0, 32)}...\n`);

    // 4. POST to fork endpoint
    console.log(`4️⃣  Posting to /v1/botkit/fork...`);
    const response = await fetch(`${REGISTRY_URL}/v1/botkit/fork`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${JWT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        parent_package: PARENT_PACKAGE,
        forked_package: FORKED_PACKAGE,
        fork_reason: FORK_REASON,
        signature: signatureBase64
      })
    });

    const result = await response.json();

    // 5. Display result
    if (response.ok) {
      console.log(`   ✅ SUCCESS! Fork created!\n`);
      console.log(`   📦 Forked Package: ${result.forked_package}`);
      console.log(`   🔗 Parent: ${result.parent_package}`);
      console.log(`   📍 Fork Point: v${result.fork_point_version}`);
      console.log(`   🕐 Forked At: ${result.forked_at}`);
      console.log(`   🔀 Git URL: ${result.git_url}`);
    } else {
      console.log(`   ❌ FAILED: ${response.status} ${response.statusText}\n`);
      console.log(`   Error:`, JSON.stringify(result, null, 2));
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  }
}

// Run test
testFork();
