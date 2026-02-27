const db = require('../../db');
const { verifyPackageSignature } = require('../../auth');
const { logActivity } = require('../../activity');

async function botkitStar(agentName, package_name, signature) {
    const pkg = await db('packages').where({ name: package_name }).first();
    if (!pkg) {
        throw { statusCode: 404, error: 'package_not_found' };
    }

    const agent = await db('agents').where({ name: agentName }).first();
    if (!agent || !agent.public_key) {
        throw { statusCode: 404, error: 'agent_not_found_or_no_public_key' };
    }

    const message = `star:${package_name}`;
    const isValid = verifyPackageSignature(message, signature, agent.public_key);
    if (!isValid) {
        throw { statusCode: 400, error: 'invalid_signature' };
    }

    const existingEndorsement = await db('endorsements')
        .where({ package_name, signer_name: agentName, endorsement_type: 'star' })
        .first();

    if (existingEndorsement) {
        return {
            statusCode: 200,
            data: { status: 'already_starred', message: 'You already starred this package via botkit' }
        };
    }

    await db('endorsements').insert({
        package_name, signer_name: agentName, signer_type: 'agent',
        comment: 'Agent-verified star via botkit', signature, trust_level: 1,
        endorsement_type: 'star', created_at: db.fn.now()
    });

    await db('packages').where({ name: package_name }).increment({ agent_stars: 1, stars: 1 });
    const updatedPkg = await db('packages').where({ name: package_name }).first();

    await logActivity('star', agentName, package_name, 'package', { via: 'botkit' });

    return {
        statusCode: 201,
        data: {
            status: 'starred', total_stars: updatedPkg.stars || 0,
            agent_stars: updatedPkg.agent_stars || 0,
            message: 'Package starred and cryptographically verified'
        }
    };
}

async function botkitUnstar(agentName, package_name) {
    const deleted = await db('endorsements')
        .where({ package_name, signer_name: agentName, endorsement_type: 'star' })
        .delete();

    if (deleted === 0) {
        throw { statusCode: 404, error: 'not_starred' };
    }

    await db('packages').where({ name: package_name }).decrement({ agent_stars: 1, stars: 1 });
    const pkg = await db('packages').where({ name: package_name }).first();

    await logActivity('unstar', agentName, package_name, 'package', { via: 'botkit' });

    return {
        statusCode: 200,
        data: { status: 'unstarred', total_stars: pkg.stars || 0, agent_stars: pkg.agent_stars || 0 }
    };
}

module.exports = {
    botkitStar,
    botkitUnstar
};
