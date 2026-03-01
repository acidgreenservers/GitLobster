/**
 * Authentication & Signature Verification
 * Ed25519 signature verification for JWTs and packages
 */

const nacl = require('tweetnacl');
const KeyManager = require('./trust/KeyManager');

/**
 * Verify Ed25519-signed JWT
 */
function verifyJWT(token) {
  try {
    // Split JWT into parts
    const [headerB64, payloadB64, signatureB64] = token.split('.');

    if (!headerB64 || !payloadB64 || !signatureB64) {
      throw new Error('Invalid JWT format');
    }

    // Decode header and payload
    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString());
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());

    // Check algorithm
    if (header.alg !== 'EdDSA') {
      throw new Error('Invalid algorithm - must be EdDSA');
    }

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      throw new Error('Token expired');
    }

    // Verify signature against this node's public key
    // In the self-trust model, the registry signs the token
    const nodeIdentity = KeyManager.getNodeIdentity();
    const publicKeyBytes = Buffer.from(nodeIdentity.publicKey, 'base64');

    // Reconstruct the message that was signed
    const message = `${headerB64}.${payloadB64}`;
    const messageBytes = Buffer.from(message, 'utf8');

    // Decode signature
    const signatureBytes = Buffer.from(signatureB64, 'base64url');

    const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);

    if (!isValid) {
      throw new Error('Invalid signature');
    }

    return {
      valid: true,
      payload,
      needsKeyVerification: false
    };

  } catch (error) {
    return {
      valid: false,
      error: error.message
    };
  }
}

/**
 * Verify package signature using Ed25519
 * @param {string} message - Message that was signed (e.g., hash string, or fork message)
 * @param {string} signature - Signature (ed25519:base64... or raw base64)
 * @param {string} publicKey - Ed25519 public key (base64)
 */
function verifyPackageSignature(message, signature, publicKey) {
  try {
    console.log('🔍 Signature Verification Debug:', {
      message: message.substring(0, 100) + '...',
      messageLength: message.length,
      signature: signature.substring(0, 40) + '...',
      signatureLength: signature.length,
      publicKey: publicKey.substring(0, 40) + '...',
      publicKeyLength: publicKey.length
    });

    // Remove ed25519: prefix if present
    const sigValue = signature.replace(/^ed25519:/, '');

    // Decode signature and public key from base64
    const sigBytes = Buffer.from(sigValue, 'base64');
    const pubKeyBytes = Buffer.from(publicKey, 'base64');

    // Message should be the FULL message string that was signed (including any prefixes)
    const messageBytes = Buffer.from(message, 'utf8');

    console.log('🔍 Decoded Bytes:', {
      messageBytes: messageBytes.length,
      sigBytes: sigBytes.length,
      pubKeyBytes: pubKeyBytes.length
    });

    // Verify using TweetNaCl
    const isValid = nacl.sign.detached.verify(
      messageBytes,
      sigBytes,
      pubKeyBytes
    );

    console.log('🔍 Verification Result:', { isValid });

    return isValid;

  } catch (error) {
    console.error('❌ Signature verification error:', error);
    return false;
  }
}

/**
 * Generate Ed25519-signed JWT
 * @param {string} agentName - Agent name (e.g., "@gemini")
 * @param {string} privateKey - Ed25519 private key (base64)
 * @param {number} expiresIn - Expiration time in seconds (default: 86400 = 24 hours)
 * @returns {string} JWT token
 */
function generateJWT(agentName, privateKey, expiresIn = 86400) {
  try {
    const now = Math.floor(Date.now() / 1000);

    // JWT header
    const header = {
      alg: 'EdDSA',
      typ: 'JWT'
    };

    // JWT payload
    const payload = {
      sub: agentName,
      iat: now,
      exp: now + expiresIn
    };

    // Encode header and payload
    const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');

    // Create signing input
    const signingInput = `${headerB64}.${payloadB64}`;
    const messageBytes = Buffer.from(signingInput, 'utf8');

    // Sign with Ed25519
    const privateKeyBytes = Buffer.from(privateKey, 'base64');
    const signatureBytes = nacl.sign.detached(messageBytes, privateKeyBytes);
    const signatureB64 = Buffer.from(signatureBytes).toString('base64url');

    // Return complete JWT
    return `${signingInput}.${signatureB64}`;

  } catch (error) {
    throw new Error(`JWT generation failed: ${error.message}`);
  }
}

/**
 * Express middleware for JWT authentication
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'unauthorized',
      message: 'Missing or invalid Authorization header'
    });
  }

  const token = authHeader.substring(7); // Remove 'Bearer '
  const verification = verifyJWT(token);

  if (!verification.valid) {
    return res.status(401).json({
      error: 'invalid_token',
      message: verification.error
    });
  }

  // Attach auth object to request (with payload nested for consistency with existing route handlers)
  req.auth = {
    payload: verification.payload
  };
  next();
}

module.exports = {
  verifyJWT,
  verifyPackageSignature,
  requireAuth,
  generateJWT
};
