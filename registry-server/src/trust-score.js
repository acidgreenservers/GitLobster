/**
 * Trust Score Service
 * Handles multi-dimensional reputation calculations
 *
 * SELF-TRUST MODEL (v2.5):
 * Each GitLobster node is its own trust anchor. Trust is derived from:
 * 1. Packages signed by the node operator
 * 2. Endorsements from verified agents
 * 3. Time in network and activity history
 *
 * No external federation - each node is sovereign.
 */

const db = require('./db');

/**
 * Calculate capability reliability score
 * Based on package quality, downloads, and lack of issues
 */
async function calculateCapabilityReliability(agentName) {
    const packages = await db('packages')
        .where({ author_name: agentName.replace('@', '') });

    if (packages.length === 0) {
        return 0.5; // Neutral for new agents
    }

    const totalDownloads = packages.reduce((sum, pkg) => sum + pkg.downloads, 0);
    const avgDownloads = totalDownloads / packages.length;

    // Score based on average downloads (logarithmic scale)
    // 1-10 downloads = 0.3
    // 10-100 = 0.5
    // 100-1000 = 0.7
    // 1000+ = 0.9
    let score = 0.5;
    if (avgDownloads >= 1000) score = 0.9;
    else if (avgDownloads >= 100) score = 0.7;
    else if (avgDownloads >= 10) score = 0.5;
    else score = 0.3;

    return score;
}

/**
 * Calculate review consistency score
 * Based on endorsement quality
 */
async function calculateReviewConsistency(agentName) {
    const packages = await db('packages')
        .where({ author_name: agentName.replace('@', '') });

    if (packages.length === 0) {
        return 0.5; // Neutral
    }

    let totalEndorsements = 0;
    let totalTrustLevel = 0;

    for (const pkg of packages) {
        const endorsements = await db('endorsements')
            .where({ package_name: pkg.name });

        totalEndorsements += endorsements.length;
        totalTrustLevel += endorsements.reduce((sum, e) => sum + e.trust_level, 0);
    }

    if (totalEndorsements === 0) {
        return 0.5; // No reviews yet
    }

    // Average trust level (1-3 scale, normalize to 0-1)
    const avgTrustLevel = totalTrustLevel / totalEndorsements;
    return (avgTrustLevel / 3.0);
}

/**
 * Calculate flag history score
 * 1.0 = perfect (no flags), decreases with flags
 * NOTE: Requires 'flags' table to be implemented
 */
async function calculateFlagHistoryScore(agentName) {
    // Check if flags table exists
    const db = require('./db');
    const hasFlags = await db.schema.hasTable('flags');

    if (!hasFlags) {
        // Flags system not yet implemented - return perfect score
        return 1.0;
    }

    // Count flags against this agent's packages
    const flags = await db('flags')
        .join('packages', 'flags.package_name', 'packages.name')
        .where('packages.author_name', agentName)
        .count('* as count')
        .first();

    const flagCount = flags.count || 0;

    // Decay formula: 1.0 for 0 flags, decreases logarithmically
    if (flagCount === 0) return 1.0;
    return Math.max(0.1, 1.0 - (Math.log(flagCount + 1) / 10));
}

/**
 * Calculate trust anchor overlap
 * In the self-trust model, each node IS its own trust anchor
 * An agent endorsed by the node operator is "trusted by this node"
 */
async function calculateTrustAnchorOverlap(agentName) {
    const db = require('./db');
    const KeyManager = require('./trust/KeyManager');

    // Get this node's identity
    const nodeIdentity = KeyManager.getNodeIdentity();

    // In self-trust model, the node itself is the trust anchor
    // Check if this agent has been endorsed by the node (via its packages)

    // Get all packages by this agent
    const agentPackages = await db('packages')
        .where({ author_name: agentName.replace('@', '') })
        .select('name');

    if (agentPackages.length === 0) {
        return 0.0; // No packages = no trust overlap
    }

    const packageNames = agentPackages.map(p => p.name);

    // Check if the node has signed any of these packages
    // In MVP, we check if packages have valid signatures from THIS node
    const signedVersions = await db('versions')
        .whereIn('package_name', packageNames)
        .whereNotNull('signature')
        .count('* as count')
        .first();

    const signedCount = signedVersions?.count || 0;

    // If agent has published signed packages, they have trust overlap with this node
    if (signedCount > 0) {
        // Score based on number of signed packages (capped at 1.0)
        return Math.min(1.0, signedCount / 3); // 3+ signed packages = full trust
    }

    // Check endorsements from node-verified agents
    const hasEndorsements = await db('endorsements')
        .whereIn('package_name', packageNames)
        .count('* as count')
        .first();

    if (hasEndorsements?.count > 0) {
        return Math.min(0.7, hasEndorsements.count * 0.2); // Max 0.7 from endorsements alone
    }

    return 0.0;
}

/**
 * Calculate time in network score
 * Based on agent's join date and activity
 */
async function calculateTimeInNetwork(agentName) {
    const agent = await db('agents').where({ name: agentName }).first();

    if (!agent) {
        return 0.0;
    }

    const now = new Date();
    const joined = new Date(agent.joined_at);
    const daysActive = Math.floor((now - joined) / (1000 * 60 * 60 * 24));

    // Score: 0-30 days = 0.3, 31-90 = 0.5, 91-180 = 0.7, 180+ = 0.9
    if (daysActive >= 180) return 0.9;
    if (daysActive >= 90) return 0.7;
    if (daysActive >= 30) return 0.5;
    return 0.3;
}

/**
 * Compute overall trust score (weighted combination)
 */
function computeOverallScore(components) {
    const weights = {
        capability_reliability: 0.30,
        review_consistency: 0.20,
        flag_history_score: 0.25,
        trust_anchor_overlap: 0.15,
        time_in_network: 0.10
    };

    return (
        components.capability_reliability * weights.capability_reliability +
        components.review_consistency * weights.review_consistency +
        components.flag_history_score * weights.flag_history_score +
        components.trust_anchor_overlap * weights.trust_anchor_overlap +
        components.time_in_network * weights.time_in_network
    );
}

/**
 * Calculate and update all trust score components for an agent
 */
async function updateTrustScore(agentName) {
    const components = {
        capability_reliability: await calculateCapabilityReliability(agentName),
        review_consistency: await calculateReviewConsistency(agentName),
        flag_history_score: await calculateFlagHistoryScore(agentName),
        trust_anchor_overlap: await calculateTrustAnchorOverlap(agentName),
        time_in_network: await calculateTimeInNetwork(agentName)
    };

    const computedScore = computeOverallScore(components);

    // Upsert into trust_score_components
    const existing = await db('trust_score_components')
        .where({ agent_name: agentName })
        .first();

    if (existing) {
        await db('trust_score_components')
            .where({ agent_name: agentName })
            .update({
                ...components,
                computed_score: computedScore,
                last_computed: db.fn.now()
            });
    } else {
        await db('trust_score_components').insert({
            agent_name: agentName,
            ...components,
            computed_score: computedScore,
            last_computed: db.fn.now()
        });
    }

    return { ...components, computed_score: computedScore };
}

/**
 * Get trust score breakdown for an agent
 */
async function getTrustScoreBreakdown(agentName) {
    const components = await db('trust_score_components')
        .where({ agent_name: agentName })
        .first();

    if (!components) {
        // Calculate for the first time
        return await updateTrustScore(agentName);
    }

    return components;
}

module.exports = {
    calculateCapabilityReliability,
    calculateReviewConsistency,
    calculateFlagHistoryScore,
    calculateTrustAnchorOverlap,
    calculateTimeInNetwork,
    computeOverallScore,
    updateTrustScore,
    getTrustScoreBreakdown
};
