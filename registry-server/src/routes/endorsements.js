const db = require("../db");
const { verifyPackageSignature } = require("../auth");
const { logActivity } = require("../activity");

/**
 * POST /v1/packages/:name/endorse - Add an endorsement
 */
async function addEndorsement(req, res) {
  try {
    const { name } = req.params;
    const { signer_name, signer_type, comment, signature, trust_level } =
      req.body;

    // Verify package exists
    const pkg = await db("packages").where({ name }).first();
    if (!pkg) {
      return res.status(404).json({ error: "package_not_found" });
    }

    // Get signer's public key
    let publicKey;
    if (signer_type === "agent") {
      const agent = await db("agents").where({ name: signer_name }).first();
      if (!agent) {
        return res.status(404).json({ error: "signer_not_found" });
      }
      publicKey = agent.public_key;
    } else {
      // For human signers, might need different lookup
      return res
        .status(400)
        .json({ error: "human_endorsements_not_yet_supported" });
    }

    // Verify the signature
    const message = `${name}:${comment}:${trust_level}`;
    const isValid = verifyPackageSignature(message, signature, publicKey);

    if (!isValid) {
      return res.status(400).json({ error: "invalid_signature" });
    }

    // Insert verified endorsement
    await db("endorsements").insert({
      package_name: name,
      signer_name,
      signer_type,
      comment,
      signature,
      trust_level,
      created_at: db.fn.now(),
    });

    // Log activity
    await logActivity("endorse", signer_name, name, "package", {
      trust_level,
      comment,
    });

    res.status(201).json({ status: "endorsed" });
  } catch (error) {
    res
      .status(500)
      .json({ error: "endorsement_failed", message: error.message });
  }
}

/**
 * POST /v1/packages/:name/observations - Create an observation
 * For transparency: Humans and agents can leave notes about skills
 */
async function createObservation(req, res) {
  try {
    const { name } = req.params;
    const {
      observer_name,
      observer_type,
      content,
      category,
      sentiment,
      signature,
    } = req.body;

    // Validate package exists
    const pkg = await db("packages").where({ name }).first();
    if (!pkg) {
      return res.status(404).json({
        error: "package_not_found",
        message: `Package ${name} not found`,
      });
    }

    // Validate input
    if (!observer_name || !observer_type || !content) {
      return res.status(400).json({
        error: "invalid_input",
        message: "observer_name, observer_type, and content are required",
      });
    }

    if (!["human", "agent"].includes(observer_type)) {
      return res.status(400).json({
        error: "invalid_observer_type",
        message: 'observer_type must be "human" or "agent"',
      });
    }

    // Insert observation
    const [id] = await db("observations").insert({
      package_name: name,
      observer_name,
      observer_type,
      content,
      category: category || "general",
      sentiment: sentiment || "neutral",
      signature,
    });

    // Log activity
    await logActivity("observe", observer_name, name, "package", {
      category,
      sentiment,
      observer_type,
    });

    res.status(201).json({
      id,
      message: "Observation created successfully",
    });
  } catch (error) {
    console.error("Create observation error:", error);
    res
      .status(500)
      .json({ error: "observation_failed", message: error.message });
  }
}

/**
 * GET /v1/packages/:name/observations - List observations for a package
 */
async function listObservations(req, res) {
  try {
    const { name } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    // Validate package exists
    const pkg = await db("packages").where({ name }).first();
    if (!pkg) {
      return res.status(404).json({
        error: "package_not_found",
        message: `Package ${name} not found`,
      });
    }

    const observations = await db("observations")
      .where({ package_name: name })
      .orderBy("created_at", "desc")
      .limit(parseInt(limit))
      .offset(parseInt(offset));

    const total = await db("observations")
      .where({ package_name: name })
      .count("* as count")
      .first();

    res.json({
      observations,
      total: total.count,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    console.error("List observations error:", error);
    res
      .status(500)
      .json({ error: "list_observations_failed", message: error.message });
  }
}

/**
 * POST /v1/packages/:name/flag - Flag a package for integrity issues
 * When a downloader finds a mismatch between file_manifest and actual tarball contents,
 * they can report it here. This impacts the publisher's trust score.
 */
async function flagPackage(req, res) {
  try {
    const { name } = req.params;
    const { reason, evidence, reporter_name, reporter_type, signature } =
      req.body;

    // Validate required fields
    if (!reason || !reporter_name || !reporter_type) {
      return res.status(400).json({
        error: "invalid_request",
        message:
          "Missing required fields: reason, reporter_name, reporter_type",
      });
    }

    if (!["human", "agent"].includes(reporter_type)) {
      return res.status(400).json({
        error: "invalid_reporter_type",
        message: 'reporter_type must be "human" or "agent"',
      });
    }

    // Check package exists
    const pkg = await db("packages").where({ name }).first();
    if (!pkg) {
      return res.status(404).json({ error: "package_not_found" });
    }

    // Insert flag record
    await db("flags").insert({
      package_name: name,
      reporter_name,
      reporter_type,
      reason,
      evidence: JSON.stringify(evidence || {}),
      signature: signature || null,
      status: "open",
      created_at: db.fn.now(),
    });

    // Impact trust score: increment flag count on the publisher agent
    const authorHandle = pkg.author_name.startsWith("@")
      ? pkg.author_name
      : `@${pkg.author_name}`;
    const trustScore = await db("trust_score_components")
      .where({ agent_name: authorHandle })
      .first();
    if (trustScore) {
      // Reduce flag_history_score (starts at 1.0, decreases with each flag)
      const newFlagScore = Math.max(
        0,
        (trustScore.flag_history_score || 1.0) - 0.1,
      );
      await db("trust_score_components")
        .where({ agent_name: authorHandle })
        .update({
          flag_history_score: newFlagScore,
          last_computed: db.fn.now(),
        });
    }

    // Log activity
    await logActivity("flag", reporter_name, name, "package", {
      reason,
      reporter_type,
    });

    res.status(201).json({
      status: "flagged",
      message: `Package ${name} has been flagged. Publisher trust score has been impacted.`,
      package_name: name,
      reason,
    });
  } catch (error) {
    console.error("Flag error:", error);
    res.status(500).json({ error: "flag_failed", message: error.message });
  }
}

module.exports = {
  addEndorsement,
  createObservation,
  listObservations,
  flagPackage,
};
