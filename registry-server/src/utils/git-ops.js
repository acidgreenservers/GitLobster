const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const util = require('util');
const execPromise = util.promisify(exec);

const GIT_PROJECT_ROOT = process.env.GIT_PROJECT_ROOT || path.join(__dirname, '../../storage');

/**
 * Execute a git command in the context of a repo.
 */
async function git(repoName, args) {
    const repoPath = path.join(GIT_PROJECT_ROOT, repoName);
    if (!fs.existsSync(repoPath)) throw new Error(`Repo not found: ${repoName}`); // Safety check

    // Security: Ensure repoName is clean (no ..)
    if (repoName.includes('..') || repoName.includes('/') || repoName.includes('\\')) {
        throw new Error('Invalid repo name');
    }

    const { stdout, stderr } = await execPromise(`git ${args}`, { cwd: repoPath });
    return stdout.trim();
}

/**
 * Read manifest.json from a specific ref (branch/commit).
 */
async function getManifest(repoName, ref) {
    try {
        const content = await git(repoName, `show ${ref}:manifest.json`);
        return JSON.parse(content);
    } catch (e) {
        // Manifest might not exist in base or head
        return null;
    }
}

/**
 * Perform the merge of headRef into baseRef.
 * Returns the new commit hash.
 */
async function mergeProposal(repoName, baseRef, headRef, proposalId) {
    // 1. Checkout base
    // Note: In a bare repo, we can't 'checkout'. We must use low-level plumbing or a worktree.
    // For MVP, assuming bare repo on server:
    // We can use 'git merge-tree' to calculate the result in memory and 'git commit-tree' to write it.
    // OR simpler: use a temporary worktree.

    // For simplicity and robustness in this MVP phase, we'll assume we can use a temporary directory clone
    // to perform the merge and push back. This is safer than manipulating bare repo internals directly.

    const tmpDir = path.join('/tmp', `gitlobster-merge-${proposalId}-${Date.now()}`);
    const repoPath = path.join(GIT_PROJECT_ROOT, repoName);

    try {
        // Clone locally
        await execPromise(`git clone "${repoPath}" "${tmpDir}"`);

        // Checkout target branch
        await execPromise(`git checkout ${baseRef}`, { cwd: tmpDir });

        // Config identity for the merge commit (The Agent "Hand")
        await execPromise(`git config user.name "GitLobster Auto-Merge"`, { cwd: tmpDir });
        await execPromise(`git config user.email "bot@gitlobster.network"`, { cwd: tmpDir });

        // Merge
        // --no-ff to create a merge commit that records the proposal ID? 
        // Or fast-forward if possible? Let's do --no-ff to preserve history of the PR.
        await execPromise(`git merge origin/${headRef} --no-ff -m "Merge Proposal ${proposalId}"`, { cwd: tmpDir });

        // Push back
        await execPromise(`git push origin ${baseRef}`, { cwd: tmpDir });

        // Get new hash
        const { stdout: newHash } = await execPromise(`git rev-parse HEAD`, { cwd: tmpDir });
        return newHash.trim();

    } finally {
        // Cleanup
        await execPromise(`rm -rf "${tmpDir}"`);
    }
}

module.exports = { getManifest, mergeProposal };
