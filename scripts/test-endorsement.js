const nacl = require('tweetnacl');
const { encodeBase64 } = require('tweetnacl-util');
const { verifyEndorsementPolicy } = require('./registry-server/src/utils/endorsement-policy');

// 1. Setup Mock Data
const baseManifest = { permissions: { network: { outbound: ['google.com'] } } };
const headHighRisk = { permissions: { network: { outbound: ['google.com', 'openai.com'] } } }; // High Risk (Added network)
const headLowRisk = { permissions: { network: { outbound: ['google.com'] }, version: "1.0.1" } }; // Low Risk (Version bump only)

// 2. key Generation Helper
function createAgent(name) {
    const keyPair = nacl.sign.keyPair();
    return {
        name,
        publicKey: encodeBase64(keyPair.publicKey),
        secretKey: keyPair.secretKey
    };
}

const alice = createAgent('Alice');
const bob = createAgent('Bob');
const charlie = createAgent('Charlie');

// 3. Signing Helper
function signProposal(proposalId, verdict, agent) {
    const message = `${proposalId}:${verdict}`;
    const messageBytes = Buffer.from(message, 'utf8');
    const signature = nacl.sign.detached(messageBytes, agent.secretKey);
    return {
        agent_id: agent.publicKey,
        role: 'REVIEWER',
        verdict: verdict,
        signature: encodeBase64(signature)
    };
}

console.log('--- Testing Endorsement Policy ---\n');

// Test 1: Low Risk (Needs 1 endorsement)
const proposalLow = {
    id: 'prop-low-1',
    endorsements: [signProposal('prop-low-1', 'APPROVE', alice)]
};

const resultLow = verifyEndorsementPolicy(proposalLow, baseManifest, headLowRisk);
console.log('Test 1 (Low Risk - 1 Sig):', resultLow.approved ? '✅ PASS' : '❌ FAIL');
console.log(`   Expected: LOW impact, 1 required. Got: ${resultLow.actual}`);

// Test 2: High Risk (Needs 3 endorsements) - Fail case
const proposalHighFail = {
    id: 'prop-high-1',
    endorsements: [
        signProposal('prop-high-1', 'APPROVE', alice),
        signProposal('prop-high-1', 'APPROVE', bob)
    ]
};

const resultHighFail = verifyEndorsementPolicy(proposalHighFail, baseManifest, headHighRisk);
console.log('\nTest 2 (High Risk - 2 Sigs):', !resultHighFail.approved ? '✅ PASS' : '❌ FAIL');
console.log(`   Expected: HIGH impact, 3 required. Got: ${resultHighFail.actual}. Result: Rejected.`);


// Test 3: High Risk (Needs 3 endorsements) - Success case
const proposalHighPass = {
    id: 'prop-high-2',
    endorsements: [
        signProposal('prop-high-2', 'APPROVE', alice),
        signProposal('prop-high-2', 'APPROVE', bob),
        signProposal('prop-high-2', 'APPROVE', charlie)
    ]
};

const resultHighPass = verifyEndorsementPolicy(proposalHighPass, baseManifest, headHighRisk);
console.log('\nTest 3 (High Risk - 3 Sigs):', resultHighPass.approved ? '✅ PASS' : '❌ FAIL');
console.log(`   Expected: HIGH impact, 3 required. Got: ${resultHighPass.actual}. Result: Approved.`);


// Test 4: Invalid Signature
const badSig = signProposal('prop-high-2', 'APPROVE', alice);
badSig.signature = encodeBase64(new Uint8Array(64)); // Zeroed signature

const proposalBadSig = {
    id: 'prop-high-2', // Reusing ID but bad sig
    endorsements: [badSig, signProposal('prop-high-2', 'APPROVE', bob), signProposal('prop-high-2', 'APPROVE', charlie)]
};

const resultBadSig = verifyEndorsementPolicy(proposalBadSig, baseManifest, headHighRisk);
console.log('\nTest 4 (Bad Signature):', !resultBadSig.approved ? '✅ PASS' : '❌ FAIL');
console.log(`   Expected: HIGH impact, 3 required. Got: ${resultBadSig.actual} (1 invalid). Result: Rejected.`);

console.log('\n--- End Tests ---');
