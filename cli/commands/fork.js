/**
 * Fork Command - V2.5
 * Creates a hard fork of a skill package in the registry
 *
 * Calls POST /v1/botkit/fork on the registry server with:
 *   - JWT Bearer token (Ed25519-signed)
 *   - Signed fork declaration message
 *
 * Usage:
 *   gitlobster fork @parent/skill
 *   gitlobster fork @parent/skill @myagent/enhanced-skill
 *   gitlobster fork @parent/skill --clone
 *   gitlobster fork @parent/skill --reason "Adding persistent cache layer"
 *   gitlobster fork @parent/skill @myagent/my-skill --clone --reason "Custom version"
 */

import { mkdir } from "fs/promises";
import { resolve, join } from "path";
import { execFileSync } from "child_process";
import ora from "ora";
import chalk from "chalk";
import { GitLobsterClient } from "@gitlobster/client-sdk";
import * as git from "../src/git-utils.js";

// Defaults
const DEFAULT_REGISTRY =
  process.env.GITLOBSTER_REGISTRY || "http://localhost:3000";
const DEFAULT_KEY_PATH = "~/.ssh/gitlobster_ed25519";
const DEFAULT_DESTINATION = "~/.gitlobster/skills";
const DEFAULT_REASON = "Hard fork";

/**
 * Resolve a path that may start with ~ to absolute
 * @param {string} p - Path string
 * @returns {string} Resolved absolute path
 */
function resolvePath(p) {
  return resolve(p.replace(/^~/, process.env.HOME));
}

/**
 * Load private key bytes from file (raw base64 Ed25519 secret key)
 * @param {string} keyPath - Path to Ed25519 private key file
 * @returns {Promise<Uint8Array>} 64-byte secret key
 */
async function loadSecretKey(keyPath) {
  const { readFile } = await import("fs/promises");
  const keyRaw = await readFile(resolvePath(keyPath), "utf-8");

  if (keyRaw.trim().startsWith("-----BEGIN")) {
    throw new Error(
      "PEM keys not supported. Please use a raw base64 Ed25519 secret key (64 bytes).\n" +
        "Generate one with: gitlobster keygen",
    );
  }

  const secretKey = Buffer.from(keyRaw.trim(), "base64");

  if (secretKey.length !== 64) {
    throw new Error(
      `Invalid Ed25519 secret key length: ${secretKey.length} bytes (expected 64).\n` +
        `Ensure ${keyPath} contains a raw base64-encoded 64-byte TweetNaCl Ed25519 secret key.`,
    );
  }

  return secretKey;
}

/**
 * Sign the fork declaration message with Ed25519 via TweetNaCl
 * Message format: fork:{parent_package}:{forked_package}:{fork_reason}:{latestVersion}:{git_commit}
 *
 * @param {string} message - The plaintext message to sign
 * @param {string} keyPath - Path to the private key file
 * @returns {Promise<string>} Signature as plain base64 string (no prefix)
 */
async function signForkMessage(message, keyPath) {
  const nacl = (await import("tweetnacl")).default;
  const secretKey = await loadSecretKey(keyPath);
  const messageBytes = Buffer.from(message, "utf-8");
  const sig = nacl.sign.detached(messageBytes, secretKey);
  return Buffer.from(sig).toString("base64");
}

/**
 * Generate an Ed25519-signed JWT for authentication
 * Mirrors GitLobsterClient.generateAuthToken but accepts a scope string directly
 * so we can generate the token using the forked package scope before the package exists.
 *
 * @param {string} scope - Agent scope (e.g. "@myagent")
 * @param {string} keyPath - Path to the private key file
 * @returns {Promise<string>} JWT token string
 */
async function generateJWT(scope, keyPath) {
  const nacl = (await import("tweetnacl")).default;
  const secretKey = await loadSecretKey(keyPath);

  const header = { alg: "EdDSA", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: scope,
    iss: "gitlobster-cli",
    iat: now,
    exp: now + 3600,
    scope: "publish",
  };

  // base64url without padding
  const base64url = (input) => {
    const str = typeof input === "string" ? input : input.toString("utf-8");
    return Buffer.from(str)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const messageBytes = Buffer.from(signingInput, "utf-8");
  const signature = nacl.sign.detached(messageBytes, secretKey);

  return `${signingInput}.${base64url(Buffer.from(signature))}`;
}

/**
 * Extract scope (e.g. "@myagent") from a package name like "@myagent/skill"
 * @param {string} packageName - Full scoped package name
 * @returns {string|null} Scope string or null
 */
function extractScope(packageName) {
  const match = packageName.match(/^(@[^/]+)\//);
  return match ? match[1] : null;
}

/**
 * Convert a scoped package name to a safe git repo name
 * e.g. "@myagent/skill" → "myagent-skill"
 * @param {string} packageName - Scoped package name
 * @returns {string} Safe git repo name
 */
function toGitRepoName(packageName) {
  return packageName.replace(/^@/, "").replace(/\//g, "-");
}

/**
 * Clone a repository into the given path
 * @param {string} url - Clone URL
 * @param {string} targetPath - Where to clone into
 * @returns {{ success: boolean, message: string }}
 */
function cloneRepo(url, targetPath) {
  try {
    execFileSync("git", ["clone", "--depth", "1", url, targetPath], {
      stdio: "pipe",
      encoding: "utf-8",
    });
    return { success: true, message: "Repository cloned successfully" };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

/**
 * Main fork command
 *
 * @param {string} parentPackage - Source package to fork (e.g. "@parent/skill")
 * @param {string|undefined} forkedPackage - New package name (e.g. "@myagent/skill"), optional
 * @param {object} options - Commander option values
 * @param {string} options.registry - Registry URL
 * @param {string} options.key - Path to Ed25519 private key
 * @param {boolean} options.clone - Clone the fork locally after creation
 * @param {string} options.destination - Local clone destination
 * @param {string} options.reason - Reason for fork
 */
export async function forkCommand(parentPackage, forkedPackage, options) {
  const spinner = ora("Preparing fork...").start();

  try {
    // ─── Validate inputs ─────────────────────────────────────────────────────

    if (!parentPackage || !parentPackage.startsWith("@")) {
      spinner.fail(chalk.red("Invalid parent package"));
      console.error(
        `\n${chalk.red("Error:")} Parent package must be a scoped name starting with "@"\n` +
          `  Example: ${chalk.cyan("gitlobster fork @parent/skill")}`,
      );
      process.exit(1);
    }

    const registryUrl = options.registry || DEFAULT_REGISTRY;
    const keyPath = options.key || DEFAULT_KEY_PATH;
    const forkReason = options.reason || DEFAULT_REASON;
    const destBase = resolvePath(options.destination || DEFAULT_DESTINATION);

    // ─── Resolve forked package name ─────────────────────────────────────────

    let resolvedForkedPackage = forkedPackage;

    if (!resolvedForkedPackage) {
      // Derive scope from key file path or from a best-guess prompt.
      // Strategy: try to read the scope from a local gitlobster.json if present,
      // otherwise inform the user they must specify the target package name.
      let inferredScope = null;

      // Try current directory gitlobster.json
      try {
        const { readFile } = await import("fs/promises");
        const localConfig = JSON.parse(
          await readFile(resolve(process.cwd(), "gitlobster.json"), "utf-8"),
        );
        if (localConfig.name) {
          inferredScope = extractScope(localConfig.name);
        }
      } catch {
        // no local config — that's fine
      }

      if (!inferredScope) {
        spinner.fail(chalk.red("Cannot determine your agent scope"));
        console.error(
          `\n${chalk.red("Error:")} Could not derive your agent scope automatically.\n` +
            `  Please specify the target package name explicitly:\n\n` +
            `  ${chalk.cyan(`gitlobster fork ${parentPackage} @youragent/${parentPackage.split("/")[1]}`)}\n`,
        );
        process.exit(1);
      }

      // Same skill name, different scope
      const skillName = parentPackage.split("/")[1];
      resolvedForkedPackage = `${inferredScope}/${skillName}`;
      spinner.info(`Derived fork name: ${chalk.cyan(resolvedForkedPackage)}`);
    }

    if (!resolvedForkedPackage.startsWith("@")) {
      spinner.fail(chalk.red("Invalid fork target"));
      console.error(
        `\n${chalk.red("Error:")} Fork target must be a scoped name starting with "@"\n` +
          `  Example: ${chalk.cyan(`gitlobster fork ${parentPackage} @myagent/skill`)}`,
      );
      process.exit(1);
    }

    const forkedScope = extractScope(resolvedForkedPackage);
    if (!forkedScope) {
      spinner.fail(chalk.red("Cannot extract scope from fork target"));
      process.exit(1);
    }

    // ─── Check git availability ───────────────────────────────────────────────

    if (!git.checkGitAvailable()) {
      throw new Error(
        "Git is not available. Please install Git and ensure it is in your PATH.",
      );
    }

    // ─── Fetch parent metadata to get latest version ─────────────────────────

    spinner.text = `Fetching metadata for ${chalk.cyan(parentPackage)}...`;
    const client = new GitLobsterClient({ registryUrl });

    let latestVersion = "1.0.0";
    try {
      const metadata = await client.getPackageMetadata(parentPackage);
      latestVersion = metadata.latest || metadata.version || "1.0.0";
      spinner.succeed(
        `Found ${chalk.cyan(parentPackage)} @ ${chalk.cyan(latestVersion)}`,
      );
    } catch (metaError) {
      spinner.warn(
        `Registry metadata unavailable (${metaError.message}). Using version placeholder.`,
      );
    }

    // ─── Build fork declaration message & sign ────────────────────────────────

    spinner.text = "Signing fork declaration...";
    const forkCommit = "no_git_repo";
    const forkMessage = `fork:${parentPackage}:${resolvedForkedPackage}:${forkReason}:${latestVersion}:${forkCommit}`;

    let signature;
    try {
      signature = await signForkMessage(forkMessage, keyPath);
    } catch (keyError) {
      spinner.fail(chalk.red("Key signing failed"));
      console.error(`\n${chalk.red("Error:")} ${keyError.message}`);
      process.exit(1);
    }

    spinner.succeed("Fork declaration signed");

    // ─── Generate JWT ─────────────────────────────────────────────────────────

    spinner.text = "Generating authentication token...";
    let jwtToken;
    try {
      jwtToken = await generateJWT(forkedScope, keyPath);
    } catch (jwtError) {
      spinner.fail(chalk.red("JWT generation failed"));
      console.error(`\n${chalk.red("Error:")} ${jwtError.message}`);
      process.exit(1);
    }
    spinner.succeed("Authentication token ready");

    // ─── POST to /v1/botkit/fork ──────────────────────────────────────────────

    spinner.text = `Forking ${chalk.cyan(parentPackage)} → ${chalk.cyan(resolvedForkedPackage)}...`;

    const forkEndpoint = `${registryUrl}/v1/botkit/fork`;
    const requestBody = {
      parent_package: parentPackage,
      forked_package: resolvedForkedPackage,
      fork_reason: forkReason,
      signature: signature,
    };

    let forkResult;
    const response = await fetch(forkEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwtToken}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      const errMsg =
        errBody.error ||
        errBody.message ||
        `HTTP ${response.status} ${response.statusText}`;
      throw new Error(`Fork API call failed: ${errMsg}`);
    }

    forkResult = await response.json();
    spinner.succeed(
      chalk.green(
        `Forked ${chalk.bold(parentPackage)} → ${chalk.bold(resolvedForkedPackage)}`,
      ),
    );

    // ─── Display fork result ──────────────────────────────────────────────────

    const gitUrl =
      forkResult.git_url ||
      `${registryUrl}/git/${toGitRepoName(resolvedForkedPackage)}.git`;
    const forkUuid = forkResult.fork_uuid || forkResult.id || "(see registry)";
    const forkPointVersion = forkResult.fork_point_version || latestVersion;

    console.log("\n" + chalk.green("  ✔ Fork created successfully!"));
    console.log(
      `  ${chalk.dim("🍴 Forked From:")}  ${chalk.cyan(parentPackage)} ${chalk.dim(`(v${forkPointVersion})`)}`,
    );
    console.log(
      `  ${chalk.dim("📦 Fork UUID:")}    ${chalk.yellow(forkUuid)} ${chalk.dim("(permanent lineage anchor)")}`,
    );
    console.log(`  ${chalk.dim("🔗 Git URL:")}      ${chalk.cyan(gitUrl)}`);

    if (forkResult.forked_at) {
      console.log(
        `  ${chalk.dim("🕐 Forked At:")}    ${chalk.gray(forkResult.forked_at)}`,
      );
    }

    // ─── Clone if requested ───────────────────────────────────────────────────

    if (options.clone) {
      spinner.text = `Cloning ${chalk.cyan(resolvedForkedPackage)} locally...`;
      spinner.start();

      await mkdir(destBase, { recursive: true });

      const repoName = toGitRepoName(resolvedForkedPackage);
      const clonePath = join(destBase, repoName);

      const cloneResult = cloneRepo(gitUrl, clonePath);

      if (!cloneResult.success) {
        spinner.fail(chalk.red("Clone failed"));
        console.error(`\n${chalk.red("Error:")} ${cloneResult.message}`);
        console.log(
          `\n${chalk.yellow("Tip:")} The fork was created on the registry. ` +
            `You can clone it manually:\n  ${chalk.cyan(`git clone ${gitUrl}`)}`,
        );
        process.exit(1);
      }

      spinner.succeed(`Cloned to ${chalk.cyan(clonePath)}`);

      console.log("\n" + chalk.bold("  Next steps:"));
      console.log(`  1. ${chalk.cyan(`cd ${clonePath}`)}`);
      console.log(`  2. Make your changes`);
      console.log(`  3. ${chalk.cyan("gitlobster publish .")}`);
    } else {
      console.log("\n" + chalk.bold("  Next steps:"));
      console.log(
        `  1. Run: ${chalk.cyan(`gitlobster install ${resolvedForkedPackage}`)}  ${chalk.dim("(or use --clone flag)")}`,
      );
      console.log("  2. Make your changes");
      console.log(`  3. Run: ${chalk.cyan("gitlobster publish .")}`);
    }

    console.log("");
  } catch (error) {
    spinner.fail(chalk.red("Fork failed"));
    console.error(`\n${chalk.red("Error:")} ${error.message}`);
    process.exit(1);
  }
}
