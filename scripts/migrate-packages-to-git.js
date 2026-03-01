/**
 * Migration Script: Packages to Git
 *
 * This script migrates all existing packages from tarball storage to Git repositories.
 *
 * Process:
 * 1. For each package in the database:
 *    a. Create a bare Git repository in storage/git/
 *    b. Get all versions (sorted by date)
 *    c. For each version:
 *       - Extract tarball to temp directory
 *       - Git add all files
 *       - Git commit with version info
 *    d. Store commit hash in database
 *    e. Push to bare repo
 *
 * Usage: node scripts/migrate-packages-to-git.js
 */

const fs = require("fs");
const path = require("path");
const { execFileSync, exec } = require("child_process");
const util = require("util");
const execPromise = util.promisify(exec);

// Database setup
const DB_PATH = process.env.GITLOBSTER_STORAGE_DIR
  ? path.resolve(process.env.GITLOBSTER_STORAGE_DIR, "registry.sqlite")
  : path.join(__dirname, "../registry-server/storage/registry.sqlite");

const STORAGE_DIR = process.env.GITLOBSTER_STORAGE_DIR
  ? path.resolve(process.env.GITLOBSTER_STORAGE_DIR)
  : path.join(__dirname, "../registry-server/storage");

const GIT_DIR = path.join(STORAGE_DIR, "git");
const PACKAGES_DIR = path.join(STORAGE_DIR, "packages");
const TEMP_DIR = path.join(STORAGE_DIR, "temp-migration");

// Ensure directories exist
fs.mkdirSync(GIT_DIR, { recursive: true });
fs.mkdirSync(TEMP_DIR, { recursive: true });

// Knex database setup
const knex = require("knex")({
  client: "sqlite3",
  connection: { filename: DB_PATH },
  useNullAsDefault: true,
});

/**
 * Convert scoped package name to directory-safe name
 * @scope/name -> scope-name.git
 */
function scopedToDirName(name) {
  return name.replace(/^@/, "").replace("/", "-") + ".git";
}

/**
 * Generate gitlobster.json content from package and version data
 * V2.5: This is the canonical manifest file for packages
 */
function generateGitlobsterJson(pkg, version, manifestData) {
  // Parse manifest if it's a string
  let manifest = manifestData;
  if (typeof manifestData === "string") {
    try {
      manifest = JSON.parse(manifestData);
    } catch (e) {
      manifest = {};
    }
  }

  const gitlobster = {
    name: pkg.name,
    version: version.version,
  };

  // Add description (from manifest or package)
  if (manifest.description) {
    gitlobster.description = manifest.description;
  } else if (pkg.description) {
    gitlobster.description = pkg.description;
  }

  // Add author info if available
  if (manifest.author) {
    gitlobster.author = manifest.author;
  } else if (pkg.author_name) {
    gitlobster.author = { name: pkg.author_name };
    if (pkg.author_url) gitlobster.author.url = pkg.author_url;
  }

  // Add dependencies if in manifest
  if (manifest.dependencies) {
    gitlobster.dependencies = manifest.dependencies;
  }

  // Add keywords/tags
  if (manifest.keywords) {
    gitlobster.keywords = manifest.keywords;
  } else if (pkg.tags) {
    try {
      gitlobster.keywords =
        typeof pkg.tags === "string" ? JSON.parse(pkg.tags) : pkg.tags;
    } catch (e) {
      /* ignore */
    }
  }

  // Add license
  if (manifest.license || pkg.license) {
    gitlobster.license = manifest.license || pkg.license;
  }

  return JSON.stringify(gitlobster, null, 2);
}

/**
 * Parse YAML frontmatter from README content
 */
function parseFrontmatter(content) {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---/;
  const match = content.match(frontmatterRegex);
  if (!match) return null;

  const frontmatter = {};
  const lines = match[1].split("\n");
  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();
      frontmatter[key] = value;
    }
  }
  return frontmatter;
}

/**
 * Ensure README.md has proper YAML frontmatter with title matching package name
 * V2.5: Required for post-receive hook validation
 */
function ensureReadmeFrontmatter(readmeContent, pkgName, description) {
  const existingFrontmatter = parseFrontmatter(readmeContent || "");

  // Create the required frontmatter
  const frontmatter = {
    title: pkgName, // Must match gitlobster.json name
    description: description || "",
  };

  // If no README exists, create a basic one
  if (!readmeContent) {
    return `---
title: ${pkgName}
description: ${description || "A GitLobster package"}
---

# ${pkgName}

${description || "Package description goes here."}
`;
  }

  // If README exists but has no frontmatter, prepend it
  if (!existingFrontmatter) {
    return `---
title: ${pkgName}
description: ${description || ""}
---

${readmeContent}`;
  }

  // If README has frontmatter but wrong title, update it
  if (existingFrontmatter.title !== pkgName) {
    const frontmatterStr = `---
title: ${pkgName}
description: ${existingFrontmatter.description || description || ""}
---`;

    // Replace existing frontmatter
    return readmeContent.replace(/^---\s*\n[\s\S]*?\n---/, frontmatterStr);
  }

  // Frontmatter is correct, return as-is
  return readmeContent;
}

/**
 * Ensure commit_hash column exists in versions table
 */
async function ensureCommitHashColumn() {
  const hasColumn = await knex.schema.hasColumn("versions", "commit_hash");
  if (!hasColumn) {
    console.log("Adding commit_hash column to versions table...");
    await knex.schema.table("versions", (table) => {
      table.string("commit_hash"); // Git commit hash for this version
    });
    console.log("✓ commit_hash column added");
  }
}

/**
 * Extract tarball to a directory
 */
async function extractTarball(tarballPath, destDir) {
  // Clean destination
  if (fs.existsSync(destDir)) {
    fs.rmSync(destDir, { recursive: true });
  }
  fs.mkdirSync(destDir, { recursive: true });

  // Extract tarball (tar -xzf for gzipped)
  try {
    execFileSync("tar", ["-xzf", tarballPath, "-C", destDir], {
      encoding: "utf-8",
    });

    // Handle tarball that extracts to a single root directory
    const entries = fs.readdirSync(destDir);
    if (entries.length === 1) {
      const innerDir = path.join(destDir, entries[0]);
      if (fs.statSync(innerDir).isDirectory()) {
        // Move contents up
        const tempInner = path.join(TEMP_DIR, "inner-" + Date.now());
        fs.renameSync(innerDir, tempInner);
        fs.rmSync(destDir, { recursive: true });
        fs.renameSync(tempInner, destDir);
      }
    }
  } catch (err) {
    console.error(`Failed to extract ${tarballPath}: ${err.message}`);
    throw err;
  }
}

/**
 * Create initial commit in a git repo
 */
async function initGitRepo(repoPath, packageName, version) {
  const workDir = path.join(
    TEMP_DIR,
    `work-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  );

  try {
    // Create working directory and init git
    fs.mkdirSync(workDir, { recursive: true });
    execFileSync("git", ["init"], { cwd: workDir, encoding: "utf-8" });

    // Configure git identity
    execFileSync("git", ["config", "user.name", "GitLobster Migration"], {
      cwd: workDir,
      encoding: "utf-8",
    });
    execFileSync(
      "git",
      ["config", "user.email", "migration@gitlobster.network"],
      { cwd: workDir, encoding: "utf-8" },
    );

    // Add all files
    execFileSync("git", ["add", "-A"], { cwd: workDir, encoding: "utf-8" });

    // Check if there are any files to commit
    const status = execFileSync("git", ["status", "--porcelain"], {
      cwd: workDir,
      encoding: "utf-8",
    });

    if (status.trim()) {
      // Create commit with version info
      execFileSync(
        "git",
        ["commit", "-m", `Initial commit: ${packageName}@${version}`],
        { cwd: workDir, encoding: "utf-8" },
      );

      // Get commit hash
      const hash = execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: workDir,
        encoding: "utf-8",
      }).trim();

      // Create bare repo
      if (fs.existsSync(repoPath)) {
        fs.rmSync(repoPath, { recursive: true });
      }
      execFileSync("git", ["clone", "--bare", workDir, repoPath], {
        encoding: "utf-8",
      });

      return hash;
    } else {
      console.log(`  No files to commit for ${packageName}@${version}`);
      return null;
    }
  } finally {
    // Cleanup working directory
    if (fs.existsSync(workDir)) {
      fs.rmSync(workDir, { recursive: true });
    }
  }
}

/**
 * Add a new version commit to an existing bare repo
 * V2.5: Now generates gitlobster.json and ensures README.md frontmatter
 */
async function addVersionCommit(
  repoPath,
  packageName,
  version,
  tarballPath,
  pkg,
  versionData,
) {
  const workDir = path.join(
    TEMP_DIR,
    `work-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  );

  try {
    // Clone the bare repo to work dir
    execFileSync("git", ["clone", repoPath, workDir], { encoding: "utf-8" });

    // Configure git identity
    execFileSync("git", ["config", "user.name", "GitLobster Migration"], {
      cwd: workDir,
      encoding: "utf-8",
    });
    execFileSync(
      "git",
      ["config", "user.email", "migration@gitlobster.network"],
      { cwd: workDir, encoding: "utf-8" },
    );

    // Extract tarball to work dir
    const extractDir = path.join(workDir, "package-content");
    await extractTarball(tarballPath, extractDir);

    // Move contents to root (except .git)
    const files = fs.readdirSync(extractDir);
    for (const file of files) {
      if (file !== ".git") {
        const src = path.join(extractDir, file);
        const dst = path.join(workDir, file);
        fs.renameSync(src, dst);
      }
    }
    fs.rmSync(extractDir, { recursive: true });

    // V2.5: Generate gitlobster.json from manifest data
    const manifestData = versionData?.manifest || null;
    const gitlobsterJson = generateGitlobsterJson(
      pkg,
      { version },
      manifestData,
    );
    fs.writeFileSync(path.join(workDir, "gitlobster.json"), gitlobsterJson);
    console.log(`    ✓ Generated gitlobster.json`);

    // V2.5: Ensure README.md has proper frontmatter
    const readmePath = path.join(workDir, "README.md");
    let readmeContent = null;
    if (fs.existsSync(readmePath)) {
      readmeContent = fs.readFileSync(readmePath, "utf-8");
    }
    const updatedReadme = ensureReadmeFrontmatter(
      readmeContent,
      pkg.name,
      pkg.description ||
        (manifestData ? JSON.parse(manifestData).description : null),
    );
    fs.writeFileSync(readmePath, updatedReadme);
    console.log(`    ✓ Ensured README.md frontmatter`);

    // Add all files
    execFileSync("git", ["add", "-A"], { cwd: workDir, encoding: "utf-8" });

    // Check if there are changes to commit
    const status = execFileSync("git", ["status", "--porcelain"], {
      cwd: workDir,
      encoding: "utf-8",
    });

    if (status.trim()) {
      // Create commit with version info
      execFileSync(
        "git",
        ["commit", "-m", `Version ${version} of ${packageName}`],
        { cwd: workDir, encoding: "utf-8" },
      );

      // Push to bare repo
      execFileSync("git", ["push", "origin", "master"], {
        cwd: workDir,
        encoding: "utf-8",
      });

      // Get commit hash
      const hash = execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: workDir,
        encoding: "utf-8",
      }).trim();

      return hash;
    } else {
      console.log(`  No changes for version ${version}`);
      return null;
    }
  } finally {
    // Cleanup working directory
    if (fs.existsSync(workDir)) {
      fs.rmSync(workDir, { recursive: true });
    }
  }
}

/**
 * Main migration function
 */
async function migrate() {
  console.log("===========================================");
  console.log("  Package to Git Migration Script");
  console.log("===========================================");
  console.log("");
  console.log(`Storage Directory: ${STORAGE_DIR}`);
  console.log(`Git Directory: ${GIT_DIR}`);
  console.log(`Database: ${DB_PATH}`);
  console.log("");

  // Check database exists
  if (!fs.existsSync(DB_PATH)) {
    console.error("Database not found!");
    process.exit(1);
  }

  // Ensure commit_hash column exists
  await ensureCommitHashColumn();

  // Get all packages
  console.log("\nFetching packages from database...");
  const packages = await knex("packages").select("*");
  console.log(`Found ${packages.length} packages\n`);

  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  for (const pkg of packages) {
    console.log(`\nProcessing: ${pkg.name}`);
    console.log("-".repeat(40));

    try {
      // Get all versions for this package, sorted by date
      const versions = await knex("versions")
        .where({ package_name: pkg.name })
        .orderBy("published_at", "asc");

      if (versions.length === 0) {
        console.log("  Skipping: No versions found");
        skippedCount++;
        continue;
      }

      console.log(`  Found ${versions.length} versions`);

      // Create bare repo path
      const dirName = scopedToDirName(pkg.name);
      const repoPath = path.join(GIT_DIR, dirName);

      let commitHash = null;

      // Process each version
      for (let i = 0; i < versions.length; i++) {
        const v = versions[i];

        // Resolve storage_path to absolute path
        let tarballPath = v.storage_path;
        if (!path.isAbsolute(tarballPath)) {
          tarballPath = path.join(STORAGE_DIR, tarballPath);
        }

        console.log(`  Version ${v.version}:`);

        // Check if tarball exists
        if (!fs.existsSync(tarballPath)) {
          console.log(`    ⚠️  Tarball not found: ${tarballPath}`);
          continue;
        }

        try {
          if (i === 0) {
            // First version - create initial commit
            console.log(`    Creating initial commit...`);
            commitHash = await initGitRepo(repoPath, pkg.name, v.version);
          } else {
            // Subsequent versions - add commit (V2.5: with gitlobster.json and README frontmatter)
            console.log(`    Adding version commit...`);
            commitHash = await addVersionCommit(
              repoPath,
              pkg.name,
              v.version,
              tarballPath,
              pkg,
              v,
            );
          }

          if (commitHash) {
            console.log(`    ✓ Commit: ${commitHash.substring(0, 8)}`);

            // Update database with commit hash
            await knex("versions")
              .where({ package_name: pkg.name, version: v.version })
              .update({ commit_hash: commitHash });
          }
        } catch (verr) {
          console.log(`    ✗ Error: ${verr.message}`);
        }
      }

      // Verify repo was created
      if (fs.existsSync(repoPath)) {
        console.log(`  ✓ Git repo created: ${dirName}`);
        successCount++;
      } else {
        console.log(`  ⚠️  Git repo not created`);
        errorCount++;
      }
    } catch (err) {
      console.log(`  ✗ Error: ${err.message}`);
      errorCount++;
    }
  }

  // Summary
  console.log("\n===========================================");
  console.log("  Migration Complete");
  console.log("===========================================");
  console.log(`  Successful: ${successCount}`);
  console.log(`  Errors: ${errorCount}`);
  console.log(`  Skipped: ${skippedCount}`);
  console.log("");

  // Cleanup temp directory
  if (fs.existsSync(TEMP_DIR)) {
    fs.rmSync(TEMP_DIR, { recursive: true });
  }

  // Close database connection
  await knex.destroy();

  process.exit(errorCount > 0 ? 1 : 0);
}

// Run migration
migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
