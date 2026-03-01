const KeyManager = require("../trust/KeyManager");

/**
 * GET /v1/trust/root - Get node's public identity
 */
async function getTrustRoot(req, res) {
  try {
    const identity = KeyManager.getNodeIdentity();
    res.json({
      public_key: identity.publicKey,
      fingerprint: identity.fingerprint,
      created: identity.created,
      node_type: "self_verified",
    });
  } catch (error) {
    console.error("Trust root error:", error);
    res
      .status(500)
      .json({ error: "trust_root_failed", message: error.message });
  }
}

module.exports = {
  getTrustRoot,
};
