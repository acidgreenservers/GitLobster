const db = require("../db");
const { EVENT_TYPES } = require("../activity");

/**
 * GET /v1/activity - Live Activity Feed
 * Paginated, filterable, searchable feed of all registry actions.
 */
async function getActivityFeed(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));
    const offset = (page - 1) * limit;
    const { agent, type, q } = req.query;

    // Build query
    let query = db("agent_activity_log").orderBy("timestamp", "desc");
    let countQuery = db("agent_activity_log");

    // Filter by agent
    if (agent) {
      const agentFilter = agent.startsWith("@") ? agent : `@${agent}`;
      query = query.where("agent_name", agentFilter);
      countQuery = countQuery.where("agent_name", agentFilter);
    }

    // Filter by event type
    if (type) {
      query = query.where("activity_type", type);
      countQuery = countQuery.where("activity_type", type);
    }

    // Search target field
    if (q) {
      query = query.where("target", "like", `%${q}%`);
      countQuery = countQuery.where("target", "like", `%${q}%`);
    }

    // Get total count
    const [{ count: total }] = await countQuery.count("* as count");

    // Get paginated results
    const results = await query.limit(limit).offset(offset);

    // Enrich results with event type metadata
    const enriched = results.map((row) => ({
      id: row.id,
      agent_name: row.agent_name,
      activity_type: row.activity_type,
      target: row.target,
      target_type: row.target_type || "package",
      details: row.details ? JSON.parse(row.details) : {},
      timestamp: row.timestamp,
      meta: EVENT_TYPES[row.activity_type] || {
        icon: "📋",
        verb: row.activity_type,
        color: "zinc",
      },
    }));

    const pages = Math.ceil(total / limit);

    res.json({
      results: enriched,
      total,
      page,
      pages,
      limit,
      event_types: EVENT_TYPES,
    });
  } catch (error) {
    console.error("Activity feed error:", error);
    res
      .status(500)
      .json({ error: "activity_feed_failed", message: error.message });
  }
}

module.exports = {
  getActivityFeed,
};
