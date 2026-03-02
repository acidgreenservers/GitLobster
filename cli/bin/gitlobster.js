#!/usr/bin/env node

/**
 * GitLobster CLI Entry Point
 * Commands: init, publish, install, fork, search, info, sync, genkey,
 *           version, dev, template, templates, docs, advanced
 */

import { Command } from "commander";
import { initCommand } from "../commands/init.js";
import { publishCommand } from "../commands/publish.js";
import { installCommand } from "../commands/install.js";
import { forkCommand } from "../commands/fork.js";
import { searchCommand } from "../commands/search.js";
import { infoCommand } from "../commands/info.js";
import { syncCommand } from "../commands/sync.js";
import { genkeyCommand } from "../commands/genkey.js";
import {
  versionBumpCommand,
  versionHistoryCommand,
} from "../commands/version.js";
import { devServerCommand } from "../commands/dev.js";
import { templateCommand, listTemplatesCommand } from "../commands/template.js";
import { docsCommand } from "../commands/docs.js";
import { advancedCommand } from "../commands/advanced.js";

const program = new Command();

program
  .name("gitlobster")
  .description("Agent Git — Skill package manager for autonomous agents")
  .version("0.1.0");

// ─── gitlobster init [path] ───────────────────────────────────────────────────
program
  .command("init")
  .description("Initialize a new skill package")
  .argument("[path]", "Directory for the new skill", ".")
  .option("-n, --name <name>", "Package name")
  .option("-a, --author <name>", "Author name")
  .option("-e, --email <email>", "Author email")
  .option(
    "--description <desc>",
    "Package description",
    "A GitLobster skill package",
  )
  .action(initCommand);

// ─── gitlobster publish [path] ────────────────────────────────────────────────
program
  .command("publish")
  .description("Publish a skill package to the registry (git workflow)")
  .argument("[path]", "Path to skill directory", ".")
  .option(
    "-r, --registry <url>",
    "Registry URL",
    process.env.GITLOBSTER_REGISTRY || "http://localhost:3000",
  )
  .option(
    "-k, --key <path>",
    "Path to Ed25519 private key",
    "~/.ssh/gitlobster_ed25519",
  )
  .option("-y, --yes", "Skip interactive confirmation prompts")
  .option("--dry-run", "Validate package without publishing")
  .action(publishCommand);

// ─── gitlobster install <package> ─────────────────────────────────────────────
program
  .command("install")
  .description("Install a skill package")
  .argument("<package>", "Package name (e.g., @molt/memory-scraper)")
  .option("-v, --version <version>", "Specific version to install", "latest")
  .option(
    "-r, --registry <url>",
    "Registry URL",
    process.env.GITLOBSTER_REGISTRY || "http://localhost:3000",
  )
  .option(
    "-d, --destination <path>",
    "Installation directory",
    "~/.gitlobster/skills",
  )
  .option("-y, --yes", "Skip permission approval prompt")
  .option("--auto-deps", "Auto-resolve and install dependencies")
  .action(installCommand);

// ─── gitlobster fork <parent> [forked-name] ───────────────────────────────────
program
  .command("fork")
  .description("Fork a skill package to your own namespace")
  .argument("<parent>", "Parent package to fork (e.g., @molt/memory-scraper)")
  .argument("[forked]", "New forked package name (e.g., @myagent/my-scraper)")
  .option(
    "-r, --registry <url>",
    "Registry URL",
    process.env.GITLOBSTER_REGISTRY || "http://localhost:3000",
  )
  .option(
    "-k, --key <path>",
    "Path to Ed25519 private key",
    "~/.ssh/gitlobster_ed25519",
  )
  .option("--clone", "Clone the fork locally after creating it")
  .option(
    "-d, --destination <path>",
    "Where to clone the fork",
    "~/.gitlobster/skills",
  )
  .option("--reason <text>", "Reason for forking", "Hard fork")
  .action(forkCommand);

// ─── gitlobster search <query> ────────────────────────────────────────────────
program
  .command("search")
  .description("Search for skill packages")
  .argument("<query>", "Search query")
  .option(
    "-r, --registry <url>",
    "Registry URL",
    process.env.GITLOBSTER_REGISTRY || "http://localhost:3000",
  )
  .option("-c, --category <category>", "Filter by category")
  .option("-l, --limit <number>", "Number of results", "20")
  .action(searchCommand);

// ─── gitlobster info <package> ────────────────────────────────────────────────
program
  .command("info")
  .description("Show package information")
  .argument("<package>", "Package name")
  .option(
    "-r, --registry <url>",
    "Registry URL",
    process.env.GITLOBSTER_REGISTRY || "http://localhost:3000",
  )
  .action(infoCommand);

// ─── gitlobster sync <subcommand> ─────────────────────────────────────────────
program
  .command("sync")
  .description("Synchronize skills between local workspace and registry")
  .argument("[subcommand]", "Subcommand: push, pull, list, or status")
  .argument("[path]", "Workspace path (for push/pull/status)")
  .option(
    "-r, --registry <url>",
    "Registry URL",
    process.env.GITLOBSTER_REGISTRY || "http://localhost:3000",
  )
  .option(
    "-k, --key <path>",
    "Path to Ed25519 private key",
    "~/.ssh/gitlobster_ed25519",
  )
  .option("-s, --scope <scope>", "Agent scope (e.g., @myagent)")
  .option(
    "-i, --increment <type>",
    "Version increment type: patch, minor, major",
    "patch",
  )
  .option("-f, --force", "Force overwrite existing files")
  .option("-y, --yes", "Skip confirmation prompts")
  .action(syncCommand);

// ─── gitlobster genkey ────────────────────────────────────────────────────────
program
  .command("genkey")
  .description(
    "Generate GitLobster-compliant raw Base64 Ed25519 tweetnacl keys",
  )
  .requiredOption(
    "-p, --path <path>",
    "Output path (e.g., ~/.ssh/gitlobster_ed25519)",
  )
  .action(genkeyCommand);

// ─── gitlobster version <type> ───────────────────────────────────────────────
program
  .command("version")
  .description("Bump version (patch/minor/major) or show version history")
  .argument("<type>", "Version bump type: patch, minor, major, or history")
  .argument("[package]", "Package name (for history command)")
  .option("-p, --path <path>", "Path to skill directory", ".")
  .option("-m, --message <message>", "Commit message")
  .option("-r, --remote <remote>", "Remote name for pushing tags", "origin")
  .option("--push", "Push tags to remote repository")
  .option("-y, --yes", "Skip confirmation prompts")
  .option("--limit <number>", "Number of versions to show (for history)", "10")
  .action(async (type, packageArg, options) => {
    if (type === "history") {
      await versionHistoryCommand(packageArg, options);
    } else {
      await versionBumpCommand(type, options);
    }
  });

// ─── gitlobster dev [path] ────────────────────────────────────────────────────
program
  .command("dev")
  .description(
    "Start development server with hot-reloading for local skill testing",
  )
  .argument("[path]", "Path to skill directory", ".")
  .option("-p, --port <port>", "Port to run server on", "3000")
  .option("--no-watch", "Disable file watching")
  .option("--no-open", "Don't open browser automatically")
  .action(devServerCommand);

// ─── gitlobster template <type> <name> ───────────────────────────────────────
program
  .command("template")
  .description("Create a skill template for common skill types")
  .argument("<type>", "Template type (memory, web-scraper, calculator)")
  .argument("<name>", "Name of the skill")
  .option("-p, --path <path>", "Output directory", ".")
  .option("-a, --author <name>", "Author name")
  .option("-e, --email <email>", "Author email")
  .option("-y, --yes", "Skip confirmation prompts")
  .action(templateCommand);

// ─── gitlobster templates ─────────────────────────────────────────────────────
program
  .command("templates")
  .description("List available skill templates")
  .action(listTemplatesCommand);

// ─── gitlobster docs <action> ─────────────────────────────────────────────────
program
  .command("docs")
  .description("Documentation commands: serve, build, init, new")
  .argument("<action>", "Action: serve, build, init, or new")
  .option("--title <title>", "Page title (for 'new' subcommand)")
  .option("--category <cat>", "Page category (for 'new' subcommand)", "general")
  .option("--force", "Force overwrite (for 'init' subcommand)")
  .option(
    "-r, --registry <url>",
    "Registry URL",
    process.env.GITLOBSTER_REGISTRY || "http://localhost:3000",
  )
  .action(docsCommand);

// ─── gitlobster advanced <action> ─────────────────────────────────────────────
program
  .command("advanced")
  .description("Advanced features: cache, resolve, plugin")
  .argument("<action>", "Action: cache, resolve, or plugin")
  .option(
    "--subcommand <sub>",
    "Subcommand (e.g., status, clear, stats, list, install)",
  )
  .option("--package <name>", "Package name (for resolve)")
  .option(
    "--strategy <s>",
    "Conflict strategy: auto-merge|keep-local|keep-remote|manual|semantic",
  )
  .option("--source <src>", "Plugin source path or URL (for plugin install)")
  .option("--name <name>", "Plugin name (for plugin uninstall/create)")
  .option("--cache-dir <dir>", "Custom cache directory")
  .option("--ttl <ms>", "Cache TTL in milliseconds")
  .option("--plugins-dir <dir>", "Custom plugins directory")
  .option(
    "-r, --registry <url>",
    "Registry URL",
    process.env.GITLOBSTER_REGISTRY || "http://localhost:3000",
  )
  .action(async (action, options) => {
    // Normalise option names to match advancedCommand expectations
    await advancedCommand(action, {
      ...options,
      registryUrl: options.registry,
      cacheDir: options.cacheDir,
      ttl: options.ttl ? parseInt(options.ttl, 10) : undefined,
      pluginsDir: options.pluginsDir,
      packageName: options.package,
    });
  });

program.parse();
