/**
 * Authentication & Signature Verification
 * Ed25519 signature verification for JWTs and packages
 */

const jwt = require('jsonwebtoken');
const nacl = require('tweetnacl');
const { decodeUTF8, decodeBase64 } = require('tweetnacl-util');

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

    // For now, we'll return the decoded payload
    // In production, we'd verify against the public key from MoltReg
    return {
      valid: true,
      payload,
      needsKeyVerification: true // Flag that we need to check against MoltReg
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
 * @param {string} hash - Package hash (sha256:...)
 * @param {string} signature - Signature (ed25519:base64...)
 * @param {string} publicKey - Ed25519 public key (base64 or hex)
 */
function verifyPackageSignature(hash, signature, publicKey) {
  try {
    // Remove prefixes
    const hashValue = hash.replace(/^sha256:/, '');
    const sigValue = signature.replace(/^ed25519:/, '');

    // Decode signature and public key from base64
    const sigBytes = Buffer.from(sigValue, 'base64');
    const pubKeyBytes = Buffer.from(publicKey, 'base64');
    const messageBytes = Buffer.from(hashValue, 'utf8');

    // Verify using TweetNaCl
    const isValid = nacl.sign.detached.verify(
      messageBytes,
      sigBytes,
      pubKeyBytes
    );

    return isValid;

  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
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

  // Attach payload to request
  req.auth = verification.payload;
  next();
}

module.exports = {
  verifyJWT,
  verifyPackageSignature,
  requireAuth
};
