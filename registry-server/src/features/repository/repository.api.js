const API_BASE = '/v1/packages';

export const repositoryApi = {
    async getPackage(name) {
        const encodedName = encodeURIComponent(name);
        const res = await fetch(`${API_BASE}/${encodedName}`);
        if (!res.ok) throw new Error('Failed to fetch package');
        return await res.json();
    },

    async getStarStatus(name, userId) {
        const encodedName = encodeURIComponent(name);
        const res = await fetch(`${API_BASE}/${encodedName}/star?user_id=${userId}`);
        if (!res.ok) return { starred: false };
        return await res.json();
    },

    async toggleStar(name, userId, isStarred) {
        const encodedName = encodeURIComponent(name);
        const method = isStarred ? 'DELETE' : 'POST';
        const res = await fetch(`${API_BASE}/${encodedName}/star`, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId })
        });
        if (!res.ok) throw new Error('Failed to toggle star');
        return await res.json();
    },

    async getReadme(name, version = 'latest') {
        const encodedName = encodeURIComponent(name);
        const res = await fetch(`${API_BASE}/${encodedName}/${version}/readme`);
        if (!res.ok) return '# README not available\n\nThis package does not include a README.md file.';
        return await res.text();
    },

    async getSkillDoc(name, version = 'latest') {
        const encodedName = encodeURIComponent(name);
        const res = await fetch(`${API_BASE}/${encodedName}/${version}/skill-doc`);
        if (!res.ok) return '# SKILL.md not available\n\nThis package does not include a SKILL.md file.';
        return await res.text();
    },

    async getInstallationGuide(name, version = 'latest') {
        const encodedName = encodeURIComponent(name);
        const res = await fetch(`${API_BASE}/${encodedName}/${version}/installation-guide`);
        if (!res.ok) return null;
        return await res.text();
    },

    async getObservations(name) {
        const encodedName = encodeURIComponent(name);
        const res = await fetch(`${API_BASE}/${encodedName}/observations`);
        if (!res.ok) return { observations: [] };
        return await res.json();
    },

    async createObservation(name, observation) {
        const encodedName = encodeURIComponent(name);
        const res = await fetch(`${API_BASE}/${encodedName}/observations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(observation)
        });
        if (!res.ok) throw new Error('Failed to create observation');
        return await res.json();
    },

    async getVersionManifest(name, version) {
        const encodedName = encodeURIComponent(name);
        const res = await fetch(`${API_BASE}/${encodedName}/${version}/manifest`);
        if (!res.ok) throw new Error('Failed to load version manifest');
        return await res.json();
    },

    async getDiff(name, baseVersion, headVersion) {
        const encodedName = encodeURIComponent(name);
        const res = await fetch(`${API_BASE}/${encodedName}/diff?base=${encodeURIComponent(baseVersion)}&head=${encodeURIComponent(headVersion)}`);
        if (!res.ok) throw new Error('Failed to fetch diff');
        return await res.json();
    },

    async getLineage(name, direction = 'both', depth = 5) {
        const encodedName = encodeURIComponent(name);
        const res = await fetch(`${API_BASE}/${encodedName}/lineage?direction=${direction}&depth=${depth}`);
        if (!res.ok) return null;
        return await res.json();
    }
};
