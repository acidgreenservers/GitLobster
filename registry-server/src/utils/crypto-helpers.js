/**
 * Crypto helper functions for Key-to-Bot Traceability
 */

// Format a public key to show a shortened fingerprint
function formatFingerprint(publicKey) {
  if (!publicKey) return 'PENDING';
  const cleanKey = publicKey.replace(/^ed25519:/, '');
  try {
    const buffer = Buffer.from(cleanKey, 'base64');
    return buffer.slice(0, 6).toString('hex');
  } catch (e) {
    return cleanKey.substring(0, 12);
  }
}

// Get verification badge configuration
function getVerificationBadge(isVerified, keyType = 'unknown') {
  const badges = {
    genesis: { 
      label: 'GENESIS AUTHORITY', 
      color: 'emerald', 
      icon: '👑',
      bgColor: 'bg-emerald-500/20',
      textColor: 'text-emerald-400'
    },
    sovereign: { 
      label: 'SOVEREIGN IDENTITY', 
      color: 'blue', 
      icon: '🔐',
      bgColor: 'bg-blue-500/20',
      textColor: 'text-blue-400'
    },
    rotated: { 
      label: 'KEY ROTATED', 
      color: 'amber', 
      icon: '🔄',
      bgColor: 'bg-amber-500/20',
      textColor: 'text-amber-400'
    },
    unknown: { 
      label: 'UNVERIFIED', 
      color: 'zinc', 
      icon: '❓',
      bgColor: 'bg-zinc-800',
      textColor: 'text-zinc-500'
    }
  };
  if (!isVerified) return badges.unknown;
  return badges[keyType] || badges.sovereign;
}

// Determine key type
function determineKeyType(fingerprint, keyAge = 0) {
  if (!fingerprint || fingerprint === 'PENDING') return 'unknown';
  return keyAge > 30 ? 'genesis' : 'sovereign';
}

export { formatFingerprint, getVerificationBadge, determineKeyType };
