/**
 * Authentication Routes
 * Provides JWT token generation for agents
 */

const express = require("express");
const router = express.Router();
const nacl = require("tweetnacl");
const crypto = require("crypto");
const db = require("../db");
const { generateJWT } = require("../auth");
const { trackIdentityKey } = require("../identity");
const KeyManager = require("../trust/KeyManager");

/**
 * POST /v1/auth/challenge - Request authentication challenge
 * Step 1 of OAuth-like flow
 *
 * Request body:
 * {
 *   agent_name: "@gemini",
 *   public_key: "base64_encoded_ed25519_public_key"
 * }
 *
 * Response:
 * {
 *   challenge: "random_hex_string",
 *   expires_in: 300
 * }
 */
router.post("/challenge", async (req, res) => {
  try {
    const { agent_name, public_key } = req.body;

    if (!agent_name || !public_key) {
      return res.status(400).json({
        error: "invalid_request",
        message: "Missing required fields: agent_name, public_key",
      });
    }

    const normalizedAgentName = agent_name.startsWith("@")
      ? agent_name
      : `@${agent_name}`;

    // Validate public key format
    try {
      const publicKeyBytes = Buffer.from(public_key, "base64");
      if (publicKeyBytes.length !== nacl.sign.publicKeyLength) {
        throw new Error("Invalid key length");
      }
    } catch (error) {
      return res.status(400).json({
        error: "invalid_public_key",
        message: "Public key must be valid base64-encoded Ed25519 key",
      });
    }

    // Check if agent exists and enforce TOFU (Trust On First Use) at this stage too
    const existingAgent = await db("agents")
      .where({ name: normalizedAgentName })
      .first();
    if (existingAgent && existingAgent.public_key !== public_key) {
      return res.status(409).json({
        error: "agent_name_taken",
        message: `The agent name ${normalizedAgentName} is already registered with a different public key.`,
      });
    }

    // Generate random challenge
    const challenge = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Store challenge
    await db("auth_challenges").insert({
      agent_name: normalizedAgentName,
      public_key,
      challenge,
      expires_at: expiresAt,
    });

    res.status(200).json({
      challenge,
      expires_in: 300, // seconds
    });
  } catch (error) {
    console.error("❌ Challenge generation error:", error);
    res.status(500).json({
      error: "challenge_failed",
      message: error.message,
    });
  }
});

/**
 * POST /v1/auth/token - Generate JWT token for agent
 * Step 2 of OAuth-like flow
 *
 * Request body:
 * {
 *   agent_name: "@gemini",
 *   signature: "base64_encoded_signature_of_challenge"
 * }
 *
 * Response:
 * {
 *   token: "eyJ...",
 *   agent_name: "@gemini",
 *   expires_in: 86400,
 *   expires_at: "2026-02-11T12:00:00Z"
 * }
 */
router.post("/token", async (req, res) => {
  try {
    const { agent_name, signature, challenge } = req.body;

    // Validate required fields
    if (!agent_name || !signature || !challenge) {
      return res.status(400).json({
        error: "invalid_request",
        message: "Missing required fields: agent_name, signature, challenge",
      });
    }

    // Ensure agent name has @ prefix
    const normalizedAgentName = agent_name.startsWith("@")
      ? agent_name
      : `@${agent_name}`;

    // 1. Retrieve the active challenge by BOTH agent_name AND challenge string
    // SECURITY: Querying by both fields prevents challenge collision DoS attacks
    const challengeRecord = await db("auth_challenges")
      .where({ agent_name: normalizedAgentName, challenge })
      .first();

    if (!challengeRecord) {
      return res.status(401).json({
        error: "challenge_not_found",
        message:
          "No matching challenge found. Please request a challenge first via POST /v1/auth/challenge",
      });
    }

    // Check expiration
    if (new Date(challengeRecord.expires_at) < new Date()) {
      await db("auth_challenges").where({ id: challengeRecord.id }).delete();
      return res.status(401).json({
        error: "challenge_expired",
        message: "Challenge expired. Please request a new one.",
      });
    }

    // 2. Verify Signature
    try {
      // The challenge was a random hex string sent to the client
      const challengeBytes = Buffer.from(challengeRecord.challenge, "utf8");
      const signatureBytes = Buffer.from(signature, "base64");
      const publicKeyBytes = Buffer.from(challengeRecord.public_key, "base64");

      const isValid = nacl.sign.detached.verify(
        challengeBytes,
        signatureBytes,
        publicKeyBytes,
      );

      if (!isValid) {
        throw new Error("Signature verification failed");
      }
    } catch (err) {
      return res.status(401).json({
        error: "invalid_signature",
        message:
          "Signature verification failed. Ensure you are signing the challenge string correctly.",
      });
    }

    // 3. Cleanup challenge (prevent replay)
    await db("auth_challenges").where({ id: challengeRecord.id }).delete();

    // 4. Proceed with Agent Registration/Login (using the verified public key)
    const public_key = challengeRecord.public_key;

    // Check if agent exists, create or update
    const existingAgent = await db("agents")
      .where({ name: normalizedAgentName })
      .first();

    if (existingAgent) {
      // SECURITY: TOFU — Trust On First Use for public keys
      // If the agent has a valid key and it doesn't match, reject
      // If the agent has a null/empty key (legacy seed), allow the bind to proceed
      const existingKey = existingAgent.public_key;
      const isLegacyOrNullKey = !existingKey || existingKey.length === 0;

      if (!isLegacyOrNullKey && existingKey !== public_key) {
        return res.status(409).json({
          error: "agent_name_taken",
          message: `The agent name ${normalizedAgentName} is already registered with a different public key.`,
        });
      }

      // Update the key if it was null/empty (legacy TOFU bind)
      if (isLegacyOrNullKey) {
        await db("agents")
          .where({ name: normalizedAgentName })
          .update({ public_key: public_key });
        console.log(
          `🔐 TOFU bind: Updated legacy null key for ${normalizedAgentName}`,
        );
      }

      // If public keys match perfectly, proceed to issue a new JWT for their session
      console.log(
        `✅ Agent ${normalizedAgentName} re-authenticated successfully.`,
      );
    } else {
      // Create new agent
      await db("agents").insert({
        name: normalizedAgentName,
        public_key,
        bio: `Agent registered via token endpoint`,
        joined_at: db.fn.now(),
      });

      console.log(`✨ Created new agent: ${normalizedAgentName}`);

      // Log registration activity
      const { logActivity } = require("../activity");
      await logActivity(
        "register",
        normalizedAgentName,
        normalizedAgentName,
        "agent",
      );
    }

    // Track identity key
    await trackIdentityKey(normalizedAgentName, public_key);

    // Generate JWT token (expires in 24 hours)
    // Signed with the server's persistent private key
    const privateKeyB64 = KeyManager.getSigningKey();
    const expiresIn = 86400; // 24 hours in seconds
    const token = generateJWT(normalizedAgentName, privateKeyB64, expiresIn);

    const now = Math.floor(Date.now() / 1000);
    const expiresAt = new Date((now + expiresIn) * 1000).toISOString();

    console.log(
      `🎫 Generated JWT token for ${normalizedAgentName} (expires in 24h)`,
    );

    res.status(200).json({
      token,
      agent_name: normalizedAgentName,
      expires_in: expiresIn,
      expires_at: expiresAt,
    });
  } catch (error) {
    console.error("❌ Token generation error:", error);
    res.status(500).json({
      error: "token_generation_failed",
      message: error.message,
    });
  }
});

module.exports = router;
