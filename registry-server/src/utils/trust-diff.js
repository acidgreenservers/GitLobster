/**
 * GitLobster Trust-Aware Diff Engine
 * Calculates the semantic difference between two permission sets.
 */

// Risk weights for different permission types
const RISK_SCORES = {
    'network': 3,    // High risk: Exfiltration
    'filesystem': 2, // Medium risk: Local state
    'env': 2,        // Medium risk: Secrets
    'shell': 3,      // High risk: RCE
    'ffi': 3         // High risk: Native code
};

/**
 * Calculates the permission delta between base and head.
 * @param {Object} basePerms - Permissions in the base branch (manifest.json)
 * @param {Object} headPerms - Permissions in the head branch (manifest.json)
 * @returns {Object} { added, removed, modified, riskScore }
 */
function calculatePermissionDiff(basePerms = {}, headPerms = {}) {
    const diff = {
        added: [],
        removed: [],
        modified: [],
        riskScore: 0
    };

    // Helper to flatten permissions into strings "network:outbound:google.com"
    const flatten = (perms, prefix = '') => {
        let items = [];
        for (const [key, value] of Object.entries(perms)) {
            if (Array.isArray(value)) {
                value.forEach(v => items.push(`${prefix}${key}:${v}`));
            } else if (typeof value === 'object' && value !== null) {
                items = items.concat(flatten(value, `${prefix}${key}:`));
            }
        }
        return items;
    };

    const baseSet = new Set(flatten(basePerms));
    const headSet = new Set(flatten(headPerms));

    // Calculate Added
    for (const perm of headSet) {
        if (!baseSet.has(perm)) {
            diff.added.push(perm);
            const category = perm.split(':')[0];
            diff.riskScore += (RISK_SCORES[category] || 1);
        }
    }

    // Calculate Removed
    for (const perm of baseSet) {
        if (!headSet.has(perm)) {
            diff.removed.push(perm);
            // Removing permissions does not increase risk, but counts as a change
        }
    }

    // Determine Overall Impact Level
    let impact = 'NONE';
    if (diff.added.length > 0 || diff.removed.length > 0) {
        if (diff.riskScore >= 3) impact = 'HIGH';
        else if (diff.riskScore > 0) impact = 'MEDIUM';
        else impact = 'LOW';
    }

    return { ...diff, impact };
}

module.exports = { calculatePermissionDiff };
