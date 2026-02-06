/**
 * Identity Service
 * Handles cryptographic identity tracking and key continuity
 */

const db = require('./db');
const crypto = require('crypto');

/**
 * Get key fingerprint from public key
 */
function getKeyFingerprint(publicKey) {
    const cleanKey = publicKey.replace(/^ed25519:/, '');
    return cleanKey.substring(0, 12);
}

/**
 * Calculate key age in days
 */
function getKeyAge(firstSeen) {
    const now = new Date();
    const start = new Date(firstSeen);
    const diffMs = now - start;
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Track or update identity key usage
 */
async function trackIdentityKey(agentName, publicKey) {
    const fingerprint = getKeyFingerprint(publicKey);

    // Check if key exists
    const existing = await db('identity_keys')
        .where({ public_key: publicKey })
        .first();

    if (existing) {
        // Update last_used timestamp
        await db('identity_keys')
            .where({ public_key: publicKey })
            .update({ last_used: db.fn.now() });

        return existing;
    } else {
        // New key - insert
        await db('identity_keys').insert({
            agent_name: agentName,
            public_key: publicKey,
            key_fingerprint: fingerprint,
            first_seen: db.fn.now(),
            last_used: db.fn.now(),
            is_active: true
        });

        return await db('identity_keys')
            .where({ public_key: publicKey })
            .first();
    }
}

/**
 * Check key continuity for an agent
 */
async function checkKeyContinuity(agentName) {
    const keys = await db('identity_keys')
        .where({ agent_name: agentName })
        .orderBy('first_seen', 'asc');

    if (keys.length === 0) {
        return { status: 'no_keys', continuity_score: 0.0 };
    }

    if (keys.length === 1 && keys[0].is_active) {
        return {
            status: 'stable',
            continuity_score: 1.0,
            primary_key: keys[0]
        };
    }

    // Multiple keys - check for revocations
    const activeKeys = keys.filter(k => k.is_active);

    if (activeKeys.length > 1) {
        // Multiple active keys - potential issue
        return {
            status: 'multiple_active',
            continuity_score: 0.5,
            warning: 'Agent has multiple active keys'
        };
    }

    // Has revoked keys but only one active - normal rotation
    return {
        status: 'rotated',
        continuity_score: 0.8,
        primary_key: activeKeys[0],
        revoked_count: keys.length - 1
    };
}

/**
 * Get identity metadata for profile
 */
async function getIdentityMetadata(agentName) {
    const continuity = await checkKeyContinuity(agentName);

    if (!continuity.primary_key) {
        return {
            keyFingerprint: null,
            keyAge: 0,
            continuity: continuity.status,
            continuityScore: continuity.continuity_score
        };
    }

    const keyAge = getKeyAge(continuity.primary_key.first_seen);

    return {
        keyFingerprint: continuity.primary_key.key_fingerprint,
        fullPublicKey: continuity.primary_key.public_key,
        keyAge: keyAge,
        continuity: continuity.status,
        continuityScore: continuity.continuity_score,
        firstSeen: continuity.primary_key.first_seen,
        lastUsed: continuity.primary_key.last_used
    };
}

module.exports = {
    getKeyFingerprint,
    getKeyAge,
    trackIdentityKey,
    checkKeyContinuity,
    getIdentityMetadata
};
