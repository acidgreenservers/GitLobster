/**
 * Tarball — Post-Receive Hook Library
 *
 * Generates .tgz tarballs from git commits and calculates
 * per-file SHA-256 hashes for the file integrity manifest.
 *
 * Features:
 *   - Retry logic (3x with exponential backoff)
 *   - Exit 1 on permanent failure (no silent swallowing)
 *   - Per-file SHA-256 file manifest calculation
 */

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

/**
 * Resolve the storage directory from environment.
 * Adjusts paths for the lib/ subdirectory nesting.
 *
 * @returns {string} Absolute path to storage directory
 */
function resolveStorageDir() {
  if (process.env.GITLOBSTER_STORAGE_DIR) {
    return path.resolve(process.env.GITLOBSTER_STORAGE_DIR);
  }
  // Default: registry-server/storage (3 levels up from lib/)
  return path.resolve(__dirname, "../../../storage");
}

/**
 * Generate a .tgz tarball from a git commit using git archive.
 * Retries up to 3 times with exponential backoff.
 * Updates the versions row with storage_path and hash.
 *
 * EXITS 1 on permanent failure — tarball is required for downloads.
 *
 * @param {string} packageName - Package name (e.g., @alice/skill)
 * @param {string} version - Semver version string
 * @param {string} commitHash - Git commit SHA
 * @param {import('knex').Knex} db - Knex instance
 * @returns {Promise<{ tarballPath: string, hash: string, relativePath: string }>}
 */
async function generateTarball(packageName, version, commitHash, db) {
  const STORAGE_DIR = resolveStorageDir();
  const packageDir = path.join(STORAGE_DIR, "packages", packageName);
  fs.mkdirSync(packageDir, { recursive: true });

  const tarballPath = path.join(packageDir, `${version}.tgz`);
  const gitDir = process.env.GIT_DIR || process.cwd();
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(
        `[TARBALL] Generating tarball (attempt ${attempt}/${maxRetries})...`,
      );

      execFileSync(
        "git",
        [
          "archive",
          "--format=tar.gz",
          "--prefix=package/",
          "-o",
          tarballPath,
          commitHash,
        ],
        { cwd: gitDir },
      );

      // Calculate SHA-256 hash of the tarball
      const tarballBuffer = fs.readFileSync(tarballPath);
      const hash = `sha256:${crypto.createHash("sha256").update(tarballBuffer).digest("hex")}`;
      const relativePath = path.relative(STORAGE_DIR, tarballPath);

      // Update database
      await db("versions")
        .where({ package_name: packageName, version })
        .update({
          storage_path: relativePath,
          hash: hash,
        });

      console.log(`[TARBALL] ✅ Generated: ${relativePath} (${hash})`);
      return { tarballPath, hash, relativePath };
    } catch (err) {
      console.error(
        `[TARBALL] Attempt ${attempt}/${maxRetries} failed: ${err.message}`,
      );

      if (attempt === maxRetries) {
        console.error(
          "[TARBALL] 🔴 CRITICAL: Tarball generation permanently failed",
        );
        console.error(
          "[TARBALL] Push rejected. Check git permissions and disk space.",
        );
        process.exit(1);
      }

      // Exponential backoff
      const backoffMs = 1000 * attempt;
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }
}

/**
 * Calculate per-file SHA-256 hashes from a tarball.
 * Extracts to a temp directory, walks all files, hashes each.
 *
 * Uses git archive directly (no tar dependency needed) for extraction
 * since the tarball was created with --prefix=package/.
 *
 * @param {string} commitHash - Git commit SHA (used for git ls-tree)
 * @returns {object} { "README.md": "sha256:...", "SKILL.md": "sha256:...", ... }
 */
function calculateFileManifest(commitHash) {
  const gitDir = process.env.GIT_DIR || process.cwd();
  const fileManifest = {};

  try {
    // List all files in the commit tree
    const treeOutput = execFileSync(
      "git",
      ["ls-tree", "-r", "--name-only", commitHash],
      { encoding: "utf8", cwd: gitDir },
    );

    const files = treeOutput.trim().split("\n").filter(Boolean);

    for (const file of files) {
      try {
        // Get file content directly from git
        const content = execFileSync("git", ["show", `${commitHash}:${file}`], {
          cwd: gitDir,
        });

        const hash = `sha256:${crypto.createHash("sha256").update(content).digest("hex")}`;
        fileManifest[file] = hash;
      } catch (fileErr) {
        console.warn(`[TARBALL] ⚠️ Could not hash ${file}: ${fileErr.message}`);
      }
    }

    console.log(
      `[TARBALL] ✅ File manifest calculated: ${Object.keys(fileManifest).length} files`,
    );
  } catch (err) {
    console.error(
      `[TARBALL] ⚠️ File manifest calculation failed: ${err.message}`,
    );
  }

  return fileManifest;
}

module.exports = {
  generateTarball,
  calculateFileManifest,
};
