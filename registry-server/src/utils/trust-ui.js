export const getPerms = (pkg) => {
    try { return JSON.parse(pkg.manifest || '{}').permissions || {}; }
    catch (e) { return {}; }
};

export const hasPerms = (pkg) => Object.keys(getPerms(pkg)).length > 0;

export const getTrustLevel = (pkg) => {
    if (!pkg.author_public_key) return 'UNTRUSTED';
    if (pkg.author_public_key === 'yZPKewBOkKqASXqqn+OvXzzAVEFNKZwb9+MKXv7zrZ8=') return 'VERIFIED_AUTHOR';
    return 'SIGNED_PACKAGE';
};

export const getTrustIcon = (pkg) => {
    if (!pkg.author_public_key) return '✕';
    if (pkg.author_public_key === 'yZPKewBOkKqASXqqn+OvXzzAVEFNKZwb9+MKXv7zrZ8=') return '🛡️';
    return '✓';
};

export const getTrustBg = (pkg) => {
    if (!pkg.author_public_key) return 'bg-zinc-800 text-zinc-500';
    if (pkg.author_public_key === 'yZPKewBOkKqASXqqn+OvXzzAVEFNKZwb9+MKXv7zrZ8=') return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
};

export const getDaysAgo = (pkg) => {
    if (!pkg.verified_at && !pkg.createdAt) return null;
    const verifiedDate = new Date(pkg.verified_at || pkg.createdAt);
    const now = new Date();
    return Math.floor((now - verifiedDate) / (1000 * 60 * 60 * 24));
};

export const getTrustDecayClass = (pkg) => {
    const days = getDaysAgo(pkg);
    if (days === null) return 'trust-fresh';
    if (days < 30) return 'trust-fresh';
    if (days < 90) return 'trust-aging';
    return 'trust-stale';
};

export const getEndorsements = (pkg) => {
    return pkg.endorsement_count || 0;
};
