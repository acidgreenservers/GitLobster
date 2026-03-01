/**
 * Git Utilities
 * Helper functions for Git operations
 */

import { execFileSync, spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';

/**
 * Check if git is available in PATH
 * @returns {boolean} True if git is available
 */
export function checkGitAvailable() {
  try {
    execFileSync('git', ['--version'], { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Initialize a Git repository
 * @param {string} path - Path to initialize the repo
 * @returns {object} Result with success boolean and output
 */
export function initRepo(path) {
  const repoPath = resolve(path);
  
  try {
    execFileSync('git', ['init'], { cwd: repoPath, stdio: 'pipe' });
    return { success: true, message: 'Git repository initialized' };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

/**
 * Add files to Git staging
 * @param {string[]} files - Array of file paths to add
 * @param {object} options - Options including cwd
 * @returns {object} Result with success boolean and output
 */
export function addFiles(files, options = {}) {
  const { cwd = process.cwd() } = options;
  
  if (!files || files.length === 0) {
    return { success: false, message: 'No files to add' };
  }

  try {
    execFileSync('git', ['add', ...files], { cwd, stdio: 'pipe' });
    return { success: true, message: `Added ${files.length} file(s) to staging` };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

/**
 * Commit staged changes
 * @param {string} message - Commit message
 * @param {object} author - Author object with name and email
 * @param {object} options - Options including cwd
 * @returns {object} Result with success boolean and output
 */
export function commit(message, author, options = {}) {
  const { cwd = process.cwd() } = options;
  
  if (!message) {
    return { success: false, message: 'Commit message is required' };
  }

  if (!author || !author.name || !author.email) {
    return { success: false, message: 'Author name and email are required' };
  }

  try {
    const env = {
      ...process.env,
      GIT_AUTHOR_NAME: author.name,
      GIT_AUTHOR_EMAIL: author.email,
      GIT_COMMITTER_NAME: author.name,
      GIT_COMMITTER_EMAIL: author.email
    };
    
    execFileSync('git', ['commit', '-m', message], { cwd, stdio: 'pipe', env });
    return { success: true, message: 'Changes committed successfully' };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

/**
 * Push to remote repository
 * @param {string} remote - Remote name (e.g., 'origin')
 * @param {string} branch - Branch name (e.g., 'main')
 * @param {object} options - Options including cwd
 * @returns {object} Result with success boolean and output
 */
export function push(remote, branch, options = {}) {
  const { cwd = process.cwd() } = options;
  
  if (!remote || !branch) {
    return { success: false, message: 'Remote and branch are required' };
  }

  try {
    execFileSync('git', ['push', remote, branch], { cwd, stdio: 'pipe' });
    return { success: true, message: `Pushed to ${remote}/${branch}` };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

/**
 * Get remote URL
 * @param {string} remote - Remote name (e.g., 'origin')
 * @param {object} options - Options including cwd
 * @returns {string|null} Remote URL or null if not found
 */
export function getRemoteUrl(remote, options = {}) {
  const { cwd = process.cwd() } = options;
  
  if (!remote) {
    return null;
  }

  try {
    const url = execFileSync('git', ['remote', 'get-url', remote], { cwd, encoding: 'utf-8' }).trim();
    return url || null;
  } catch (error) {
    return null;
  }
}

/**
 * Add a remote
 * @param {string} name - Remote name (e.g., 'origin')
 * @param {string} url - Remote URL
 * @param {object} options - Options including cwd
 * @returns {object} Result with success boolean and output
 */
export function addRemote(name, url, options = {}) {
  const { cwd = process.cwd() } = options;
  
  if (!name || !url) {
    return { success: false, message: 'Remote name and URL are required' };
  }

  try {
    // Check if remote already exists
    const existingUrl = getRemoteUrl(name, { cwd });
    if (existingUrl) {
      return { success: true, message: `Remote '${name}' already exists with URL: ${existingUrl}` };
    }

    execFileSync('git', ['remote', 'add', name, url], { cwd, stdio: 'pipe' });
    return { success: true, message: `Remote '${name}' added` };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

/**
 * Get staged files diff
 * @param {object} options - Options including cwd
 * @returns {string} Diff output
 */
export function getStagedDiff(options = {}) {
  const { cwd = process.cwd() } = options;

  try {
    const diff = execFileSync('git', ['diff', '--staged'], { cwd, encoding: 'utf-8' });
    return diff;
  } catch (error) {
    return '';
  }
}

/**
 * Check if directory is a git repository
 * @param {string} path - Path to check
 * @returns {boolean} True if it's a git repository
 */
export function isGitRepo(path) {
  const repoPath = resolve(path);
  const gitDir = resolve(repoPath, '.git');
  return existsSync(gitDir);
}

/**
 * Get current branch name
 * @param {object} options - Options including cwd
 * @returns {string|null} Current branch name or null
 */
export function getCurrentBranch(options = {}) {
  const { cwd = process.cwd() } = options;

  try {
    const branch = execFileSync('git', ['branch', '--show-current'], { cwd, encoding: 'utf-8' }).trim();
    return branch || null;
  } catch (error) {
    return null;
  }
}
