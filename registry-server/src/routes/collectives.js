const crypto = require('crypto');
const nacl = require('tweetnacl');
const { decodeBase64 } = require('tweetnacl-util');
const { saveCollective, getCollective, verifyGovernanceThreshold } = require('../collectives/registry');

/**
 * GET /v1/collectives/:id
 */
async function get(req, res) {
    try {
        const { id } = req.params;
        const collective = await getCollective(id);

        if (!collective) {
            return res.status(404).json({ error: 'not_found', message: 'Collective not found' });
        }

        res.json(collective);
    } catch (error) {
        console.error('Get Collective Error:', error);
        res.status(500).json({ error: 'internal_error', message: error.message });
    }
}

/**
 * POST /v1/collectives
 * Body: { manifest: { ... } }
 * Requires Authentication.
 */
async function create(req, res) {
    try {
        const { manifest } = req.body;
        const agent = req.agent; // Populated by requireAuth middleware

        if (!manifest) {
            return res.status(400).json({ error: 'missing_manifest', message: 'Manifest is required' });
        }

        // 1. Verify that the Creator (authenticated agent) is an ADMIN in the new collective
        // This prevents creating DAOs you don't control (spam).
        const members = manifest.governance?.members || [];
        const creatorMember = members.find(m => m.id === agent.publicKey);

        if (!creatorMember || creatorMember.role !== 'admin') {
            return res.status(403).json({
                error: 'permission_denied',
                message: 'Creator must be an initial Admin of the Collective'
            });
        }

        // 2. Save
        // Note: Ideally we verify a cryptographic signature on the manifest itself here.
        // For MVP, we trust the authenticated POST.

        await saveCollective(manifest);

        res.status(201).json({
            message: 'Collective created',
            id: manifest.id
        });

    } catch (error) {
        console.error('Create Collective Error:', error);
        res.status(500).json({ error: 'internal_error', message: error.message });
    }
}

/**
 * PUT /v1/collectives/:id
 * Body: { newManifest: { ... }, endorsements: [ { agent_id, signature } ] }
 * Updates the collective ONLY if the threshold of EXISTING members approve.
 */
async function update(req, res) {
    try {
        const { id } = req.params;
        const { newManifest, endorsements } = req.body;

        if (!newManifest || newManifest.id !== id) {
            return res.status(400).json({ error: 'invalid_manifest', message: 'Manifest ID must match URL' });
        }

        const currentCollective = await getCollective(id);
        if (!currentCollective) {
            return res.status(404).json({ error: 'not_found', message: 'Collective not found' });
        }

        // 1. Calculate Hash of the New Manifest
        const manifestString = JSON.stringify(newManifest);
        const hash = crypto.createHash('sha256').update(manifestString).digest('hex');
        const message = `update:${id}:${hash}`; // What they signed

        // 2. Verify Signatures
        const validEndorsers = [];
        const messageBytes = Buffer.from(message, 'utf8');

        if (Array.isArray(endorsements)) {
            for (const endorsement of endorsements) {
                try {
                    let pubKey = endorsement.agent_id;
                    if (pubKey.startsWith('did:key:')) { /* decode did */ } // simplified
                    else if (pubKey.startsWith('ed25519:')) { pubKey = pubKey.replace('ed25519:', ''); }

                    const pubKeyBytes = decodeBase64(pubKey);
                    const sigBytes = decodeBase64(endorsement.signature);

                    if (nacl.sign.detached.verify(messageBytes, sigBytes, pubKeyBytes)) {
                        validEndorsers.push(endorsement.agent_id);
                    }
                } catch (e) {
                    console.warn('Invalid sig in update:', e);
                }
            }
        }

        // 3. Check Governance (using CURRENT collective rules)
        const passed = await verifyGovernanceThreshold(id, validEndorsers);

        if (!passed) {
            return res.status(403).json({
                error: 'governance_failed',
                message: `Update rejected. Insufficient endorsements from existing members.`
            });
        }

        // 4. Save
        await saveCollective(newManifest);

        res.json({
            message: 'Collective updated',
            id: id,
            version: newManifest.updated_at
        });

    } catch (error) {
        console.error('Update Collective Error:', error);
        res.status(500).json({ error: 'internal_error', message: error.message });
    }
}

module.exports = { get, create, update };
