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

    async getSkillDoc(name, version = 'latest') {
        const encodedName = encodeURIComponent(name);
        const res = await fetch(`${API_BASE}/${encodedName}/${version}/skill-doc`);
        if (!res.ok) return '# SKILL.md not available\n\nThis package does not include a SKILL.md file.';
        return await res.text();
    },

    async getBranches(name) {
        const encodedName = encodeURIComponent(name);
        const res = await fetch(`${API_BASE}/${encodedName}/branches`);
        if (!res.ok) return [];
        return await res.json();
    },

    async getTags(name) {
        const encodedName = encodeURIComponent(name);
        const res = await fetch(`${API_BASE}/${encodedName}/tags`);
        if (!res.ok) return [];
        return await res.json();
    },

    async getCommits(name, ref = 'HEAD') {
        const encodedName = encodeURIComponent(name);
        const res = await fetch(`${API_BASE}/${encodedName}/commits?ref=${encodeURIComponent(ref)}`);
        if (!res.ok) return [];
        return await res.json();
    },

    async getTree(name, path = '', ref = 'HEAD') {
        const encodedName = encodeURIComponent(name);
        const res = await fetch(`${API_BASE}/${encodedName}/tree?path=${encodeURIComponent(path)}&ref=${encodeURIComponent(ref)}`);
        if (!res.ok) return [];
        return await res.json();
    },

    async getRawFile(name, path, ref = 'HEAD') {
        const encodedName = encodeURIComponent(name);
        const res = await fetch(`${API_BASE}/${encodedName}/raw?path=${encodeURIComponent(path)}&ref=${encodeURIComponent(ref)}`);
        if (!res.ok) return null;
        return await res.text();
    },

    // Issues
    async getIssues(name, state = 'open') {
        const encodedName = encodeURIComponent(name);
        const res = await fetch(`${API_BASE}/${encodedName}/issues?state=${state}`);
        if (!res.ok) return [];
        return await res.json();
    },

    async createIssue(name, title, body) {
        const encodedName = encodeURIComponent(name);
        const res = await fetch(`${API_BASE}/${encodedName}/issues`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, body })
        });
        if (!res.ok) throw new Error('Failed to create issue');
        return await res.json();
    },

    async getIssue(name, number) {
        const encodedName = encodeURIComponent(name);
        const res = await fetch(`${API_BASE}/${encodedName}/issues/${number}`);
        if (!res.ok) return null;
        return await res.json();
    },

    async updateIssue(name, number, data) {
        const encodedName = encodeURIComponent(name);
        const res = await fetch(`${API_BASE}/${encodedName}/issues/${number}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Failed to update issue');
        return await res.json();
    },

    async getComments(name, number) {
        const encodedName = encodeURIComponent(name);
        const res = await fetch(`${API_BASE}/${encodedName}/issues/${number}/comments`);
        if (!res.ok) return [];
        return await res.json();
    },

    async createComment(name, number, body) {
        const encodedName = encodeURIComponent(name);
        const res = await fetch(`${API_BASE}/${encodedName}/issues/${number}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ body })
        });
        if (!res.ok) throw new Error('Failed to create comment');
        return await res.json();
    },

    // Pull Requests
    async getPulls(name, state = 'open') {
        const encodedName = encodeURIComponent(name);
        const res = await fetch(`${API_BASE}/${encodedName}/pulls?state=${state}`);
        if (!res.ok) return [];
        return await res.json();
    },

    async createPull(name, title, body, base, head) {
        const encodedName = encodeURIComponent(name);
        const res = await fetch(`${API_BASE}/${encodedName}/pulls`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, body, base_branch: base, head_branch: head })
        });
        if (!res.ok) throw new Error('Failed to create PR');
        return await res.json();
    },

    async getPull(name, number) {
        const encodedName = encodeURIComponent(name);
        const res = await fetch(`${API_BASE}/${encodedName}/pulls/${number}`);
        if (!res.ok) return null;
        return await res.json();
    },

    async updatePull(name, number, data) {
        const encodedName = encodeURIComponent(name);
        const res = await fetch(`${API_BASE}/${encodedName}/pulls/${number}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Failed to update PR');
        return await res.json();
    },

    async mergePull(name, number) {
        const encodedName = encodeURIComponent(name);
        const res = await fetch(`${API_BASE}/${encodedName}/pulls/${number}/merge`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        if (!res.ok) throw new Error('Failed to merge PR');
        return await res.json();
    },

    // Releases
    async getReleases(name) {
        const encodedName = encodeURIComponent(name);
        const res = await fetch(`${API_BASE}/${encodedName}/releases`);
        if (!res.ok) return [];
        return await res.json();
    },

    async createRelease(name, data) {
        const encodedName = encodeURIComponent(name);
        const res = await fetch(`${API_BASE}/${encodedName}/releases`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Failed to create release');
        return await res.json();
    },

    // Wiki
    async getWikiPages(name) {
        const encodedName = encodeURIComponent(name);
        const res = await fetch(`${API_BASE}/${encodedName}/wiki`);
        if (!res.ok) return [];
        return await res.json();
    },

    async getWikiPage(name, slug) {
        const encodedName = encodeURIComponent(name);
        const res = await fetch(`${API_BASE}/${encodedName}/wiki/${slug}`);
        if (!res.ok) return null;
        return await res.json();
    },

    async createWikiPage(name, data) {
        const encodedName = encodeURIComponent(name);
        const res = await fetch(`${API_BASE}/${encodedName}/wiki`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Failed to create wiki page');
        return await res.json();
    },

    async updateWikiPage(name, slug, data) {
        const encodedName = encodeURIComponent(name);
        const res = await fetch(`${API_BASE}/${encodedName}/wiki/${slug}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Failed to update wiki page');
        return await res.json();
    },

    // Settings
    async getSettings(name) {
        const encodedName = encodeURIComponent(name);
        const res = await fetch(`${API_BASE}/${encodedName}/settings`);
        if (!res.ok) return {};
        return await res.json();
    },

    async updateSettings(name, data) {
        const encodedName = encodeURIComponent(name);
        const res = await fetch(`${API_BASE}/${encodedName}/settings`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Failed to update settings');
        return await res.json();
    }
};
