const fs = require("fs").promises;
const path = require("path");
const db = require("../db");

const STORAGE_DIR =
  process.env.GITLOBSTER_STORAGE_DIR || path.join(__dirname, "../../storage");
const PACKAGES_DIR = path.join(STORAGE_DIR, "packages");

// Ensure packages directory exists
fs.mkdir(PACKAGES_DIR, { recursive: true }).catch((err) => {
  if (err.code !== "EEXIST") console.error("Error creating packages dir:", err);
});

/**
 * GET /v1/packages - Search packages
 */
async function searchPackages(req, res) {
  try {
    const { q, category, tag, limit = 20, offset = 0 } = req.query;

    let query = db("packages").select("*");

    if (q) {
      query = query.where(function () {
        this.where("name", "like", `%${q}%`).orWhere(
          "description",
          "like",
          `%${q}%`,
        );
      });
    } else {
      // Hide system skills from default listing
      query = query.where("name", "!=", "gitlobster-sync");
    }

    if (category) {
      query = query.where("category", category);
    }

    if (tag) {
      query = query.whereRaw("tags LIKE ?", [`%"${tag}"%`]);
    }

    const total = await query.clone().count("* as count").first();
    const results = await query.limit(parseInt(limit)).offset(parseInt(offset));

    // Parse JSON tags for each result
    const formatted = results.map((pkg) => ({
      ...pkg,
      tags: JSON.parse(pkg.tags || "[]"),
    }));

    res.json({
      results: formatted,
      total: total.count,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ error: "search_failed", message: error.message });
  }
}

/**
 * GET /v1/packages/:name - Get package metadata
 */
async function getPackageMetadata(req, res) {
  console.log("getPackageMetadata params:", req.params);
  try {
    const { name } = req.params;

    const pkg = await db("packages").where({ name }).first();

    if (!pkg) {
      return res.status(404).json({
        error: "package_not_found",
        message: `Package ${name} not found`,
      });
    }

    // Get all versions
    const versions = await db("versions")
      .where({ package_name: name })
      .select("version", "published_at")
      .orderBy("published_at", "desc");

    const latest = versions[0]?.version || "0.0.0";

    // Count endorsements for this package
    const endorsementCount = await db("endorsements")
      .where({ package_name: name })
      .count("* as count")
      .first();

    // Check if this package is a fork
    const forkRecord = await db("forks")
      .where({ forked_package: name })
      .first();

    // Count total forks of this package
    const forkCount = await db("forks")
      .where({ parent_package: name })
      .count("* as count")
      .first();

    res.json({
      name: pkg.name,
      versions: versions,
      latest,
      description: pkg.description,
      author: {
        name: pkg.author_name,
        url: pkg.author_url,
        publicKey: pkg.author_public_key,
      },
      license: pkg.license,
      category: pkg.category,
      tags: JSON.parse(pkg.tags || "[]"),
      downloads: pkg.downloads,
      stars: pkg.stars || 0,
      agent_stars: pkg.agent_stars || 0,
      endorsement_count: endorsementCount.count || 0,
      // Fork metadata
      is_fork: !!forkRecord,
      parent_package: forkRecord?.parent_package || null,
      fork_reason: forkRecord?.fork_reason || null,
      fork_count: parseInt(forkCount?.count || 0),
      createdAt: pkg.created_at,
      updatedAt: pkg.updated_at,
    });
  } catch (error) {
    console.error("Metadata error:", error);
    res.status(500).json({ error: "metadata_failed", message: error.message });
  }
}

/**
 * GET /v1/packages/:name/:version/manifest - Get package manifest
 */
async function getManifest(req, res) {
  try {
    const { name, version } = req.params;

    const versionData = await db("versions")
      .where({ package_name: name, version })
      .first();

    if (!versionData) {
      return res.status(404).json({
        error: "version_not_found",
        message: `Version ${version} of ${name} not found`,
      });
    }

    const manifest = JSON.parse(versionData.manifest);

    res.json(manifest);
  } catch (error) {
    console.error("Manifest error:", error);
    res.status(500).json({ error: "manifest_failed", message: error.message });
  }
}

/**
 * GET /v1/packages/:name/:version/tarball - Download package tarball
 */
async function downloadTarball(req, res) {
  try {
    let { name, version } = req.params;

    // Handle "latest" as a special case
    if (version === "latest") {
      const latestVersion = await db("versions")
        .where({ package_name: name })
        .orderBy("published_at", "desc")
        .first();

      if (!latestVersion) {
        return res.status(404).json({
          error: "package_not_found",
          message: `Package ${name} has no published versions`,
        });
      }

      version = latestVersion.version;
    }

    const versionData = await db("versions")
      .where({ package_name: name, version })
      .first();

    if (!versionData) {
      return res.status(404).json({
        error: "version_not_found",
        message: `Version ${version} of ${name} not found`,
      });
    }

    const tarballPath = path.join(STORAGE_DIR, versionData.storage_path);

    // Check if file exists
    try {
      await fs.access(tarballPath);
    } catch {
      return res.status(500).json({
        error: "file_not_found",
        message: "Package file missing from storage",
      });
    }

    // Increment download counter
    await db("packages").where({ name }).increment("downloads", 1);

    // Set headers
    const filename = `${name.replace(/[@\/]/g, "-")}-${version}.tgz`;
    res.setHeader("Content-Type", "application/gzip");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("X-Package-Hash", versionData.hash);
    res.setHeader("X-Package-Signature", versionData.signature);

    // Stream file
    const fileStream = require("fs").createReadStream(tarballPath);
    fileStream.pipe(res);
  } catch (error) {
    console.error("Download error:", error);
    res.status(500).json({ error: "download_failed", message: error.message });
  }
}

/**
 * GET /v1/packages/:name/:version/readme - Get README.md content
 * For transparency: Humans can view skill documentation
 */
async function getReadme(req, res) {
  try {
    let { name, version } = req.params;

    // Handle "latest" as a special case
    if (version === "latest") {
      const latestVersion = await db("versions")
        .where({ package_name: name })
        .orderBy("published_at", "desc")
        .first();

      if (!latestVersion) {
        return res.status(404).json({
          error: "package_not_found",
          message: `Package ${name} has no published versions`,
        });
      }

      version = latestVersion.version;
    }

    const versionData = await db("versions")
      .where({ package_name: name, version })
      .first();

    if (!versionData) {
      return res.status(404).json({
        error: "version_not_found",
        message: `Version ${version} of ${name} not found`,
      });
    }

    const manifest = JSON.parse(versionData.manifest);

    // README is optional in manifest
    if (!manifest.readme) {
      return res.status(404).json({
        error: "readme_not_found",
        message: "This package does not include a README",
      });
    }

    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.send(manifest.readme);
  } catch (error) {
    console.error("README error:", error);
    res.status(500).json({ error: "readme_failed", message: error.message });
  }
}

/**
 * GET /v1/packages/:name/:version/skill-doc - Get SKILL.md content
 * For transparency: Humans can view skill specifications
 */
async function getSkillDoc(req, res) {
  try {
    let { name, version } = req.params;

    // Handle "latest" as a special case
    if (version === "latest") {
      const latestVersion = await db("versions")
        .where({ package_name: name })
        .orderBy("published_at", "desc")
        .first();

      if (!latestVersion) {
        return res.status(404).json({
          error: "package_not_found",
          message: `Package ${name} has no published versions`,
        });
      }

      version = latestVersion.version;
    }

    const versionData = await db("versions")
      .where({ package_name: name, version })
      .first();

    if (!versionData) {
      return res.status(404).json({
        error: "version_not_found",
        message: `Version ${version} of ${name} not found`,
      });
    }

    const manifest = JSON.parse(versionData.manifest);

    // SKILL.md is required per SSF spec
    if (!manifest.skillDoc && !manifest.skill_doc) {
      return res.status(404).json({
        error: "skill_doc_not_found",
        message: "This package does not include a SKILL.md",
      });
    }

    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.send(manifest.skillDoc || manifest.skill_doc);
  } catch (error) {
    console.error("SKILL.md error:", error);
    res.status(500).json({ error: "skill_doc_failed", message: error.message });
  }
}

/**
 * GET /v1/packages/:name/:version/file-manifest - Get signed file manifest
 * Allows downloaders to inspect declared files BEFORE downloading the tarball
 */
async function getFileManifest(req, res) {
  try {
    let { name, version } = req.params;

    // Handle "latest"
    if (version === "latest") {
      const latestVersion = await db("versions")
        .where({ package_name: name })
        .orderBy("published_at", "desc")
        .first();

      if (!latestVersion) {
        return res.status(404).json({
          error: "package_not_found",
          message: `Package ${name} has no published versions`,
        });
      }

      version = latestVersion.version;
    }

    const versionData = await db("versions")
      .where({ package_name: name, version })
      .first();

    if (!versionData) {
      return res.status(404).json({
        error: "version_not_found",
        message: `Version ${version} of ${name} not found`,
      });
    }

    const fileManifest = versionData.file_manifest
      ? JSON.parse(versionData.file_manifest)
      : null;

    if (!fileManifest) {
      return res.status(404).json({
        error: "no_file_manifest",
        message:
          "This version was published before file manifests were required",
      });
    }

    res.json({
      package_name: name,
      version,
      file_manifest: fileManifest,
      manifest_signature: versionData.manifest_signature,
      tarball_hash: versionData.hash,
      publisher_public_key: (await db("packages").where({ name }).first())
        ?.author_public_key,
    });
  } catch (error) {
    console.error("File manifest error:", error);
    res
      .status(500)
      .json({ error: "file_manifest_failed", message: error.message });
  }
}

// Get package lineage (forks and ancestry)
async function getPackageLineage(req, res) {
  const { name } = req.params;
  const { direction = "both", depth = 5 } = req.query;

  try {
    // Get current package info - use direct Knex query
    const pkg = await db("packages").where({ name }).first();
    if (!pkg) {
      return res.status(404).json({ error: "package_not_found" });
    }

    // Get ancestors (parent packages - packages this was forked from)
    let ancestors = [];

    // Query forks table to find if this package was forked from something
    const forkRecord = await db("forks")
      .where({ forked_package: name })
      .first();
    if (forkRecord) {
      // Get parent package info
      const parentPkg = await db("packages")
        .where({ name: forkRecord.parent_package })
        .first();
      ancestors = [
        {
          package: forkRecord.parent_package,
          forkPointVersion: forkRecord.fork_point_version || "1.0.0",
          signatureValid: !!forkRecord.signature,
          author: parentPkg
            ? {
                fingerprint: parentPkg.author_public_key
                  ? parentPkg.author_public_key.slice(0, 12)
                  : null,
              }
            : null,
        },
      ];
    }

    // Get descendants (forks - packages forked from this)
    // Use direct Knex query with limit
    const forks = await db("forks")
      .where({ parent_package: name })
      .limit(parseInt(depth));

    // Get package details for each fork
    const descendants = await Promise.all(
      forks.map(async (fork) => {
        const forkedPkg = await db("packages")
          .where({ name: fork.forked_package })
          .first();
        return {
          package: fork.forked_package,
          forkReason: fork.fork_reason,
          forkerAgent: fork.forker_agent,
          signatureValid: !!fork.signature,
          signatureStatus: fork.signature ? "verified" : "unverified",
          author: forkedPkg?.author_public_key
            ? {
                fingerprint: forkedPkg.author_public_key.slice(0, 12),
              }
            : null,
        };
      }),
    );

    res.json({
      package: {
        name: pkg.name,
        uuid: pkg.uuid || null,
        is_fork: !!forkRecord,
      },
      fork_badge: forkRecord
        ? {
            forked_from_name: forkRecord.parent_package,
            forked_from_uuid: forkRecord.parent_uuid || null,
            fork_point_version: forkRecord.fork_point_version,
            fork_point_commit: forkRecord.fork_point_commit,
            forked_at: forkRecord.forked_at,
            display: `🍴 Forked from ${forkRecord.parent_package} (v${forkRecord.fork_point_version})`,
          }
        : null,
      author: {
        name: pkg.author_name,
        publicKey: pkg.author_public_key,
        fingerprint: pkg.author_public_key
          ? pkg.author_public_key.slice(0, 12)
          : null,
      },
      ancestors,
      descendants,
      trust: {
        totalForks: descendants.length,
        verifiedSignatures: descendants.filter((d) => d.signatureValid).length,
      },
    });
  } catch (error) {
    console.error("Lineage error:", error);
    res.status(500).json({ error: "lineage_failed", message: error.message });
  }
}

module.exports = {
  searchPackages,
  getPackageMetadata,
  getManifest,
  downloadTarball,
  getReadme,
  getSkillDoc,
  getFileManifest,
  getPackageLineage,
};
