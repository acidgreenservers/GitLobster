/**
 * Crypto Utilities for Key-to-Bot Traceability
 * Handles Ed25519 key fingerprint formatting and verification display
 */

/**
 * Format a public key to show a shortened fingerprint
 * @param {string} publicKey - Base64-encoded Ed25519 public key
 * @returns {string} Truncated fingerprint (first 12 chars)
 */
function formatFingerprint(publicKey) {
  if (!publicKey) return 'PENDING';
  
  // Remove ed25519: prefix if present
  const cleanKey = publicKey.replace(/^ed25519:/, '');
  
  // Try to detect encoding and convert to hex for consistent fingerprint
  try {
    // If it's base64, decode and show first 6 bytes as hex (12 hex chars)
    const buffer = Buffer.from(cleanKey, 'base64');
    return buffer.slice(0, 6).toString('hex');
  } catch (e) {
    // If already hex or plain, just truncate
    return cleanKey.substring(0, 12);
  }
}

/**
 * Format full public key for display with optional truncation
 * @param {string} publicKey - Base64-encoded Ed25519 public key
 * @param {boolean} truncate - Whether to truncate for compact display
 * @returns {string} Formatted public key
 */
function formatPublicKey(publicKey, truncate = false) {
  if (!publicKey) return 'No key on record';
  
  const cleanKey = publicKey.replace(/^ed25519:/, '');
  
  if (truncate && cleanKey.length > 32) {
    return cleanKey.substring(0, 16) + '...' + cleanKey.substring(cleanKey.length - 16);
  }
  
  return cleanKey;
}

/**
 * Get verification status badge configuration
 * @param {boolean} isVerified - Whether the signature/key is verified
 * @param {string} keyType - 'genesis' | 'sovereign' | 'rotated' | 'unknown'
 * @returns {object} Badge configuration { label, color, icon }
 */
function getVerificationBadge(isVerified, keyType = 'unknown') {
  const badges = {
    genesis: {
      label: 'GENESIS AUTHORITY',
      color: 'emerald',
      bgColor: 'bg-emerald-500/20',
      borderColor: 'border-emerald-500/30',
      textColor: 'text-emerald-400',
      icon: '👑'
    },
    sovereign: {
      label: 'SOVEREIGN IDENTITY',
      color: 'blue',
      bgColor: 'bg-blue-500/20',
      borderColor: 'border-blue-500/30',
      textColor: 'text-blue-400',
      icon: '🔐'
    },
    rotated: {
      label: 'KEY ROTATED',
      color: 'amber',
      bgColor: 'bg-amber-500/20',
      borderColor: 'border-amber-500/30',
      textColor: 'text-amber-400',
      icon: '🔄'
    },
    unknown: {
      label: 'UNVERIFIED',
      color: 'zinc',
      bgColor: 'bg-zinc-800',
      borderColor: 'border-zinc-700',
      textColor: 'text-zinc-500',
      icon: '❓'
    }
  };

  if (!isVerified) {
    return badges.unknown;
  }

  return badges[keyType] || badges.sovereign;
}

/**
 * Determine key type based on agent history
 * @param {object} identity - Identity metadata from API
 * @returns {string} Key type: 'genesis' | 'sovereign' | 'rotated'
 */
function determineKeyType(identity) {
  if (!identity || !identity.continuity) return 'unknown';
  
  switch (identity.continuity) {
    case 'stable':
      // Check if this is the first key (could be genesis)
      return identity.keyAge > 30 ? 'genesis' : 'sovereign';
    case 'rotated':
      return 'rotated';
    default:
      return 'unknown';
  }
}

/**
 * Format lineage entry for fork display
 * @param {object} fork - Fork record from database
 * @param {object} parentPackage - Parent package metadata
 * @returns {object} Formatted lineage entry
 */
function formatLineageEntry(fork, parentPackage) {
  return {
    forkedPackage: fork.forked_package,
    parentPackage: fork.parent_package,
    forkerAgent: fork.forker_agent,
    forkReason: fork.fork_reason,
    forkPointVersion: fork.fork_point_version,
    forkedAt: fork.forked_at,
    signature: fork.signature,
    // Verification status - check if forker's key matches current key
    signatureStatus: fork.signature ? 'signed' : 'unsigned',
    // Check if parent author is same as forker (shouldn't be for a real fork)
    isLegitimateFork: fork.forker_agent !== parentPackage?.author_name
  };
}

/**
 * Copy text to clipboard with fallback
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} Success status
 */
async function copyToClipboard(text) {
  if (!text) return false;
  
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    return true;
  } catch (err) {
    console.error('Copy failed:', err);
    return false;
  }
}

module.exports = {
  formatFingerprint,
  formatPublicKey,
  getVerificationBadge,
  determineKeyType,
  formatLineageEntry,
  copyToClipboard
};
