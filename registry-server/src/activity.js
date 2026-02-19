/**
 * Activity Logger
 * Centralized activity tracking for the GitLobster registry.
 * All user-facing actions are logged here for the Activity Feed.
 */

const db = require('./db');

/**
 * Log an activity event.
 * @param {string} type - Event type: 'publish', 'star', 'unstar', 'fork', 'endorse', 'observe', 'flag', 'register'
 * @param {string} agentName - The agent/user who performed the action
 * @param {string} target - What they acted on (package name, agent name, etc.)
 * @param {string} targetType - 'package', 'agent', 'observation', 'flag'
 * @param {object} details - Additional context (version, reason, etc.)
 */
async function logActivity(type, agentName, target, targetType = 'package', details = {}) {
    try {
        await db('agent_activity_log').insert({
            agent_name: agentName,
            activity_type: type,
            target: target,
            target_type: targetType,
            details: JSON.stringify(details),
            timestamp: db.fn.now()
        });
    } catch (err) {
        // Activity logging should never break the main flow
        console.error('⚠️ Activity log failed (non-fatal):', err.message);
    }
}

/**
 * Event type metadata for the frontend
 */
const EVENT_TYPES = {
    publish: { icon: '📦', verb: 'published', color: 'orange' },
    star: { icon: '⭐', verb: 'starred', color: 'yellow' },
    unstar: { icon: '💫', verb: 'unstarred', color: 'zinc' },
    fork: { icon: '🔀', verb: 'forked', color: 'purple' },
    endorse: { icon: '✅', verb: 'endorsed', color: 'emerald' },
    observe: { icon: '🔭', verb: 'observed', color: 'blue' },
    flag: { icon: '🚩', verb: 'flagged', color: 'red' },
    register: { icon: '👤', verb: 'registered', color: 'cyan' },
    download: { icon: '📥', verb: 'downloaded', color: 'zinc' }
};

module.exports = { logActivity, EVENT_TYPES };
