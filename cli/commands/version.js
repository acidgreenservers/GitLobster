/**
 * Version Management Commands
 * Commands for version bumping and version history viewing
 */

import { readFile, writeFile } from "fs/promises";
import { resolve } from "path";
import { execFileSync } from "child_process";
import ora from "ora";
import chalk from "chalk";
import { GitLobsterClient } from "@gitlobster/client-sdk";
import * as git from "../src/git-utils.js";

/**
 * Parse semantic version string
 * @param {string} version - Version string (e.g., "1.2.3")
 * @returns {object} Parsed version object {major, minor, patch}
 */
function parseVersion(version) {
  const parts = version.split(".").map(Number);
  return {
    major: parts[0] || 0,
    minor: parts[1] || 0,
    patch: parts[2] || 0,
  };
}

/**
 * Format version object to string
 * @param {object} version - Version object {major, minor, patch}
 * @returns {string} Formatted version string
 */
function formatVersion(version) {
  return `${version.major}.${version.minor}.${version.patch}`;
}

/**
 * Bump version based on type
 * @param {string} currentVersion - Current version string
 * @param {string} type - Bump type: "patch", "minor", or "major"
 * @returns {string} New version string
 */
function bumpVersion(currentVersion, type) {
  const parsed = parseVersion(currentVersion);

  switch (type) {
    case "patch":
      parsed.patch++;
      break;
    case "minor":
      parsed.minor++;
      parsed.patch = 0;
      break;
    case "major":
      parsed.major++;
      parsed.minor = 0;
      parsed.patch = 0;
      break;
    default:
      throw new Error(`Invalid version bump type: ${type}`);
  }

  return formatVersion(parsed);
}

/**
 * Update gitlobster.json with new version
 * @param {string} path - Path to gitlobster.json
 * @param {string} newVersion - New version string
 * @returns {Promise<object>} Updated manifest
 */
async function updateManifestVersion(path, newVersion) {
  const manifestContent = await readFile(path, "utf-8");
  const manifest = JSON.parse(manifestContent);

  manifest.version = newVersion;

  await writeFile(path, JSON.stringify(manifest, null, 2) + "\n", "utf-8");

  return manifest;
}

/**
 * Create git tag for version
 * @param {string} version - Version to tag
 * @param {object} options - Git options
 * @returns {object} Result with success boolean and output
 */
function createGitTag(version, options = {}) {
  const { cwd = process.cwd() } = options;

  try {
    // Create annotated tag
    const tagName = `v${version}`;
    const message = `Release version ${version}`;

    execFileSync("git", ["tag", "-a", tagName, "-m", message], {
      cwd,
      stdio: "pipe",
    });

    return { success: true, message: `Created tag ${tagName}` };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

/**
 * Push tags to remote
 * @param {string} remote - Remote name (e.g., "origin")
 * @param {object} options - Git options
 * @returns {object} Result with success boolean and output
 */
function pushTags(remote, options = {}) {
  const { cwd = process.cwd() } = options;

  try {
    execFileSync("git", ["push", remote, "--tags"], {
      cwd,
      stdio: "pipe",
    });

    return { success: true, message: "Tags pushed to remote" };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

/**
 * Version bump command
 * @param {string} type - Bump type: "patch", "minor", or "major"
 * @param {object} options - Command options
 * @param {string} options.path - Path to skill directory (default: current directory)
 * @param {string} options.message - Commit message
 * @param {string} options.remote - Remote name for pushing tags
 * @param {boolean} options.push - Whether to push tags to remote
 * @param {boolean} options.yes - Skip confirmation prompts
 */
export async function versionBumpCommand(type, options) {
  const spinner = ora(`Bumping version (${type})`).start();
  const skillPath = resolve(options.path || ".");
  const manifestPath = resolve(skillPath, "gitlobster.json");

  try {
    // Step 1: Check if git is available
    if (!git.checkGitAvailable()) {
      throw new Error(
        "Git is not available. Please install Git and ensure it is in your PATH.",
      );
    }
    spinner.succeed("Git is available");

    // Step 2: Read current manifest
    spinner.text = "Reading current version...";
    let manifest;
    try {
      const manifestContent = await readFile(manifestPath, "utf-8");
      manifest = JSON.parse(manifestContent);
    } catch (error) {
      throw new Error("No gitlobster.json found. Run 'gitlobster init' first.");
    }

    const currentVersion = manifest.version;
    spinner.succeed(`Current version: ${chalk.cyan(currentVersion)}`);

    // Step 3: Calculate new version
    spinner.text = `Calculating new version...`;
    const newVersion = bumpVersion(currentVersion, type);
    spinner.succeed(`New version: ${chalk.green(newVersion)}`);

    // Step 4: Get user confirmation
    if (!options.yes) {
      spinner.stop();
      const readline = await import("readline");
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const answer = await new Promise((resolve) => {
        rl.question(
          chalk.yellow(
            `Update from ${currentVersion} to ${newVersion}? (y/N): `,
          ),
          (ans) => {
            rl.close();
            resolve(ans.toLowerCase().trim());
          },
        );
      });

      if (answer !== "y") {
        console.log(chalk.yellow("\nVersion bump cancelled."));
        process.exit(0);
      }
      spinner.start();
    }

    // Step 5: Update manifest
    spinner.text = "Updating gitlobster.json...";
    manifest.version = newVersion;
    await writeFile(
      manifestPath,
      JSON.stringify(manifest, null, 2) + "\n",
      "utf-8",
    );
    spinner.succeed("Updated gitlobster.json");

    // Step 6: Commit changes first (tag must point to the bumped version commit)
    spinner.text = "Committing changes...";
    const commitMessage = options.message || `Bump version to ${newVersion}`;
    const commitResult = git.commit(
      commitMessage,
      {
        name: manifest.author?.name || "Unknown",
        email: manifest.author?.email || "",
      },
      { cwd: skillPath },
    );

    if (commitResult.success) {
      spinner.succeed("Changes committed");
    } else {
      spinner.warn(
        chalk.yellow(
          "Could not commit changes — tag will point to previous HEAD",
        ),
      );
    }

    // Step 7: Create git tag AFTER commit so the tag points to the bumped version
    spinner.text = "Creating git tag...";
    const tagResult = createGitTag(newVersion, { cwd: skillPath });
    if (!tagResult.success) {
      throw new Error(`Failed to create tag: ${tagResult.message}`);
    }
    spinner.succeed(tagResult.message);

    // Step 8: Push tags to remote if requested
    if (options.push) {
      spinner.text = "Pushing tags to remote...";
      const remote = options.remote || "origin";
      const pushResult = pushTags(remote, { cwd: skillPath });

      if (pushResult.success) {
        spinner.succeed("Tags pushed to remote");
      } else {
        spinner.warn(
          chalk.yellow(`Failed to push tags: ${pushResult.message}`),
        );
      }
    }

    // Final success message
    spinner.succeed(
      chalk.green(`Version bumped from ${currentVersion} to ${newVersion}`),
    );
    console.log(`\n  ${chalk.cyan("New version:")} ${chalk.green(newVersion)}`);
    console.log(`  ${chalk.cyan("Tag created:")} v${newVersion}`);
    if (options.push) {
      console.log(`  ${chalk.cyan("Remote:")} ${options.remote || "origin"}`);
    }
    console.log(`\n  ${chalk.dim("Next steps:")}`);
    console.log(
      `  ${chalk.dim("1.")} Run ${chalk.cyan("gitlobster publish")} to publish the new version`,
    );
    console.log(
      `  ${chalk.dim("2.")} Or run ${chalk.cyan("gitlobster sync push")} to sync to registry\n`,
    );
  } catch (error) {
    spinner.fail(chalk.red("Version bump failed"));
    console.error(`\n${chalk.red("Error:")} ${error.message}`);
    process.exit(1);
  }
}

/**
 * Version history command
 * @param {string} packageName - Package name to show history for
 * @param {object} options - Command options
 * @param {string} options.registry - Registry URL
 * @param {string} options.path - Local skill path (if checking local versions)
 * @param {number} options.limit - Number of versions to show
 */
export async function versionHistoryCommand(packageName, options) {
  const spinner = ora("Fetching version history").start();

  try {
    // Check if we're looking at local or remote history
    if (options.path) {
      // Local version history
      const skillPath = resolve(options.path);
      const manifestPath = resolve(skillPath, "gitlobster.json");

      try {
        const manifestContent = await readFile(manifestPath, "utf-8");
        const manifest = JSON.parse(manifestContent);

        spinner.succeed("Local version found");
        console.log(
          `\n${chalk.cyan("Local Package:")} ${chalk.green(packageName)}`,
        );
        console.log(
          `${chalk.cyan("Current Version:")} ${chalk.green(manifest.version)}`,
        );
        console.log(
          `${chalk.cyan("Author:")} ${manifest.author?.name || "Unknown"}`,
        );

        // Try to get git tags for local history
        try {
          const tags = execFileSync("git", ["tag", "--sort=-version:refname"], {
            cwd: skillPath,
            encoding: "utf-8",
          })
            .trim()
            .split("\n")
            .filter(Boolean);

          if (tags.length > 0) {
            console.log(`\n${chalk.cyan("Git Tags:")}`);
            tags.slice(0, options.limit || 10).forEach((tag) => {
              console.log(`  ${chalk.dim(tag)}`);
            });
          }
        } catch (gitError) {
          console.log(chalk.dim("\nNo git tags found"));
        }
      } catch (error) {
        throw new Error("No gitlobster.json found in local path");
      }
    } else {
      // Remote version history
      const registryUrl = options.registry || "https://gitlobster.registry";
      const client = new GitLobsterClient({ registryUrl });

      spinner.text = "Fetching from registry...";
      const versions = await client.getPackageVersions(packageName);

      if (versions.length === 0) {
        throw new Error(`No versions found for package: ${packageName}`);
      }

      spinner.succeed(`Found ${versions.length} versions`);

      console.log(`\n${chalk.cyan("Package:")} ${chalk.green(packageName)}`);
      console.log(`${chalk.cyan("Registry:")} ${chalk.dim(registryUrl)}`);
      console.log(`${chalk.cyan("Total Versions:")} ${versions.length}`);

      console.log(`\n${chalk.cyan("Recent Versions:")}`);
      const limit = options.limit || 10;
      const recentVersions = versions.slice(0, limit);

      recentVersions.forEach((version, index) => {
        const isLatest = index === 0;
        const display = isLatest
          ? `${version} ${chalk.green("(latest)")}`
          : version;
        console.log(`  ${display}`);
      });

      if (versions.length > limit) {
        console.log(
          chalk.dim(`  ... and ${versions.length - limit} more versions`),
        );
      }
    }
  } catch (error) {
    spinner.fail(chalk.red("Failed to fetch version history"));
    console.error(`\n${chalk.red("Error:")} ${error.message}`);
    process.exit(1);
  }
}
