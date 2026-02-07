const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const GIT_PROJECT_ROOT = process.env.GITLOBSTER_STORAGE_DIR
    ? path.resolve(process.env.GITLOBSTER_STORAGE_DIR)
    : path.resolve(__dirname, '../storage');

const gitMiddleware = (req, res, next) => {
    // Only handle requests that look like git operations
    // Pattern: /:repo.git/* or /:repo.git
    const gitRegex = /^\/([a-zA-Z0-9_\-]+\.git)(.*)$/;
    const match = req.url.match(gitRegex);

    if (!match) return next();

    const repoName = match[1];
    const pathInfo = match[2] || '/'; // The rest of the path, e.g. /info/refs?service=git-upload-pack

    // Security: Prevent directory traversal
    if (repoName.includes('..') || pathInfo.includes('..')) {
        return res.status(403).send('Forbidden');
    }

    const repoPath = path.join(GIT_PROJECT_ROOT, repoName);

    // Initial check if repo exists is skipped here because git-http-backend handles it,
    // but better to check to avoid spawning unnecessary processes.
    // However, for correct error messages from git, we can just let it handle it.

    // Fix: PATH_INFO must not include query string for git-http-backend
    // req.path is usually the path without query in Express, but let's be explicitly safe parsing originalUrl
    const urlObj = new URL(req.originalUrl, 'http://localhost');
    const safePathInfo = urlObj.pathname;

    const env = {
        ...process.env,
        GIT_PROJECT_ROOT: GIT_PROJECT_ROOT,
        GIT_HTTP_EXPORT_ALL: '1',
        PATH_INFO: safePathInfo, // Use pathname only (e.g. /repo.git/info/refs)
        REMOTE_USER: req.user ? req.user.id : 'anonymous', // If we have auth
        REMOTE_ADDR: req.ip,
        CONTENT_TYPE: req.headers['content-type'],
        QUERY_STRING: req.query ? new URLSearchParams(req.query).toString() : '',
        REQUEST_METHOD: req.method
    };

    console.log(`[GIT] ${req.method} ${req.url} -> Spawning git http-backend`);

    const git = spawn('git', ['http-backend'], {
        env,
        cwd: GIT_PROJECT_ROOT
    });

    // Pipe request body to git stdin (for POST git-receive-pack)
    req.pipe(git.stdin);

    // Pipe git stdout to response, but we need to parse headers first?
    // git http-backend outputs CGI headers (Status, Content-Type, etc.) followed by body.
    // Node generic piping won't parse those headers automatically.
    // We need a simple CGI parser.

    // Actually, for simplicity, we can buffer headers or use a simple state machine.
    // But handling binary git data + headers in a stream is tricky.

    // ALTERNATIVE: Use 'zlib' if needed? No, http-backend handles compression.

    // Let's implement a rudimentary CGI header parser.

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
            // Wait for more data.
            // If buffer gets too large without headers, abort (safety).
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
            // Process ended without sending headers (error case)
            if (!res.headersSent) {
                res.status(500).send('Git process exited unexpectedly');
            }
        }
        console.log(`[GIT] Exited with code ${code}`);
    });
};

module.exports = gitMiddleware;
