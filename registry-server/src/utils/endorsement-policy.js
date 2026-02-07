const nacl = require('tweetnacl');
const { decodeBase64 } = require('tweetnacl-util');
const { calculatePermissionDiff } = require('./trust-diff');
const { verifyGovernanceThreshold, getCollective } = require('../collectives/registry');

// Trust Impact Thresholds (Default Global Policy)
const GLOBAL_REQUIREMENTS = {
    'HIGH': { min_endorsements: 3, description: 'Requires 3 independent signatures' },
    'MEDIUM': { min_endorsements: 2, description: 'Requires 2 independent signatures' },
    'LOW': { min_endorsements: 1, description: 'Requires 1 peer review' },
    'NONE': { min_endorsements: 0, description: 'Author only' }
};

/**
 * Verifies if a Merge Proposal meets the endorsement policy.
 * @param {Object} proposal - The full MergeProposal JSON object
 * @param {Object} baseManifest - The manifest of the target branch
 * @param {Object} headManifest - The manifest of the incoming branch
 * @param {string} [repoOwnerId] - Optional: The DID of the repo owner (User or Collective)
 * @returns {Object} { approved: boolean, reason: string, missing: number }
 */
async function verifyEndorsementPolicy(proposal, baseManifest, headManifest, repoOwnerId) {
    // 1. Calculate Trust Impact
    const diff = calculatePermissionDiff(
        baseManifest ? baseManifest.permissions : {},
        headManifest ? headManifest.permissions : {}
    );

    const impact = diff.impact;

    // 2. Validate Signatures First
    // We only care about VALID signatures from here on.
    const validSigners = [];
    if (proposal.endorsements) {
        for (const endorsement of proposal.endorsements) {
            if (verifyEndorsementSignature(proposal, endorsement)) {
                validSigners.push(endorsement.agent_id);
            } else {
                console.warn(`Invalid signature from ${endorsement.agent_id}`);
            }
        }
    }

    const uniqueSigners = [...new Set(validSigners)];

    // 3. Determine Requirements based on Ownership
    let approved = false;
    let reason = "";
    let requiredCount = 0;
    let actualCount = uniqueSigners.length;

    // Check if Owner is a Collective
    let isCollective = false;
    if (repoOwnerId && repoOwnerId.startsWith('did:gitlobster:collective:')) {
        const collective = await getCollective(repoOwnerId);
        if (collective) {
            isCollective = true;
            // Collective Policy: Must meet the collective's threshold using member weights
            // For now, we assume the collective's threshold applies to ALL changes, 
            // OR we could scale it based on impact. 
            // MVP: Use the collective's defined threshold for any change > LOW.

            if (impact === 'NONE') {
                approved = true;
                reason = "No impact change.";
            } else {
                // If impact is HIGH, maybe require strictly the threshold.
                // If impact is LOW, maybe allow 1 member?
                // Let's defer to the verifyGovernanceThreshold function which sums weights.
                // We pass ALL valid signers. The registry checks who is a member.

                const passed = await verifyGovernanceThreshold(repoOwnerId, uniqueSigners);

                // We also need to report "count" in a meaningful way. 
                // Since it's weight-based, "actualCount" is less relevant than "actualWeight".
                // But for the return interface consistency, we'll keep simple bool for now.

                approved = passed;
                requiredCount = collective.governance.threshold;
                reason = passed
                    ? `Approved by Collective ${collective.name} (Threshold ${requiredCount} met).`
                    : `Rejected by Collective ${collective.name} (Threshold ${requiredCount} NOT met).`;
            }
        }
    }

    // Fallback to Global Policy (Individual Owner or Unknown Collective)
    if (!isCollective) {
        requiredCount = GLOBAL_REQUIREMENTS[impact].min_endorsements;
        approved = actualCount >= requiredCount;
        reason = approved
            ? `Approved: ${actualCount}/${requiredCount} endorsements for ${impact} risk.`
            : `Rejected: Needs ${requiredCount} endorsements for ${impact} risk (has ${actualCount}).`;
    }

    return {
        approved,
        impact,
        riskScore: diff.riskScore,
        required: requiredCount,
        actual: actualCount,
        missing: Math.max(0, requiredCount - actualCount),
        reason
    };
}

/**
 * Verify individual Ed25519 signature on an endorsement.
 * The signature covers the proposal ID + verdict.
 */
function verifyEndorsementSignature(proposal, endorsement) {
    try {
        const message = `${proposal.id}:${endorsement.verdict}`;
        const messageBytes = Buffer.from(message, 'utf8');

        // Simplified key extraction (same as before)
        let pubKey = endorsement.agent_id;
        if (pubKey.startsWith('did:key:')) {
            // ... logic to extract key ...
        } else if (pubKey.startsWith('ed25519:')) {
            pubKey = pubKey.replace('ed25519:', '');
        }

        const signatureBytes = decodeBase64(endorsement.signature);
        const pubKeyBytes = decodeBase64(pubKey);

        return nacl.sign.detached.verify(messageBytes, signatureBytes, pubKeyBytes);
    } catch (e) {
        console.error('Signature check failed:', e);
        return false;
    }
}

module.exports = { verifyEndorsementPolicy, verifyEndorsementSignature };
