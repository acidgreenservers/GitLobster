import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import chalk from "chalk";
import ora from "ora";

/**
 * Smart Conflict Resolution System for Package Updates
 *
 * Handles merge conflicts during package updates with intelligent strategies:
 * - Semantic versioning conflict resolution
 * - Dependency compatibility analysis
 * - Configuration file merging
 * - Backup and rollback capabilities
 */

export class ConflictResolver {
  constructor(options = {}) {
    this.backupDir = options.backupDir || ".gitlobster-backup";
    this.strategies = {
      "auto-merge": this.autoMergeStrategy.bind(this),
      "keep-local": this.keepLocalStrategy.bind(this),
      "keep-remote": this.keepRemoteStrategy.bind(this),
      manual: this.manualStrategy.bind(this),
      semantic: this.semanticVersionStrategy.bind(this),
    };
  }

  /**
   * Resolve conflicts during package update
   */
  async resolveConflicts(
    packageName,
    localManifest,
    remoteManifest,
    strategy = "auto-merge",
  ) {
    const spinner = ora(`Resolving conflicts for ${packageName}...`).start();

    try {
      // Create backup
      const backupPath = await this.createBackup(packageName, localManifest);

      // Analyze conflicts
      const conflicts = this.analyzeConflicts(localManifest, remoteManifest);

      if (conflicts.length === 0) {
        spinner.succeed("No conflicts detected");
        return {
          resolved: true,
          strategy: "no-conflicts",
          manifest: remoteManifest,
        };
      }

      spinner.text = `Found ${conflicts.length} conflicts, applying ${strategy} strategy...`;

      // Apply resolution strategy
      const resolution = await this.strategies[strategy](
        packageName,
        localManifest,
        remoteManifest,
        conflicts,
      );

      spinner.succeed(
        `Conflicts resolved using ${resolution.strategy} strategy`,
      );

      return {
        resolved: true,
        strategy: resolution.strategy,
        manifest: resolution.manifest,
        conflicts: conflicts,
        backupPath: backupPath,
      };
    } catch (error) {
      spinner.fail("Failed to resolve conflicts");
      throw error;
    }
  }

  /**
   * Analyze conflicts between local and remote manifests
   */
  analyzeConflicts(localManifest, remoteManifest) {
    const conflicts = [];

    // Version conflicts
    if (localManifest.version !== remoteManifest.version) {
      conflicts.push({
        type: "version",
        field: "version",
        local: localManifest.version,
        remote: remoteManifest.version,
        severity: "medium",
      });
    }

    // Dependency conflicts
    const localDeps = localManifest.dependencies || {};
    const remoteDeps = remoteManifest.dependencies || {};
    const allDeps = new Set([
      ...Object.keys(localDeps),
      ...Object.keys(remoteDeps),
    ]);

    for (const dep of allDeps) {
      const localVersion = localDeps[dep];
      const remoteVersion = remoteDeps[dep];

      if (localVersion && remoteVersion && localVersion !== remoteVersion) {
        conflicts.push({
          type: "dependency",
          field: `dependencies.${dep}`,
          local: localVersion,
          remote: remoteVersion,
          severity: this.getDependencyConflictSeverity(
            dep,
            localVersion,
            remoteVersion,
          ),
        });
      } else if (!localVersion && remoteVersion) {
        conflicts.push({
          type: "dependency-add",
          field: `dependencies.${dep}`,
          local: null,
          remote: remoteVersion,
          severity: "low",
        });
      } else if (localVersion && !remoteVersion) {
        conflicts.push({
          type: "dependency-remove",
          field: `dependencies.${dep}`,
          local: localVersion,
          remote: null,
          severity: "low",
        });
      }
    }

    // Configuration conflicts
    if (localManifest.config && remoteManifest.config) {
      const configConflicts = this.compareConfigurations(
        localManifest.config,
        remoteManifest.config,
      );
      conflicts.push(...configConflicts);
    }

    // Script conflicts
    if (localManifest.scripts && remoteManifest.scripts) {
      const scriptConflicts = this.compareScripts(
        localManifest.scripts,
        remoteManifest.scripts,
      );
      conflicts.push(...scriptConflicts);
    }

    return conflicts;
  }

  /**
   * Get severity of dependency conflict
   */
  getDependencyConflictSeverity(dep, localVersion, remoteVersion) {
    // Check if versions are compatible (semantic versioning)
    if (this.areVersionsCompatible(localVersion, remoteVersion)) {
      return "low";
    }

    // Check if it's a major version change
    if (this.isMajorVersionChange(localVersion, remoteVersion)) {
      return "high";
    }

    return "medium";
  }

  /**
   * Auto-merge strategy: Try to intelligently merge changes
   */
  async autoMergeStrategy(
    packageName,
    localManifest,
    remoteManifest,
    conflicts,
  ) {
    const merged = { ...remoteManifest };

    // Keep local version if it's higher
    if (
      this.compareVersions(localManifest.version, remoteManifest.version) > 0
    ) {
      merged.version = localManifest.version;
    }

    // Merge dependencies intelligently
    merged.dependencies = this.mergeDependencies(
      localManifest.dependencies || {},
      remoteManifest.dependencies || {},
    );

    // Merge configurations
    merged.config = this.mergeConfigurations(
      localManifest.config || {},
      remoteManifest.config || {},
    );

    // Merge scripts
    merged.scripts = this.mergeScripts(
      localManifest.scripts || {},
      remoteManifest.scripts || {},
    );

    return {
      strategy: "auto-merge",
      manifest: merged,
      conflicts: conflicts,
    };
  }

  /**
   * Keep local strategy: Preserve all local changes
   */
  async keepLocalStrategy(
    packageName,
    localManifest,
    remoteManifest,
    conflicts,
  ) {
    return {
      strategy: "keep-local",
      manifest: localManifest,
      conflicts: conflicts,
    };
  }

  /**
   * Keep remote strategy: Accept all remote changes
   */
  async keepRemoteStrategy(
    packageName,
    localManifest,
    remoteManifest,
    conflicts,
  ) {
    return {
      strategy: "keep-remote",
      manifest: remoteManifest,
      conflicts: conflicts,
    };
  }

  /**
   * Manual strategy: Prompt user for each conflict
   */
  async manualStrategy(packageName, localManifest, remoteManifest, conflicts) {
    console.log(
      chalk.yellow(`\nManual conflict resolution required for ${packageName}:`),
    );

    const resolved = { ...remoteManifest };
    const inquirer = await import("inquirer");

    for (const conflict of conflicts) {
      console.log(chalk.red(`\nConflict in ${conflict.field}:`));
      console.log(`  Local:  ${conflict.local}`);
      console.log(`  Remote: ${conflict.remote}`);

      const answer = await inquirer.default.prompt([
        {
          type: "list",
          name: "resolution",
          message: `Resolve conflict in ${conflict.field}:`,
          choices: [
            { name: "Keep local value", value: "local" },
            { name: "Keep remote value", value: "remote" },
            { name: "Custom value", value: "custom" },
          ],
        },
      ]);

      if (answer.resolution === "local") {
        resolved = this.applyLocalResolution(resolved, conflict, localManifest);
      } else if (answer.resolution === "remote") {
        resolved = this.applyRemoteResolution(
          resolved,
          conflict,
          remoteManifest,
        );
      } else {
        const customAnswer = await inquirer.default.prompt([
          {
            type: "input",
            name: "customValue",
            message: "Enter custom value:",
            validate: (input) =>
              input.trim().length > 0 || "Value cannot be empty",
          },
        ]);
        resolved = this.applyCustomResolution(
          resolved,
          conflict,
          customAnswer.customValue,
        );
      }
    }

    return {
      strategy: "manual",
      manifest: resolved,
      conflicts: conflicts,
    };
  }

  /**
   * Semantic version strategy: Use semantic versioning rules
   */
  async semanticVersionStrategy(
    packageName,
    localManifest,
    remoteManifest,
    conflicts,
  ) {
    const resolved = { ...remoteManifest };

    // For version conflicts, use semantic versioning rules
    if (localManifest.version !== remoteManifest.version) {
      const comparison = this.compareVersions(
        localManifest.version,
        remoteManifest.version,
      );

      if (comparison > 0) {
        // Local version is higher, keep it
        resolved.version = localManifest.version;
      } else if (comparison === 0) {
        // Same version, prefer remote (more recent)
        resolved.version = remoteManifest.version;
      } else {
        // Remote version is higher, use it
        resolved.version = remoteManifest.version;
      }
    }

    // For dependencies, prefer compatible versions
    resolved.dependencies = this.resolveDependencyConflicts(
      localManifest.dependencies || {},
      remoteManifest.dependencies || {},
    );

    return {
      strategy: "semantic",
      manifest: resolved,
      conflicts: conflicts,
    };
  }

  /**
   * Create backup of current state
   */
  async createBackup(packageName, manifest) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupDir = join(process.cwd(), this.backupDir);
    const backupFile = join(backupDir, `${packageName}-${timestamp}.json`);

    if (!existsSync(backupDir)) {
      await import("fs").then((fs) =>
        fs.mkdirSync(backupDir, { recursive: true }),
      );
    }

    writeFileSync(backupFile, JSON.stringify(manifest, null, 2));
    return backupFile;
  }

  /**
   * Rollback to backup
   */
  async rollback(backupPath, targetPath) {
    if (!existsSync(backupPath)) {
      throw new Error(`Backup file not found: ${backupPath}`);
    }

    const backupContent = readFileSync(backupPath, "utf-8");
    writeFileSync(targetPath, backupContent);

    console.log(chalk.green(`Rolled back to backup: ${backupPath}`));
  }

  // Helper methods

  compareVersions(v1, v2) {
    const a = v1.split(".").map(Number);
    const b = v2.split(".").map(Number);

    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const numA = a[i] || 0;
      const numB = b[i] || 0;

      if (numA > numB) return 1;
      if (numA < numB) return -1;
    }

    return 0;
  }

  areVersionsCompatible(v1, v2) {
    // Simple compatibility check - same major version
    const major1 = v1.split(".")[0];
    const major2 = v2.split(".")[0];
    return major1 === major2;
  }

  isMajorVersionChange(v1, v2) {
    const major1 = v1.split(".")[0];
    const major2 = v2.split(".")[0];
    return major1 !== major2;
  }

  mergeDependencies(localDeps, remoteDeps) {
    const merged = { ...remoteDeps };

    for (const [dep, localVersion] of Object.entries(localDeps)) {
      const remoteVersion = remoteDeps[dep];

      if (!remoteVersion) {
        // Local dependency not in remote, keep it
        merged[dep] = localVersion;
      } else if (this.compareVersions(localVersion, remoteVersion) > 0) {
        // Local version is higher, keep it if compatible
        if (this.areVersionsCompatible(localVersion, remoteVersion)) {
          merged[dep] = localVersion;
        }
      }
    }

    return merged;
  }

  mergeConfigurations(localConfig, remoteConfig) {
    return { ...remoteConfig, ...localConfig };
  }

  mergeScripts(localScripts, remoteScripts) {
    return { ...remoteScripts, ...localScripts };
  }

  compareConfigurations(localConfig, remoteConfig) {
    const conflicts = [];

    for (const [key, localValue] of Object.entries(localConfig)) {
      const remoteValue = remoteConfig[key];

      if (
        remoteValue !== undefined &&
        JSON.stringify(localValue) !== JSON.stringify(remoteValue)
      ) {
        conflicts.push({
          type: "configuration",
          field: `config.${key}`,
          local: localValue,
          remote: remoteValue,
          severity: "medium",
        });
      }
    }

    return conflicts;
  }

  compareScripts(localScripts, remoteScripts) {
    const conflicts = [];

    for (const [key, localScript] of Object.entries(localScripts)) {
      const remoteScript = remoteScripts[key];

      if (remoteScript && localScript !== remoteScript) {
        conflicts.push({
          type: "script",
          field: `scripts.${key}`,
          local: localScript,
          remote: remoteScript,
          severity: "low",
        });
      }
    }

    return conflicts;
  }

  /**
   * Apply a resolution by setting the conflict field to the local manifest's value.
   * Handles nested dot-notation field paths (e.g. "dependencies.@scope/pkg").
   * @param {object} manifest - Current resolved manifest (mutated copy)
   * @param {object} conflict - Conflict descriptor with .field and .local
   * @param {object} localManifest - The original local manifest
   * @returns {object} Updated manifest
   */
  applyLocalResolution(manifest, conflict, localManifest) {
    return this._setNestedField(manifest, conflict.field, conflict.local);
  }

  /**
   * Apply a resolution by setting the conflict field to the remote manifest's value.
   * @param {object} manifest - Current resolved manifest (mutated copy)
   * @param {object} conflict - Conflict descriptor with .field and .remote
   * @param {object} remoteManifest - The original remote manifest
   * @returns {object} Updated manifest
   */
  applyRemoteResolution(manifest, conflict, remoteManifest) {
    return this._setNestedField(manifest, conflict.field, conflict.remote);
  }

  /**
   * Apply a user-provided custom value to the conflict field.
   * @param {object} manifest - Current resolved manifest (mutated copy)
   * @param {object} conflict - Conflict descriptor with .field
   * @param {string} customValue - Raw user input string
   * @returns {object} Updated manifest
   */
  applyCustomResolution(manifest, conflict, customValue) {
    // Attempt to parse as JSON first (e.g. version constraints), fall back to string
    let parsed;
    try {
      parsed = JSON.parse(customValue);
    } catch {
      parsed = customValue;
    }
    return this._setNestedField(manifest, conflict.field, parsed);
  }

  /**
   * Set a value at a dot-notation path within an object.
   * e.g. field="dependencies.@scope/pkg" sets manifest.dependencies["@scope/pkg"]
   * @param {object} obj
   * @param {string} field - Dot-separated path
   * @param {any} value
   * @returns {object} The mutated object
   */
  _setNestedField(obj, field, value) {
    const parts = field.split(".");
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      if (current[parts[i]] == null || typeof current[parts[i]] !== "object") {
        current[parts[i]] = {};
      }
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = value;
    return obj;
  }

  resolveDependencyConflicts(localDeps, remoteDeps) {
    const resolved = { ...remoteDeps };

    for (const [dep, localVersion] of Object.entries(localDeps)) {
      const remoteVersion = remoteDeps[dep];

      if (remoteVersion) {
        if (this.areVersionsCompatible(localVersion, remoteVersion)) {
          resolved[dep] =
            this.compareVersions(localVersion, remoteVersion) > 0
              ? localVersion
              : remoteVersion;
        } else {
          // Incompatible versions, prefer remote but warn
          resolved[dep] = remoteVersion;
        }
      } else {
        resolved[dep] = localVersion;
      }
    }

    return resolved;
  }
}
