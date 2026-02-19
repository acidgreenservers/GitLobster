const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const GIT_PROJECT_ROOT = process.env.GITLOBSTER_STORAGE_DIR
    ? path.resolve(process.env.GITLOBSTER_STORAGE_DIR, 'git')
    : path.resolve(__dirname, '../storage/git');

// Path to the post-receive hook source
const POST_RECEIVE_HOOK_SOURCE = path.resolve(__dirname, '../scripts/git-hooks/post-receive.js');

// Git template directory for auto-installing hooks on new repos
const GIT_TEMPLATE_DIR = path.resolve(__dirname, '../storage/git-template');

/**
 * Initialize the git template directory with hooks.
 * This ensures new bare repos automatically get the post-receive hook.
 */
function initializeGitTemplate() {
    const hooksDir = path.join(GIT_TEMPLATE_DIR, 'hooks');
    const hookDest = path.join(hooksDir, 'post-receive');

    // Create template directory structure
    if (!fs.existsSync(hooksDir)) {
        fs.mkdirSync(hooksDir, { recursive: true });
    }

    // Copy the post-receive hook to template
    if (fs.existsSync(POST_RECEIVE_HOOK_SOURCE)) {
        fs.copyFileSync(POST_RECEIVE_HOOK_SOURCE, hookDest);
        fs.chmodSync(hookDest, 0o755);
        console.log('[GIT-MIDDLEWARE] Initialized git template with post-receive hook');
    } else {
        console.warn('[GIT-MIDDLEWARE] Warning: post-receive hook source not found at', POST_RECEIVE_HOOK_SOURCE);
    }
}

// Ensure git storage directory exists
if (!fs.existsSync(GIT_PROJECT_ROOT)) {
    fs.mkdirSync(GIT_PROJECT_ROOT, { recursive: true });
}

// Initialize git template directory
initializeGitTemplate();

/**
 * Convert scoped package name to directory-safe name
 * @scope/name -> scope-name.git
 */
function scopedToDirName(name) {
    return name.replace(/^@/, '').replace('/', '-') + '.git';
}

/**
 * Convert directory-safe name back to scoped package name
 * scope-name.git -> @scope/name
 */
function dirNameToScoped(name) {
    if (name.endsWith('.git')) {
        const base = name.slice(0, -4);
        // Check if it looks like a scoped package (contains -)
        if (base.includes('-')) {
            const parts = base.split(/-/);
            if (parts.length >= 2) {
                return '@' + parts[0] + '/' + parts.slice(1).join('/');
            }
        }
    }
    return name;
}

const gitMiddleware = (req, res, next) => {
    // Handle requests with /git/... prefix or direct .git access
    // Pattern: /git/:repo.git/* or /git/:repo.git or /:repo.git/*
    const gitRegex = /^\/git\/([a-zA-Z0-9_\-@\.]+\.git)(.*)$|^\/([a-zA-Z0-9_\-]+\.git)(.*)$/;
    const match = req.url.match(gitRegex);

    if (!match) return next();

    // Determine which group matched
    const repoName = match[1] || match[3];
    const pathInfo = (match[2] || match[4] || '/').replace(/^\/+/, '');

    // Security: Prevent directory traversal
    if (repoName.includes('..') || pathInfo.includes('..')) {
        return res.status(403).send('Forbidden');
    }

    // Convert scoped package names to directory-safe names
    const dirName = scopedToDirName(repoName);
    const repoPath = path.join(GIT_PROJECT_ROOT, dirName);

    // Fix: PATH_INFO must not include query string for git-http-backend
    const urlObj = new URL(req.originalUrl, 'http://localhost');
    const safePathInfo = urlObj.pathname;

    const env = {
        ...process.env,
        GIT_PROJECT_ROOT: GIT_PROJECT_ROOT,
        GIT_HTTP_EXPORT_ALL: '1',
        GIT_TEMPLATE_DIR: GIT_TEMPLATE_DIR,  // Auto-install hooks on new repos
        PATH_INFO: safePathInfo,
        REMOTE_USER: req.user ? req.user.id : 'anonymous',
        REMOTE_ADDR: req.ip,
        CONTENT_TYPE: req.headers['content-type'],
        QUERY_STRING: req.query ? new URLSearchParams(req.query).toString() : '',
        REQUEST_METHOD: req.method
    };

    console.log(`[GIT] ${req.method} ${req.url} -> Spawning git http-backend (repo: ${dirName})`);

    const git = spawn('git', ['http-backend'], {
        env,
        cwd: GIT_PROJECT_ROOT
    });

    // Pipe request body to git stdin (for POST git-receive-pack)
    req.pipe(git.stdin);

    let headersSent = false;
    let buffer = Buffer.alloc(0);

    git.stdout.on('data', (chunk) => {
        if (headersSent) {
            res.write(chunk);
            return;
        }

        buffer = Buffer.concat([buffer, chunk]);

        // Find double newline which separates headers from body
        const headerEnd = buffer.indexOf('\r\n\r\n');
        if (headerEnd !== -1) {
            const headerString = buffer.slice(0, headerEnd).toString('utf8');
            const body = buffer.slice(headerEnd + 4);

            // Parse headers
            const lines = headerString.split('\r\n');
            lines.forEach(line => {
                const [key, value] = line.split(': ');
                if (key && value) {
                    if (key.toLowerCase() === 'status') {
                        res.status(parseInt(value.split(' ')[0]));
                    } else {
                        res.setHeader(key, value);
                    }
                }
            });

            headersSent = true;
            res.write(body);
        } else {
            // Edge case: Header boundary might be split across chunks.
            if (buffer.length > 10 * 1024) {
                console.error('[GIT] Header buffer overflow');
                git.kill();
                res.status(500).send('Internal Server Error');
            }
        }
    });

    git.stdout.on('end', () => {
        if (headersSent) {
            res.end();
        }
    });

    git.stderr.on('data', (data) => {
        console.error(`[GIT-STDERR] ${data}`);
    });

    git.on('close', (code) => {
        if (!headersSent) {
            if (!res.headersSent) {
                res.status(500).send('Git process exited unexpectedly');
            }
        }
        console.log(`[GIT] Exited with code ${code}`);
    });
};

module.exports = gitMiddleware;
module.exports.scopedToDirName = scopedToDirName;
module.exports.dirNameToScoped = dirNameToScoped;
module.exports.GIT_PROJECT_ROOT = GIT_PROJECT_ROOT;
