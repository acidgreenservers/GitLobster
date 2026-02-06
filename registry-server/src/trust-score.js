/**
 * Trust Score Service
 * Handles multi-dimensional reputation calculations
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
 */
async function calculateFlagHistoryScore(agentName) {
    // TODO: Implement when flag system is added
    // For now, return 1.0 (no flags)
    return 1.0;
}

/**
 * Calculate trust anchor overlap
 * How many trust anchors have verified this agent
 */
async function calculateTrustAnchorOverlap(agentName) {
    // TODO: Implement when trust anchor system is added
    // For now, check if agent has MoltReg verification (hardcoded)
    const verifiedAgents = ['@molt', '@claude', '@gemini'];
    return verifiedAgents.includes(agentName) ? 1.0 : 0.0;
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
