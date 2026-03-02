import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
} from "fs";
import { join, resolve } from "path";
import { createRequire } from "module";
import chalk from "chalk";
import ora from "ora";

/**
 * Plugin System for GitLobster CLI
 *
 * Provides extensibility through plugins that can:
 * - Add new CLI commands
 * - Extend existing commands
 * - Add hooks and middleware
 * - Register custom services
 */

export class PluginManager {
  constructor(options = {}) {
    this.pluginsDir = options.pluginsDir || this.getDefaultPluginsDir();
    this.plugins = new Map();
    this.hooks = new Map();
    this.commands = new Map();
    this.services = new Map();

    this.ensurePluginsDir();
  }

  getDefaultPluginsDir() {
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    return join(homeDir, ".gitlobster", "plugins");
  }

  ensurePluginsDir() {
    if (!existsSync(this.pluginsDir)) {
      mkdirSync(this.pluginsDir, { recursive: true });
    }
  }

  /**
   * Load all installed plugins
   */
  async loadPlugins() {
    const spinner = ora("Loading plugins...").start();

    try {
      const pluginFiles = this.getPluginFiles();

      for (const pluginFile of pluginFiles) {
        await this.loadPlugin(pluginFile);
      }

      spinner.succeed(`Loaded ${this.plugins.size} plugins`);
    } catch (error) {
      spinner.fail("Failed to load plugins");
      console.error(chalk.red(error.message));
    }
  }

  /**
   * Load a single plugin
   */
  async loadPlugin(pluginPath) {
    try {
      const plugin = await this.loadPluginModule(pluginPath);

      if (!this.validatePlugin(plugin)) {
        throw new Error(`Invalid plugin: ${plugin.name}`);
      }

      // Register plugin
      this.plugins.set(plugin.name, plugin);

      // Register hooks
      if (plugin.hooks) {
        for (const [hookName, hookFunction] of Object.entries(plugin.hooks)) {
          this.registerHook(hookName, hookFunction);
        }
      }

      // Register commands
      if (plugin.commands) {
        for (const [commandName, commandFunction] of Object.entries(
          plugin.commands,
        )) {
          this.registerCommand(commandName, commandFunction);
        }
      }

      // Register services
      if (plugin.services) {
        for (const [serviceName, serviceFunction] of Object.entries(
          plugin.services,
        )) {
          this.registerService(serviceName, serviceFunction);
        }
      }

      console.log(chalk.green(`✓ Loaded plugin: ${plugin.name}`));
    } catch (error) {
      console.error(
        chalk.red(`✗ Failed to load plugin ${pluginPath}: ${error.message}`),
      );
    }
  }

  /**
   * Load plugin module
   */
  async loadPluginModule(pluginPath) {
    const require = createRequire(import.meta.url);
    const pluginModule = require(pluginPath);

    // Handle both default and named exports
    return pluginModule.default || pluginModule;
  }

  /**
   * Validate plugin structure
   */
  validatePlugin(plugin) {
    const required = ["name", "version", "description"];

    for (const field of required) {
      if (!plugin[field]) {
        console.error(chalk.red(`Plugin missing required field: ${field}`));
        return false;
      }
    }

    return true;
  }

  /**
   * Register a hook
   */
  registerHook(hookName, hookFunction) {
    if (!this.hooks.has(hookName)) {
      this.hooks.set(hookName, []);
    }

    this.hooks.get(hookName).push(hookFunction);
  }

  /**
   * Register a command
   */
  registerCommand(commandName, commandFunction) {
    this.commands.set(commandName, commandFunction);
  }

  /**
   * Register a service
   */
  registerService(serviceName, serviceFunction) {
    this.services.set(serviceName, serviceFunction);
  }

  /**
   * Execute hooks for a given hook name
   */
  async executeHooks(hookName, ...args) {
    const hooks = this.hooks.get(hookName) || [];

    for (const hook of hooks) {
      try {
        await hook(...args);
      } catch (error) {
        console.error(chalk.red(`Hook ${hookName} failed: ${error.message}`));
      }
    }
  }

  /**
   * Get a registered service
   */
  getService(serviceName) {
    return this.services.get(serviceName);
  }

  /**
   * Get all registered commands
   */
  getCommands() {
    return this.commands;
  }

  /**
   * Install a plugin from a URL or local path
   */
  async installPlugin(source, options = {}) {
    const spinner = ora(`Installing plugin from ${source}...`).start();

    try {
      const pluginPath = await this.downloadPlugin(source, options);
      await this.loadPlugin(pluginPath);

      spinner.succeed(`Installed plugin: ${source}`);
    } catch (error) {
      spinner.fail(`Failed to install plugin: ${error.message}`);
      throw error;
    }
  }

  /**
   * Download and install plugin
   */
  async downloadPlugin(source, options) {
    // For now, just copy from local path
    // In a real implementation, this would download from a registry
    const fs = await import("fs").then((m) => m.promises);
    const path = await import("path");

    if (source.startsWith("http://") || source.startsWith("https://")) {
      throw new Error("Remote plugin installation not implemented yet");
    }

    const pluginDir = join(
      this.pluginsDir,
      path.default.basename(source, ".js"),
    );

    if (!existsSync(pluginDir)) {
      mkdirSync(pluginDir, { recursive: true });
    }

    const pluginFile = join(pluginDir, "index.js");
    await fs.copyFile(source, pluginFile);

    return pluginFile;
  }

  /**
   * Uninstall a plugin
   */
  async uninstallPlugin(pluginName) {
    const spinner = ora(`Uninstalling plugin: ${pluginName}...`).start();

    try {
      // Remove from registry
      this.plugins.delete(pluginName);
      this.hooks.delete(pluginName);
      this.commands.delete(pluginName);
      this.services.delete(pluginName);

      // Remove files
      const pluginDir = join(this.pluginsDir, pluginName);
      if (existsSync(pluginDir)) {
        const fs = await import("fs").then((m) => m.promises);
        await fs.rm(pluginDir, { recursive: true, force: true });
      }

      spinner.succeed(`Uninstalled plugin: ${pluginName}`);
    } catch (error) {
      spinner.fail(`Failed to uninstall plugin: ${error.message}`);
      throw error;
    }
  }

  /**
   * List installed plugins
   */
  listPlugins() {
    const plugins = Array.from(this.plugins.values());

    if (plugins.length === 0) {
      console.log(chalk.yellow("No plugins installed"));
      return [];
    }

    console.log(chalk.green("Installed plugins:"));
    plugins.forEach((plugin) => {
      console.log(`  ${chalk.cyan(plugin.name)} v${plugin.version}`);
      console.log(`    ${plugin.description}`);

      if (plugin.commands) {
        console.log(`    Commands: ${Object.keys(plugin.commands).join(", ")}`);
      }

      if (plugin.hooks) {
        console.log(`    Hooks: ${Object.keys(plugin.hooks).join(", ")}`);
      }

      console.log("");
    });

    return plugins;
  }

  /**
   * Get plugin files — scans pluginsDir for index.js entry points
   */
  getPluginFiles() {
    if (!existsSync(this.pluginsDir)) {
      return [];
    }

    const files = [];
    const dirs = readdirSync(this.pluginsDir);

    for (const dir of dirs) {
      const pluginDir = join(this.pluginsDir, dir);
      const pluginFile = join(pluginDir, "index.js");

      if (existsSync(pluginFile)) {
        files.push(pluginFile);
      }
    }

    return files;
  }

  /**
   * Create a new plugin template
   */
  createPluginTemplate(name, options = {}) {
    const template = this.generatePluginTemplate(name, options);
    const pluginDir = join(this.pluginsDir, name);
    const pluginFile = join(pluginDir, "index.js");

    if (!existsSync(pluginDir)) {
      mkdirSync(pluginDir, { recursive: true });
    }

    writeFileSync(pluginFile, template);
    console.log(chalk.green(`Created plugin template: ${pluginFile}`));

    return pluginFile;
  }

  /**
   * Generate plugin template
   */
  generatePluginTemplate(name, options) {
    const { description = "A GitLobster CLI plugin", author = "Unknown" } =
      options;

    return `/**
 * ${name} - GitLobster CLI Plugin
 * ${description}
 * 
 * Author: ${author}
 * Generated by GitLobster CLI
 */

export default {
  name: '${name}',
  version: '1.0.0',
  description: '${description}',
  author: '${author}',
  
  // Hooks that this plugin registers
  hooks: {
    // Example hook: before command execution
    'before:install': async (packageName, options) => {
      console.log(\`Installing package: \${packageName}\`);
    },
    
    // Example hook: after command execution
    'after:install': async (packageName, result) => {
      console.log(\`Successfully installed: \${packageName}\`);
    }
  },
  
  // Commands that this plugin adds
  commands: {
    // Example command: custom command
    'my-command': async (args, options) => {
      console.log('Executing custom command');
      // Your command logic here
    }
  },
  
  // Services that this plugin provides
  services: {
    // Example service: custom service
    'my-service': {
      doSomething: async (data) => {
        // Your service logic here
        return data;
      }
    }
  },
  
  // Plugin lifecycle hooks
  async onLoad() {
    console.log(\`Plugin \${this.name} loaded\`);
  },
  
  async onUnload() {
    console.log(\`Plugin \${this.name} unloaded\`);
  }
};
`;
  }
}

/**
 * Plugin base class for easier plugin development
 */
export class Plugin {
  constructor(name, options = {}) {
    this.name = name;
    this.version = options.version || "1.0.0";
    this.description = options.description || "A GitLobster CLI plugin";
    this.author = options.author || "Unknown";
    this.hooks = {};
    this.commands = {};
    this.services = {};
  }

  /**
   * Register a hook
   */
  addHook(hookName, hookFunction) {
    this.hooks[hookName] = hookFunction;
  }

  /**
   * Register a command
   */
  addCommand(commandName, commandFunction) {
    this.commands[commandName] = commandFunction;
  }

  /**
   * Register a service
   */
  addService(serviceName, serviceFunction) {
    this.services[serviceName] = serviceFunction;
  }

  /**
   * Plugin lifecycle methods
   */
  async onLoad() {}
  async onUnload() {}
}
