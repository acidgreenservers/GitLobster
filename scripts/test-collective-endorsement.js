const fs = require('fs');
const path = require('path');
const nacl = require('tweetnacl');
const { encodeBase64 } = require('tweetnacl-util');
const { saveCollective } = require('../registry-server/src/collectives/registry');
const { verifyEndorsementPolicy } = require('../registry-server/src/utils/endorsement-policy');

// Setup Storage (Same logic as registry.js)
const GIT_PROJECT_ROOT = process.env.GITLOBSTER_STORAGE_DIR || process.env.GIT_PROJECT_ROOT || path.join(__dirname, '../storage');
const COLLECTIVES_DIR = path.join(GIT_PROJECT_ROOT, 'collectives');
if (!fs.existsSync(COLLECTIVES_DIR)) fs.mkdirSync(COLLECTIVES_DIR, { recursive: true });

// --- Helpers ---
function createAgent(name) {
    const keyPair = nacl.sign.keyPair();
    return {
        name,
        publicKey: encodeBase64(keyPair.publicKey),
        secretKey: keyPair.secretKey
    };
}

function sign(proposalId, verdict, agent) {
    const message = `${proposalId}:${verdict}`;
    const sig = nacl.sign.detached(Buffer.from(message), agent.secretKey);
    return {
        agent_id: agent.publicKey,
        role: 'REVIEWER',
        verdict: verdict,
        signature: encodeBase64(sig)
    };
}

// --- Test Setup ---
const alice = createAgent('Alice');
const bob = createAgent('Bob');
const charlie = createAgent('Charlie'); // Non-member

const collectiveId = 'did:gitlobster:collective:marketing-dao';

const manifest = {
    "@context": "https://gitlobster.network/ctx/v1",
    "type": "Collective",
    "id": collectiveId,
    "name": "Marketing DAO",
    "governance": {
        "threshold": 3,
        "members": [
            { "id": alice.publicKey, "role": "admin", "weight": 2 },
            { "id": bob.publicKey, "role": "member", "weight": 1 }
        ]
    }
};

const baseManifest = { permissions: { network: { outbound: ['google.com'] } } };
const headManifest = { permissions: { network: { outbound: ['google.com', 'openai.com'] } } }; // High Risk

(async () => {
    console.log('--- Testing Collective Endorsement Policy ---');

    // 1. Save Collective
    await saveCollective(manifest);
    console.log('✅ Collective Saved:', collectiveId);

    // 2. Scenario 1: Alice only (Weight 2 < 3) -> FAIL
    const prop1 = {
        id: 'prop-dao-1',
        endorsements: [sign('prop-dao-1', 'APPROVE', alice)]
    };

    // We pass the collective ID as the owner
    const res1 = await verifyEndorsementPolicy(prop1, baseManifest, headManifest, collectiveId);
    console.log('Test 1 (Alice w=2):', !res1.approved ? '✅ PASS' : '❌ FAIL');
    console.log(`   Reason: ${res1.reason}`);

    // 3. Scenario 2: Alice + Bob (Weight 2+1 = 3) -> PASS
    const prop2 = {
        id: 'prop-dao-2',
        endorsements: [
            sign('prop-dao-2', 'APPROVE', alice),
            sign('prop-dao-2', 'APPROVE', bob)
        ]
    };

    const res2 = await verifyEndorsementPolicy(prop2, baseManifest, headManifest, collectiveId);
    console.log('Test 2 (Alice+Bob w=3):', res2.approved ? '✅ PASS' : '❌ FAIL');
    console.log(`   Reason: ${res2.reason}`);

    // 4. Scenario 3: Alice + Charlie (Weight 2+0 = 2) -> FAIL
    // Charlie is not in the list, so he effectively has 0 weight (or isn't counted in governance check)
    const prop3 = {
        id: 'prop-dao-3',
        endorsements: [
            sign('prop-dao-3', 'APPROVE', alice),
            sign('prop-dao-3', 'APPROVE', charlie)
        ]
    };

    const res3 = await verifyEndorsementPolicy(prop3, baseManifest, headManifest, collectiveId);
    console.log('Test 3 (Alice+Charlie w=2):', !res3.approved ? '✅ PASS' : '❌ FAIL');
    console.log(`   Reason: ${res3.reason}`);

    // 5. Scenario 4: Wrong Owner Context (Global Policy Fallback)
    // If we pass an arbitrary user ID, it should fall back to Global Policy.
    // Global Policy for High Risk = 3 signatures.
    // Alice + Bob = 2 signatures.
    // So this should FAIL (Global Policy) whereas Test 2 PASSED (Collective Policy).
    const res4 = await verifyEndorsementPolicy(prop2, baseManifest, headManifest, 'did:key:someuser');
    console.log('Test 4 (Fallback to Global Policy 3 sigs):', !res4.approved ? '✅ PASS' : '❌ FAIL');
    console.log(`   Reason: ${res4.reason}`);

})();
