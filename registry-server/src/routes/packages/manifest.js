const db = require("../../db");

/**
 * Shared helper: resolve "latest" to actual version string
 */
async function resolveVersion(name, version) {
  if (version !== "latest") return version;

  const latestVersion = await db("versions")
    .where({ package_name: name })
    .orderBy("published_at", "desc")
    .first();

  if (!latestVersion) {
    const error = new Error(`Package ${name} has no published versions`);
    error.code = "package_not_found";
    throw error;
  }

  return latestVersion.version;
}

/**
 * GET /v1/packages/:name/:version/manifest - Get parsed package manifest JSON
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

    res.json(JSON.parse(versionData.manifest));
  } catch (error) {
    console.error("Manifest error:", error);
    res.status(500).json({ error: "manifest_failed", message: error.message });
  }
}

/**
 * GET /v1/packages/:name/:version/file-manifest - Get signed file manifest
 * Allows downloaders to inspect declared files BEFORE downloading the tarball
 */
async function getFileManifest(req, res) {
  try {
    const { name } = req.params;
    const version = await resolveVersion(name, req.params.version).catch(
      (e) => {
        res.status(404).json({ error: e.code, message: e.message });
        return null;
      },
    );
    if (!version) return;

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

    const pkg = await db("packages").where({ name }).first();

    res.json({
      package_name: name,
      version,
      file_manifest: fileManifest,
      manifest_signature: versionData.manifest_signature,
      tarball_hash: versionData.hash,
      publisher_public_key: pkg?.author_public_key,
      // V2.6 Dual-signature fields
      agent_public_key: versionData.agent_public_key || null,
      agent_fingerprint: versionData.agent_fingerprint || "legacy-unsigned",
      agent_signature: versionData.agent_signature || null,
      server_public_key: versionData.server_public_key || null,
      server_fingerprint: versionData.server_fingerprint || null,
      commit_hash: versionData.commit_hash || null,
      author_name: versionData.author_name || pkg?.author_name || null,
      author_email: versionData.author_email || null,
      published_at: versionData.published_at || null,
      // Include parsed manifest for agentSignature/agentPublicKey fallback
      manifest: versionData.manifest ? JSON.parse(versionData.manifest) : null,
    });
  } catch (error) {
    console.error("File manifest error:", error);
    res
      .status(500)
      .json({ error: "file_manifest_failed", message: error.message });
  }
}

module.exports = { getManifest, getFileManifest };
