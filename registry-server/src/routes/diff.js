const db = require("../db");
const { calculateVersionDiff } = require("../utils/version-diff");
const { logActivity } = require("../activity");

/**
 * GET /v1/packages/:name/diff - Compare two versions of a package
 * Query params: base (version or "latest"), head (version or "latest")
 * Returns detailed structural, metadata, and permission differences.
 */
async function getVersionDiff(req, res) {
  try {
    const { name } = req.params;
    const { base, head } = req.query;

    // Validate required parameters
    if (!base || !head) {
      return res.status(400).json({
        error: "missing_parameters",
        message: 'Both "base" and "head" query parameters are required',
        example: "/v1/packages/@scope/name/diff?base=1.0.0&head=1.1.0",
      });
    }

    // Check package exists
    const pkg = await db("packages").where({ name }).first();
    if (!pkg) {
      return res.status(404).json({
        error: "package_not_found",
        message: `Package ${name} not found`,
      });
    }

    // Resolve version names (support "latest")
    const allVersions = await db("versions")
      .where({ package_name: name })
      .orderBy("published_at", "desc");

    if (allVersions.length === 0) {
      return res.status(404).json({
        error: "no_versions",
        message: `Package ${name} has no published versions`,
      });
    }

    // Helper to resolve version identifier
    const resolveVersion = (identifier) => {
      if (identifier === "latest") {
        return allVersions[0];
      }
      return allVersions.find((v) => v.version === identifier);
    };

    const baseVersion = resolveVersion(base);
    const headVersion = resolveVersion(head);

    // Validate both versions exist
    if (!baseVersion) {
      return res.status(404).json({
        error: "version_not_found",
        message: `Base version "${base}" not found for package ${name}`,
      });
    }

    if (!headVersion) {
      return res.status(404).json({
        error: "version_not_found",
        message: `Head version "${head}" not found for package ${name}`,
      });
    }

    // Calculate diff
    const diff = calculateVersionDiff(baseVersion, headVersion);

    // Check for errors from diff calculation
    if (diff.error) {
      return res.status(400).json(diff);
    }

    // Log the diff request as activity
    await logActivity("diff_viewed", "system", name, "package", {
      base_version: baseVersion.version,
      head_version: headVersion.version,
    });

    res.json({
      package: name,
      author: pkg.author_name,
      diff,
      timestamps: {
        base_published: baseVersion.published_at,
        head_published: headVersion.published_at,
      },
    });
  } catch (error) {
    console.error("Version diff error:", error);
    res.status(500).json({
      error: "diff_calculation_failed",
      message: error.message,
    });
  }
}

module.exports = {
  getVersionDiff,
};
