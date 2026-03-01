const db = require("../db");
const { logActivity } = require("../activity");

/**
 * POST /v1/packages/:name/star - Star/favorite a package
 * Public endpoint - no authentication required (social feature for humans)
 */
async function starPackage(req, res) {
  try {
    const { name } = req.params;
    const { user_id } = req.body; // Browser-generated unique ID for anonymous users

    // Check if package exists
    const pkg = await db("packages").where({ name }).first();
    if (!pkg) {
      return res.status(404).json({ error: "package_not_found" });
    }

    // Use authenticated agent name if available, otherwise use anonymous user_id
    const identifier = req.auth?.payload?.sub || user_id || "anonymous";

    // Check if already starred
    const existing = await db("stars")
      .where({ agent_name: identifier, package_name: name })
      .first();

    if (existing) {
      return res.status(200).json({
        status: "already_starred",
        starred_at: existing.starred_at,
        total_stars: pkg.stars || 0,
      });
    }

    // Insert star record
    await db("stars").insert({
      agent_name: identifier,
      package_name: name,
      starred_at: db.fn.now(),
    });

    // Increment star count on package
    await db("packages").where({ name }).increment("stars", 1);

    // Get updated count
    const updatedPkg = await db("packages").where({ name }).first();

    // Log activity
    await logActivity("star", identifier, name, "package");

    res.status(201).json({
      status: "starred",
      total_stars: updatedPkg.stars || 0,
    });
  } catch (error) {
    res.status(500).json({ error: "star_failed", message: error.message });
  }
}

/**
 * DELETE /v1/packages/:name/star - Unstar a package
 * Public endpoint - no authentication required
 */
async function unstarPackage(req, res) {
  try {
    const { name } = req.params;
    const { user_id } = req.body; // Browser-generated unique ID

    // Use authenticated agent name if available, otherwise use anonymous user_id
    const identifier = req.auth?.payload?.sub || user_id || "anonymous";

    const deleted = await db("stars")
      .where({ agent_name: identifier, package_name: name })
      .delete();

    if (deleted === 0) {
      return res.status(404).json({ error: "not_starred" });
    }

    // Decrement star count
    await db("packages").where({ name }).decrement("stars", 1);

    const pkg = await db("packages").where({ name }).first();

    // Log activity
    await logActivity("unstar", identifier, name, "package");

    res.json({
      status: "unstarred",
      total_stars: pkg.stars || 0,
    });
  } catch (error) {
    res.status(500).json({ error: "unstar_failed", message: error.message });
  }
}

/**
 * GET /v1/packages/:name/star - Check if current user starred this package
 * Accepts user_id query parameter for anonymous users
 */
async function checkStarred(req, res) {
  try {
    const { name } = req.params;
    const { user_id } = req.query;

    // Use authenticated agent name if available, otherwise use anonymous user_id
    const identifier = req.auth?.payload?.sub || user_id;

    if (!identifier) {
      return res.json({ starred: false });
    }

    const star = await db("stars")
      .where({ agent_name: identifier, package_name: name })
      .first();

    res.json({
      starred: !!star,
      starred_at: star?.starred_at || null,
    });
  } catch (error) {
    res.status(500).json({ error: "check_failed", message: error.message });
  }
}

module.exports = {
  starPackage,
  unstarPackage,
  checkStarred,
};
