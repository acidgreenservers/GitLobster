const { getManifest, mergeProposal } = require('../utils/git-ops');
const { verifyEndorsementPolicy } = require('../utils/endorsement-policy');

/**
 * Attempt to auto-merge a proposal.
 * @param {string} repoName - The repository name (e.g. 'user/repo.git')
 * @param {Object} proposal - The Merge Proposal object
 */
async function processMergeProposal(repoName, proposal) {
    try {
        console.log(`[AutoMerge] Processing proposal ${proposal.id} for ${repoName}`);

        // 1. Fetch Manifests (Base vs Head)
        // We use the refs from the proposal target
        const baseRef = proposal.target.base_ref; // e.g. refs/heads/main
        const headRef = proposal.target.head_ref; // e.g. refs/heads/feature/x

        const baseManifest = await getManifest(repoName, baseRef);
        const headManifest = await getManifest(repoName, headRef);

        if (!baseManifest) {
            console.warn(`[AutoMerge] Base manifest missing for ${baseRef}. Assuming empty permissions.`);
        }
        if (!headManifest) {
            console.warn(`[AutoMerge] Head manifest missing for ${headRef}. Assuming empty permissions.`);
        }

        // 2. Verify Policy
        // Assume repoName format "namespace/repo.git"
        const repoOwnerId = repoName.split('/')[0];
        const policyResult = await verifyEndorsementPolicy(proposal, baseManifest, headManifest, repoOwnerId);

        if (!policyResult.approved) {
            console.log(`[AutoMerge] ⛔ REJECTED: ${policyResult.reason}`);
            return {
                status: 'REJECTED',
                reason: policyResult.reason,
                impact: policyResult.impact
            };
        }

        console.log(`[AutoMerge] ✅ APPROVED: ${policyResult.reason}`);
        console.log(`[AutoMerge] Executing git merge...`);

        // 3. Execute Merge
        const newCommitHash = await mergeProposal(
            repoName,
            baseRef.replace('refs/heads/', ''),
            headRef.replace('refs/heads/', ''),
            proposal.id
        );

        console.log(`[AutoMerge] 🚀 MERGED! New HEAD: ${newCommitHash}`);

        return {
            status: 'MERGED',
            commit: newCommitHash,
            impact: policyResult.impact
        };

    } catch (error) {
        console.error(`[AutoMerge] 💥 ERROR: ${error.message}`);
        return {
            status: 'ERROR',
            reason: error.message
        };
    }
}

module.exports = { processMergeProposal };
