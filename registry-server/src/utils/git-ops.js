const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const util = require('util');
const execPromise = util.promisify(exec);

const GIT_PROJECT_ROOT = process.env.GIT_PROJECT_ROOT || path.join(__dirname, '../../storage/git');

// Path to the post-receive hook template
const POST_RECEIVE_HOOK_PATH = path.join(__dirname, '../../scripts/git-hooks/post-receive.js');

/**
 * Install the post-receive hook into a bare repository.
 * This hook processes git pushes and updates the registry database.
 * 
 * @param {string} repoPath - Path to the bare Git repository
 * @returns {boolean} True if hook was installed successfully
 */
async function installPostReceiveHook(repoPath) {
    try {
        const hooksDir = path.join(repoPath, 'hooks');
        const hookPath = path.join(hooksDir, 'post-receive');

        // Ensure hooks directory exists
        if (!fs.existsSync(hooksDir)) {
            fs.mkdirSync(hooksDir, { recursive: true });
        }

        // Check if hook source exists
        if (!fs.existsSync(POST_RECEIVE_HOOK_PATH)) {
            console.warn(`[git-ops] Warning: Post-receive hook source not found at ${POST_RECEIVE_HOOK_PATH}`);
            return false;
        }

        // Copy the hook script
        fs.copyFileSync(POST_RECEIVE_HOOK_PATH, hookPath);

        // Make executable (chmod +x)
        fs.chmodSync(hookPath, 0o755);

        console.log(`[git-ops] Installed post-receive hook in ${repoPath}`);
        return true;
    } catch (error) {
        console.error(`[git-ops] Failed to install post-receive hook: ${error.message}`);
        return false;
    }
}

/**
 * Create a new bare Git repository with post-receive hook.
 * 
 * @param {string} repoName - Name of the repository (e.g., '@scope/package.git')
 * @returns {Promise<{success: boolean, path: string, error?: string}>}
 */
async function createBareRepo(repoName) {
    // Security: Validate repo name
    if (repoName.includes('..') || repoName.includes('\\')) {
        return { success: false, path: null, error: 'Invalid repo name' };
    }

    const repoPath = path.join(GIT_PROJECT_ROOT, repoName);

    try {
        // Ensure parent directory exists
        await execPromise(`mkdir -p "${path.dirname(repoPath)}"`);

        // Create bare repository
        await execPromise(`git init --bare "${repoPath}"`);

        // Install the post-receive hook
        await installPostReceiveHook(repoPath);

        return { success: true, path: repoPath };
    } catch (error) {
        return { success: false, path: repoPath, error: error.message };
    }
}

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

module.exports = {
    getManifest,
    mergeProposal,
    installPostReceiveHook,
    createBareRepo,
    GIT_PROJECT_ROOT
};
