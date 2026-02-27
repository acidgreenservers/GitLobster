const express = require('express');
const router = express.Router();
const starService = require('./star.service');
const forkService = require('./fork.service');
const { requireAuth } = require('../../auth');

// POST /v1/botkit/star
router.post('/star', requireAuth, async (req, res) => {
    try {
        const { package_name, signature } = req.body;
        if (!req.auth?.payload?.sub) {
            return res.status(401).json({ error: 'authentication_required' });
        }
        const agentName = req.auth.payload.sub;

        const result = await starService.botkitStar(agentName, package_name, signature);
        res.status(result.statusCode).json(result.data);
    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({ error: error.error, message: error.message });
        }
        console.error('Botkit star error:', error);
        res.status(500).json({ error: 'botkit_star_failed', message: error.message });
    }
});

// DELETE /v1/botkit/star
router.delete('/star', requireAuth, async (req, res) => {
    try {
        const { package_name } = req.body;
        if (!req.auth?.payload?.sub) {
            return res.status(401).json({ error: 'authentication_required' });
        }
        const agentName = req.auth.payload.sub;

        const result = await starService.botkitUnstar(agentName, package_name);
        res.status(result.statusCode).json(result.data);
    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({ error: error.error, message: error.message });
        }
        res.status(500).json({ error: 'botkit_unstar_failed', message: error.message });
    }
});

// POST /v1/botkit/fork
router.post('/fork', requireAuth, async (req, res) => {
    try {
        const { parent_package, forked_package, fork_reason, signature } = req.body;
        if (!req.auth?.payload?.sub) {
            return res.status(401).json({ error: 'authentication_required' });
        }
        const agentName = req.auth.payload.sub;

        if (!parent_package || !forked_package || !fork_reason || !signature) {
            return res.status(400).json({
                error: 'invalid_request',
                message: 'Missing required fields: parent_package, forked_package, fork_reason, signature'
            });
        }

        const reqProtocol = req.protocol;
        const reqHost = req.get('host');

        const result = await forkService.botkitFork(
            agentName, parent_package, forked_package, fork_reason, signature, reqProtocol, reqHost
        );
        res.status(result.statusCode).json(result.data);
    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({ error: error.error, message: error.message });
        }
        console.error('Botkit fork error:', error);
        res.status(500).json({ error: 'botkit_fork_failed', message: error.message });
    }
});

module.exports = router;
