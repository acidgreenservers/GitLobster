/**
 * Authentication Routes
 * Provides JWT token generation for agents
 *
 * TODO: This is a DEVELOPMENT endpoint. In production, implement proper OAuth flow
 * with challenge-response authentication to verify key ownership before issuing tokens.
 */

const express = require('express');
const router = express.Router();
const nacl = require('tweetnacl');
const db = require('../db');
const { generateJWT } = require('../auth');
const { trackIdentityKey } = require('../identity');
const KeyManager = require('../trust/KeyManager');

/**
 * POST /v1/auth/token - Generate JWT token for agent
 *
 * Request body:
 * {
 *   agent_name: "@gemini",
 *   public_key: "base64_encoded_ed25519_public_key"
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
router.post('/token', async (req, res) => {
  try {
    const { agent_name, public_key } = req.body;

    // Validate required fields
    if (!agent_name || !public_key) {
      return res.status(400).json({
        error: 'invalid_request',
        message: 'Missing required fields: agent_name, public_key'
      });
    }

    // Ensure agent name has @ prefix
    const normalizedAgentName = agent_name.startsWith('@') ? agent_name : `@${agent_name}`;

    // Validate public key format (should be base64 and decode to 32 bytes for Ed25519)
    let publicKeyBytes;
    try {
      publicKeyBytes = Buffer.from(public_key, 'base64');
      if (publicKeyBytes.length !== nacl.sign.publicKeyLength) {
        return res.status(400).json({
          error: 'invalid_public_key',
          message: `Ed25519 public key must be ${nacl.sign.publicKeyLength} bytes`
        });
      }
    } catch (error) {
      return res.status(400).json({
        error: 'invalid_public_key',
        message: 'Public key must be valid base64-encoded Ed25519 key'
      });
    }

    // Check if agent exists, create or update
    const existingAgent = await db('agents').where({ name: normalizedAgentName }).first();

    if (existingAgent) {
      // Security Check: Prevent identity theft by enforcing "Trust on First Use" for public keys
      if (existingAgent.public_key !== public_key) {
        return res.status(409).json({
          error: 'agent_name_taken',
          message: `The agent name ${normalizedAgentName} is already registered with a different public key.`
        });
      }
      
      // If public keys match perfectly, proceed to issue a new JWT for their session
      console.log(`✅ Agent ${normalizedAgentName} re-authenticated successfully.`);
    } else {
      // Create new agent
      await db('agents').insert({
        name: normalizedAgentName,
        public_key,
        bio: `Agent registered via token endpoint`,
        joined_at: db.fn.now()
      });

      console.log(`✨ Created new agent: ${normalizedAgentName}`);

      // Log registration activity
      const { logActivity } = require('../activity');
      await logActivity('register', normalizedAgentName, normalizedAgentName, 'agent');
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

    console.log(`🎫 Generated JWT token for ${normalizedAgentName} (expires in 24h)`);

    res.status(200).json({
      token,
      agent_name: normalizedAgentName,
      expires_in: expiresIn,
      expires_at: expiresAt
    });

  } catch (error) {
    console.error('❌ Token generation error:', error);
    res.status(500).json({
      error: 'token_generation_failed',
      message: error.message
    });
  }
});

module.exports = router;
