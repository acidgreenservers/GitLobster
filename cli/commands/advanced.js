#!/usr/bin/env node

import { CachedGitLobsterClient } from "../src/cache.js";
import { ConflictResolver } from "../src/conflict-resolver.js";
import { PluginManager } from "../src/plugin-system.js";
import { GitLobsterClient } from "../../client-sdk/index.js";
import chalk from "chalk";
import ora from "ora";

/**
 * Advanced CLI Commands for GitLobster
 * 
 * Commands:
 * - cache: Manage package metadata and search result caching
 * - resolve: Resolve conflicts during package updates
 * - plugin: Manage CLI plugins
 */

export async function advancedCommand(action, options = {}) {
  const { registryUrl = process.env.GITLOBSTER_REGISTRY || "http://localhost:3000" } = options;

  switch (action) {
    case "cache":
      await manageCache(options);
      break;
    case "resolve":
      await resolveConflicts(options);
      break;
    case "plugin":
      await managePlugins(options);
      break;
    default:
      console.log(chalk.red("Unknown advanced action. Use: cache, resolve, or plugin"));
      process.exit(1);
  }
}

/**
 * Cache management commands
 */
async function manageCache(options) {
  const { subcommand = "status", packageName, clear = false } = options;
  
  const client = new GitLobsterClient({ registryUrl: options.registryUrl });
  const cachedClient = new CachedGitLobsterClient(client, {
    cacheDir: options.cacheDir,
    defaultTTL: options.ttl
  });

  switch (subcommand) {
    case "status":
      showCacheStatus(cachedClient);
      break;
    case "clear":
      await clearCache(cachedClient);
      break;
    case "stats":
      showCacheStats(cachedClient);
      break;
    default:
      console.log(chalk.red("Unknown cache subcommand. Use: status, clear, or stats"));
      process.exit(1);
  }
}

/**
 * Conflict resolution commands
 */
async function resolveConflicts(options) {
  const { packageName, strategy = "auto-merge", localManifest, remoteManifest } = options;
  
  if (!packageName) {
    console.log(chalk.red("Please provide a package name"));
    console.log(chalk.yellow("Usage: gitlobster advanced resolve --package <name> [--strategy auto-merge|keep-local|keep-remote|manual|semantic]"));
    process.exit(1);
  }

  const resolver = new ConflictResolver({
    backupDir: options.backupDir
  });

  try {
    // Load manifests if not provided
    let localManifestObj = localManifest;
    let remoteManifestObj = remoteManifest;

    if (!localManifestObj || !remoteManifestObj) {
      const client = new GitLobsterClient({ registryUrl: options.registryUrl });
      const cachedClient = new CachedGitLobsterClient(client);
      
      if (!localManifestObj) {
        // Try to load local manifest
        try {
          const fs = await import('fs');
          localManifestObj = JSON.parse(fs.readFileSync('gitlobster.json', 'utf-8'));
        } catch (error) {
          console.log(chalk.yellow("No local manifest found, using remote as base"));
          localManifestObj = { version: "0.0.0", dependencies: {}, config: {}, scripts: {} };
        }
      }

      if (!remoteManifestObj) {
        remoteManifestObj = await cachedClient.getManifest(packageName, "latest");
      }
    }

    const result = await resolver.resolveConflicts(packageName, localManifestObj, remoteManifestObj, strategy);
    
    console.log(chalk.green(`\nConflict resolution completed:`));
    console.log(`  Strategy: ${result.strategy}`);
    console.log(`  Conflicts: ${result.conflicts.length}`);
    console.log(`  Backup: ${result.backupPath || 'N/A'}`);
    
    if (result.resolved) {
      // Save resolved manifest
      const fs = await import('fs');
      fs.writeFileSync('gitlobster.json', JSON.stringify(result.manifest, null, 2));
      console.log(chalk.green("Resolved manifest saved to gitlobster.json"));
    }

  } catch (error) {
    console.error(chalk.red(`Conflict resolution failed: ${error.message}`));
    process.exit(1);
  }
}

/**
 * Plugin management commands
 */
async function managePlugins(options) {
  const { subcommand = "list", pluginName, source } = options;
  
  const pluginManager = new PluginManager({
    pluginsDir: options.pluginsDir
  });

  await pluginManager.loadPlugins();

  switch (subcommand) {
    case "list":
      pluginManager.listPlugins();
      break;
    case "install":
      if (!source) {
        console.log(chalk.red("Please provide a plugin source"));
        console.log(chalk.yellow("Usage: gitlobster advanced plugin install --source <path|url>"));
        process.exit(1);
      }
      await pluginManager.installPlugin(source, options);
      break;
    case "uninstall":
      if (!pluginName) {
        console.log(chalk.red("Please provide a plugin name"));
        console.log(chalk.yellow("Usage: gitlobster advanced plugin uninstall --name <plugin-name>"));
        process.exit(1);
      }
      await pluginManager.uninstallPlugin(pluginName);
      break;
    case "create":
      if (!pluginName) {
        console.log(chalk.red("Please provide a plugin name"));
        console.log(chalk.yellow("Usage: gitlobster advanced plugin create --name <plugin-name>"));
        process.exit(1);
      }
      pluginManager.createPluginTemplate(pluginName, options);
      break;
    default:
      console.log(chalk.red("Unknown plugin subcommand. Use: list, install, uninstall, or create"));
      process.exit(1);
  }
}

// Helper functions

function showCacheStatus(cachedClient) {
  const stats = cachedClient.getCacheStats();
  
  console.log(chalk.green("Cache Status:"));
  console.log(`  Cache Directory: ${stats.cacheDir}`);
  console.log(`  Total Files: ${stats.totalFiles}`);
  console.log(`  Valid Entries: ${stats.validCount}`);
  console.log(`  Expired Entries: ${stats.expiredCount}`);
  console.log(`  Total Size: ${(stats.totalSize / 1024).toFixed(2)} KB`);
  
  if (stats.error) {
    console.log(chalk.red(`  Error: ${stats.error}`));
  }
}

async function clearCache(cachedClient) {
  const spinner = ora("Clearing cache...").start();
  
  try {
    await cachedClient.clearCache();
    spinner.succeed("Cache cleared successfully");
  } catch (error) {
    spinner.fail(`Failed to clear cache: ${error.message}`);
    process.exit(1);
  }
}

function showCacheStats(cachedClient) {
  const stats = cachedClient.getCacheStats();
  
  console.log(chalk.green("Cache Statistics:"));
  console.log(`  Cache Directory: ${stats.cacheDir}`);
  console.log(`  Total Files: ${stats.totalFiles}`);
  console.log(`  Valid Entries: ${stats.validCount}`);
  console.log(`  Expired Entries: ${stats.expiredCount}`);
  console.log(`  Total Size: ${(stats.totalSize / 1024).toFixed(2)} KB`);
  console.log(`  Cache Hit Rate: ${calculateHitRate(stats)}%`);
}

function calculateHitRate(stats) {
  // Simple hit rate calculation based on valid vs expired
  if (stats.totalFiles === 0) return 0;
  return ((stats.validCount / stats.totalFiles) * 100).toFixed(2);
}
