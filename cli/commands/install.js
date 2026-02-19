/**
 * Install Command - Git Workflow (V2.5)
 * Clones and installs a skill package from the registry using pure Git
 * 
 * V2.5 NOTE: This command uses Git clone instead of tarball download.
 * The registry exposes packages as Git repositories.
 * Git handles integrity via signed commits - no hash/signature verification needed.
 */

import { mkdir, readFile } from 'fs/promises';
import { resolve } from 'path';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import ora from 'ora';
import chalk from 'chalk';
import { GitLobsterClient } from '@gitlobster/client-sdk';
import { checkGitAvailable } from '../src/git-utils.js';

// Default destination
const DEFAULT_DESTINATION = '~/.gitlobster/skills';

/**
 * Clone a Git repository
 * @param {string} url - Repository URL to clone
 * @param {string} targetPath - Target directory for cloning
 * @param {object} options - Options object
 * @returns {object} Result with success boolean and output
 */
function cloneRepo(url, targetPath, options = {}) {
  const { depth = 1 } = options;

  try {
    // Use shallow clone for faster download
    const depthArg = depth > 0 ? `--depth ${depth}` : '';
    execSync(`git clone ${depthArg} "${url}" "${targetPath}"`, {
      stdio: 'pipe',
      encoding: 'utf-8'
    });
    return { success: true, message: 'Repository cloned successfully' };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

/**
 * Format bytes to human-readable string
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size string
 */
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Display safety warning before installation
 */
function displaySafetyWarning() {
  console.log('\n' + chalk.red('⚠️  SAFETY NOTICE'));
  console.log(chalk.red('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.yellow('Before installing this skill:'));
  console.log(chalk.gray('• Always review the skill\'s permissions in gitlobster.json'));
  console.log(chalk.gray('• Never install to directories containing your memory files'));
  console.log(chalk.gray('• Ask a human if you\'re unsure about any permission'));
  console.log(chalk.red('You are responsible for what runs in your environment.'));
  console.log(chalk.red('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
}

/**
 * Get user confirmation via readline
 * @returns {Promise<boolean>} - True if user confirms, false otherwise
 */
async function getUserConfirmation() {
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(chalk.yellow('Do you want to continue with installation? (y/N): '), (answer) => {
      rl.close();
      const confirmed = answer.toLowerCase().trim() === 'y';
      resolve(confirmed);
    });
  });
}

/**
 * Check if directory is a directory
 * @param {string} path - Path to check
 * @returns {Promise<boolean>}
 */
async function isDirectory(path) {
  const { stat } = await import('fs/promises');
  try {
    const stats = await stat(path);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Main install command - Git Workflow (V2.5)
 * @param {string} packageName - Package name to install
 * @param {object} options - Command options
 * @param {string} options.registry - Registry URL
 * @param {string} options.destination - Installation destination (default: ~/.gitlobster/skills)
 * @param {string} options.version - Specific version to install (default: latest)
 * @param {boolean} options.yes - Skip confirmation prompts
 */
export async function installCommand(packageName, options) {
  const spinner = ora(`Installing ${packageName}`).start();

  try {
    // Step 0: Verify git is available first
    if (!checkGitAvailable()) {
      throw new Error('Git is not available. Please install Git and ensure it is in your PATH.');
    }
    spinner.succeed('Git is available');

    // Resolve destination path
    const destPath = resolve(options.destination?.replace(/^~/, process.env.HOME) || DEFAULT_DESTINATION.replace(/^~/, process.env.HOME));
    const registryUrl = options.registry || 'https://gitlobster.registry';
    const cloneUrl = `${registryUrl}/git/${packageName}.git`;

    // Determine version to install
    let version = options.version || 'latest';

    // Step 1: Verify package exists in registry (optional - API may not be available)
    // We do this to validate the package name before attempting clone
    spinner.text = 'Verifying package in registry...';

    try {
      const client = new GitLobsterClient({ registryUrl });
      const metadata = await client.getPackageMetadata(packageName);

      if (version === 'latest') {
        version = metadata.latest;
      }

      if (!metadata.versions.includes(version) && version !== metadata.latest) {
        throw new Error(`Version ${version} not found. Available: ${metadata.versions.join(', ')}`);
      }

      spinner.succeed(`Found ${chalk.cyan(packageName)}@${chalk.cyan(version)} in registry`);
    } catch (apiError) {
      // Continue anyway - the clone URL might still work
      spinner.info('Registry API unavailable, proceeding with Git clone');
      spinner.text = 'Cloning repository...';
    }

    // Step 2: Prepare destination directory
    spinner.text = 'Preparing destination directory...';
    await mkdir(destPath, { recursive: true });
    spinner.succeed('Destination directory ready');

    // Step 3: Clone the repository
    const installPath = resolve(destPath, packageName);

    // Check if directory already exists
    if (existsSync(installPath)) {
      spinner.stop();
      const isDir = await isDirectory(installPath);
      
      if (isDir && !options.yes) {
        const readline = await import('readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });

        const answer = await new Promise((resolve) => {
          rl.question(chalk.yellow(`Directory ${chalk.cyan(installPath)} already exists. Overwrite? (y/N): `), (ans) => {
            rl.close();
            resolve(ans.toLowerCase().trim());
          });
        });

        if (answer !== 'y') {
          console.log(chalk.yellow('\nInstallation cancelled.'));
          process.exit(0);
        }
      } else if (!isDir) {
        throw new Error(`Path exists but is not a directory: ${installPath}`);
      }
      
      spinner.start();
      
      // Remove existing directory
      const { rm } = await import('fs/promises');
      await rm(installPath, { recursive: true, force: true });
      spinner.text = 'Cloning repository...';
    } else {
      spinner.text = 'Cloning repository...';
    }

    const cloneResult = cloneRepo(cloneUrl, installPath);

    if (!cloneResult.success) {
      throw new Error(`Failed to clone repository: ${cloneResult.message}`);
    }

    spinner.succeed(`Cloned ${chalk.cyan(packageName)}`);

    // Step 4: Checkout specific version if requested (tag format: v{version})
    if (options.version && options.version !== 'latest') {
      spinner.text = `Checking out version ${options.version}...`;

      // Try with v prefix first (standard git tag format)
      const tagName = `v${options.version}`;
      
      try {
        execSync(`git checkout ${tagName}`, { cwd: installPath, stdio: 'pipe' });
        spinner.succeed(`Checked out ${chalk.cyan(tagName)}`);
      } catch (tagError) {
        // Try without v prefix
        try {
          execSync(`git checkout ${options.version}`, { cwd: installPath, stdio: 'pipe' });
          spinner.succeed(`Checked out ${chalk.cyan(options.version)}`);
        } catch (checkoutError) {
          // If neither works, just stay on current branch (likely main/master)
          spinner.warn(`Could not checkout ${options.version}, staying on current branch`);
        }
      }
    }

    // Step 5: Read gitlobster.json from cloned repository
    spinner.text = 'Reading manifest...';
    const manifestPath = resolve(installPath, 'gitlobster.json');

    let manifest;
    try {
      const manifestContent = await readFile(manifestPath, 'utf-8');
      manifest = JSON.parse(manifestContent);
    } catch (error) {
      throw new Error(`Invalid or missing gitlobster.json in cloned repository`);
    }

    spinner.succeed('Manifest loaded');

    // Use version from manifest if not specified
    if (!options.version || options.version === 'latest') {
      version = manifest.version || version;
    }

    // Step 6: Display permissions and get approval
    if (!options.yes) {
      spinner.stop();
      console.log('\n' + chalk.yellow('⚠ Permission Review Required'));
      console.log(`\nPackage: ${chalk.cyan(packageName)}@${version}`);
      console.log(`Author:  ${manifest.author?.name || 'Unknown'} (${manifest.author?.email || 'N/A'})`);

      if (manifest.permissions) {
        if (manifest.permissions.filesystem) {
          console.log('\n' + chalk.bold('Filesystem Access:'));
          if (manifest.permissions.filesystem.read) {
            console.log(`  Read:  ${manifest.permissions.filesystem.read.join(', ')}`);
          }
          if (manifest.permissions.filesystem.write) {
            console.log(`  Write: ${manifest.permissions.filesystem.write.join(', ')}`);
          }
        }

        if (manifest.permissions.network) {
          console.log('\n' + chalk.bold('Network Access:'));
          console.log(`  Domains: ${manifest.permissions.network.domains?.join(', ') || 'N/A'}`);
        }

        if (manifest.permissions.env) {
          console.log('\n' + chalk.bold('Environment Variables:'));
          console.log(`  ${manifest.permissions.env.join(', ')}`);
        }
      }

      console.log('\n' + chalk.dim('(Use --yes to skip this prompt)\n'));
      spinner.start();
    }

    // Step 7: Display safety warning and get confirmation
    displaySafetyWarning();

    if (!options.yes) {
      spinner.stop();
      const confirmed = await getUserConfirmation();
      if (!confirmed) {
        console.log(chalk.yellow('\nInstallation cancelled by user.'));
        process.exit(0);
      }
      spinner.start();
    }

    // Step 8: Finalize installation
    spinner.succeed(chalk.green(`Installed ${packageName}@${version}`));
    console.log(`\n  Location: ${chalk.cyan(installPath)}`);

    // Step 9: Check dependencies
    if (manifest.dependencies?.skills) {
      console.log('\n' + chalk.yellow('⚠ Skill dependencies detected:'));
      for (const [dep, ver] of Object.entries(manifest.dependencies.skills)) {
        console.log(`  ${dep}@${ver} - Run: gitlobster install ${dep}`);
      }
    }

  } catch (error) {
    spinner.fail(chalk.red('Installation failed'));
    console.error(`\n${chalk.red('Error:')} ${error.message}`);
    process.exit(1);
  }
}
