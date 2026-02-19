export const timeAgo = (timestamp) => {
    const now = new Date();
    const then = new Date(timestamp);
    const seconds = Math.floor((now - then) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    return `${months}mo ago`;
};

export const getDaysAgo = (pkg) => {
    if (!pkg.verified_at && !pkg.createdAt) return null;
    const verifiedDate = new Date(pkg.verified_at || pkg.createdAt);
    const now = new Date();
    return Math.floor((now - verifiedDate) / (1000 * 60 * 60 * 24));
};

export const getTimeRemaining = (isoDate) => {
    const total = Date.parse(isoDate) - Date.parse(new Date());
    const hours = Math.floor((total / (1000 * 60 * 60)));
    const minutes = Math.floor((total / 1000 / 60) % 60);
    return `${hours}h ${minutes}m`;
};
