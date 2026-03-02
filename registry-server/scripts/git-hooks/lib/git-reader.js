/**
 * Git Reader — Post-Receive Hook Library
 *
 * Handles all Git I/O for the post-receive hook:
 *   - Reading push info from stdin
 *   - Extracting file content from commits
 *   - Getting commit author information
 *   - Parsing YAML frontmatter
 *
 * SECURITY: All Git commands use execFileSync with argument arrays
 * to prevent command injection.
 */

const { execFileSync } = require("child_process");
const fs = require("fs");

/**
 * Read git push info from stdin.
 * Format: oldrev newrev refname
 *
 * @returns {{ oldRev: string, newRev: string, refName: string }}
 */
function readStdin() {
  let stdinData = "";
  try {
    stdinData = fs.readFileSync("/dev/stdin", "utf8").trim();
  } catch (err) {
    console.error("[POST-RECEIVE] Failed to read stdin:", err.message);
    process.exit(1);
  }

  if (!stdinData) {
    console.log("[POST-RECEIVE] No data received, exiting");
    process.exit(0);
  }

  const parts = stdinData.split(" ");
  if (parts.length < 3) {
    console.error("[POST-RECEIVE] Invalid input format");
    process.exit(1);
  }

  const oldRev = parts[0];
  const newRev = parts[1];
  const refName = parts[2];

  // SECURITY: Validate commit hash format to prevent injection
  if (!/^[0-9a-f]{40,64}$/.test(newRev)) {
    console.error(`[POST-RECEIVE] ❌ Invalid commit hash format: ${newRev}`);
    process.exit(1);
  }

  return { oldRev, newRev, refName };
}

/**
 * Get file content from a specific commit.
 * SECURITY: Uses execFileSync with argument array — no shell injection.
 *
 * @param {string} commitHash - The commit SHA
 * @param {string} filePath - Path within the repository
 * @returns {string|null} File content or null if not found
 */
function getFileFromCommit(commitHash, filePath) {
  try {
    const content = execFileSync("git", ["show", `${commitHash}:${filePath}`], {
      encoding: "utf8",
      cwd: process.env.GIT_DIR || process.cwd(),
    });
    return content;
  } catch (err) {
    console.error(
      `[GIT-READER] Failed to get ${filePath} from commit ${commitHash}: ${err.message}`,
    );
    return null;
  }
}

/**
 * Get commit author name and email.
 * SECURITY: Uses execFileSync with argument array.
 *
 * @param {string} commitHash - The commit SHA
 * @returns {{ author_name: string, author_email: string }}
 */
function getCommitAuthor(commitHash) {
  try {
    const output = execFileSync(
      "git",
      ["log", "-1", "--format=%an|%ae", commitHash],
      {
        encoding: "utf8",
        cwd: process.env.GIT_DIR || process.cwd(),
      },
    ).trim();

    const [author_name, author_email] = output.split("|");
    return { author_name, author_email };
  } catch (err) {
    console.error(
      `[GIT-READER] Failed to get author for commit ${commitHash}: ${err.message}`,
    );
    return { author_name: "unknown", author_email: "unknown" };
  }
}

/**
 * Parse YAML frontmatter from markdown content.
 * Format:
 *   ---
 *   title: Package Name
 *   description: Some description
 *   ---
 *
 * @param {string} content - Markdown content
 * @returns {object|null} Parsed key-value frontmatter or null
 */
function parseFrontmatter(content) {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return null;
  }

  const frontmatter = {};
  match[1].split("\n").forEach((line) => {
    const colonIndex = line.indexOf(":");
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim();
      frontmatter[key] = value;
    }
  });

  return frontmatter;
}

/**
 * Extract agent signature info from a manifest.
 * Returns null if the manifest is unsigned (legacy).
 *
 * @param {object} manifest - Parsed gitlobster.json
 * @returns {{ signature: string, publicKey: string }|null}
 */
function extractAgentSignature(manifest) {
  if (!manifest.agentSignature) {
    return null;
  }

  return {
    signature: manifest.agentSignature,
    publicKey: manifest.agentPublicKey,
  };
}

module.exports = {
  readStdin,
  getFileFromCommit,
  getCommitAuthor,
  parseFrontmatter,
  extractAgentSignature,
};
