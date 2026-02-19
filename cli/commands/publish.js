/**
 * Publish Command - Git Workflow (V2.5)
 * Validates and publishes a skill to the registry using pure Git workflow
 * 
 * V2.5 NOTE: This command uses Git push only - NO tarball uploads.
 * The server's post-receive hook handles package registration.
 */

import { readFile, access, stat } from 'fs/promises';
import { resolve } from 'path';
import ora from 'ora';
import chalk from 'chalk';
import yaml from 'js-yaml';
import * as git from '../src/git-utils.js';

// File constants
const CONFIG_FILE = 'gitlobster.json';
const README_FILE = 'README.md';

/**
 * Prompt for user confirmation (interactive mode)
 * @param {string} question - Question to ask
 * @returns {Promise<boolean>} User response
 */
async function promptConfirmation(question) {
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase().startsWith('y'));
    });
  });
}

/**
 * Parse YAML frontmatter from markdown content
 * @param {string} content - Markdown content with YAML frontmatter
 * @returns {object|null} Parsed frontmatter or null if not found
 */
function parseYamlFrontmatter(content) {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return null;
  }

  try {
    return yaml.load(match[1]);
  } catch (error) {
    return null;
  }
}

/**
 * Check if file exists
 * @param {string} path - File path to check
 * @returns {Promise<boolean>}
 */
async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if path is a directory
 * @param {string} path - Path to check
 * @returns {Promise<boolean>}
 */
async function isDirectory(path) {
  try {
    const stats = await stat(path);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Load and validate gitlobster.json
 * @param {string} skillPath - Path to skill directory
 * @returns {Promise<object>} Validated manifest
 */
async function loadConfig(skillPath) {
  const configPath = resolve(skillPath, CONFIG_FILE);

  if (!await fileExists(configPath)) {
    throw new Error(`${CONFIG_FILE} not found in ${skillPath}. Run 'gitlobster init' first.`);
  }

  const content = await readFile(configPath, 'utf-8');
  let config;

  try {
    config = JSON.parse(content);
  } catch (error) {
    throw new Error(`Invalid JSON in ${CONFIG_FILE}: ${error.message}`);
  }

  // Validate required fields
  if (!config.name) {
    throw new Error(`${CONFIG_FILE} must have a "name" field`);
  }

  if (!config.version) {
    throw new Error(`${CONFIG_FILE} must have a "version" field`);
  }

  if (!config.author || !config.author.name || !config.author.email) {
    throw new Error(`${CONFIG_FILE} must have "author" with "name" and "email" fields`);
  }

  return config;
}

/**
 * Load and parse README.md with YAML frontmatter
 * @param {string} skillPath - Path to skill directory
 * @returns {Promise<object>} Parsed frontmatter
 */
async function loadReadme(skillPath) {
  const readmePath = resolve(skillPath, README_FILE);

  if (!await fileExists(readmePath)) {
    throw new Error(`${README_FILE} not found in ${skillPath}. README.md with YAML frontmatter is required.`);
  }

  const content = await readFile(readmePath, 'utf-8');
  const frontmatter = parseYamlFrontmatter(content);

  if (!frontmatter) {
    throw new Error(`${README_FILE} must have YAML frontmatter (e.g., ---\ntitle: package-name\n---)`);
  }

  if (!frontmatter.title) {
    throw new Error(`${README_FILE} frontmatter must have a "title" field`);
  }

  return frontmatter;
}

/**
 * Validate that config name matches README title
 * @param {object} config - gitlobster.json contents
 * @param {object} frontmatter - README.md frontmatter
 */
function validateNameMatch(config, frontmatter) {
  if (config.name !== frontmatter.title) {
    throw new Error(
      `Name mismatch: gitlobster.json has "${config.name}" but README.md frontmatter has "${frontmatter.title}". These must match.`
    );
  }
}

/**
 * Show staged changes to user
 * @param {string} skillPath - Path to skill directory
 */
async function showStagedDiff(skillPath) {
  const diff = git.getStagedDiff({ cwd: skillPath });

  if (diff) {
    console.log('\n' + chalk.cyan('Staged changes:'));
    console.log('---');
    console.log(diff);
    console.log('---\n');
  } else {
    console.log(chalk.yellow('No staged changes to show.\n'));
  }
}

/**
 * Main publish command
 * @param {string} path - Path to skill directory
 * @param {object} options - Command options
 */
export async function publishCommand(path, options) {
  // Determine interactive mode
  const isInteractive = options.yes !== true && process.env.GITLOBSTER_INTERACTIVE_PUBLISH !== 'false';

  const skillPath = resolve(path);
  const spinner = ora('Starting publish process').start();

  try {
    // Step 1: Verify skill directory exists
    spinner.text = 'Verifying skill directory...';
    if (!await isDirectory(skillPath)) {
      throw new Error(`Skill directory not found: ${skillPath}`);
    }
    spinner.succeed('Skill directory verified');

    // Step 2: Check if git is available
    spinner.text = 'Checking Git availability...';
    if (!git.checkGitAvailable()) {
      throw new Error('Git is not available. Please install Git and ensure it is in your PATH.');
    }
    spinner.succeed('Git is available');

    // Step 3: Check if it's a git repository
    spinner.text = 'Checking Git repository...';
    if (!git.isGitRepo(skillPath)) {
      throw new Error(`${skillPath} is not a Git repository. Run 'git init' first.`);
    }
    spinner.succeed('Git repository found');

    // Step 4: Load and validate gitlobster.json
    spinner.text = 'Loading gitlobster.json...';
    const config = await loadConfig(skillPath);
    spinner.succeed(`Config loaded: ${chalk.cyan(config.name)}@${chalk.cyan(config.version)}`);

    // Step 5: Load and parse README.md
    spinner.text = 'Parsing README.md...';
    const frontmatter = await loadReadme(skillPath);
    spinner.succeed('README.md parsed');

    // Step 6: Validate name match
    spinner.text = 'Validating package name...';
    validateNameMatch(config, frontmatter);
    spinner.succeed(`Package name validated: ${chalk.green(config.name)}`);

    // Step 7: Interactive mode - show diff and prompt
    if (isInteractive) {
      spinner.text = 'Checking for staged changes...';
      await showStagedDiff(skillPath);

      const confirmed = await promptConfirmation('Proceed with publish? [y/N]: ');
      if (!confirmed) {
        spinner.warn('Publish cancelled by user');
        process.exit(0);
      }
    }

    // Step 8: Add files to git
    spinner.text = 'Adding files to Git...';
    const addResult = git.addFiles(['.'], { cwd: skillPath });
    if (!addResult.success) {
      throw new Error(`Failed to add files: ${addResult.message}`);
    }
    spinner.succeed('Files added to staging');

    // Step 9: Show diff for confirmation (interactive)
    if (isInteractive) {
      await showStagedDiff(skillPath);

      const commitConfirmed = await promptConfirmation('Commit and publish? [y/N]: ');
      if (!commitConfirmed) {
        spinner.warn('Publish cancelled by user');
        process.exit(0);
      }
    }

    // Step 10: Commit changes
    spinner.text = 'Committing changes...';
    const commitMessage = `Publish ${config.name}@${config.version}`;
    const commitResult = git.commit(commitMessage, config.author, { cwd: skillPath });

    if (!commitResult.success) {
      // Check if there are any changes to commit
      if (commitResult.message.includes('nothing to commit')) {
        spinner.info('No changes to commit');
      } else {
        throw new Error(`Failed to commit: ${commitResult.message}`);
      }
    } else {
      spinner.succeed('Changes committed');
    }

    // Step 11: Push to remote
    spinner.text = 'Pushing to remote...';
    const currentBranch = git.getCurrentBranch({ cwd: skillPath });
    const remoteUrl = git.getRemoteUrl('origin', { cwd: skillPath });

    if (!remoteUrl) {
      throw new Error('No remote "origin" configured. Add a remote with: git remote add origin <url>');
    }

    const pushResult = git.push('origin', currentBranch || 'main', { cwd: skillPath });
    if (!pushResult.success) {
      throw new Error(`Failed to push: ${pushResult.message}`);
    }
    spinner.succeed('Pushed to remote');

    // V2.5: Git push is the publish mechanism
    // The server's post-receive hook handles package registration automatically
    spinner.succeed(chalk.green(`Published ${config.name}@${config.version}`));
    console.log(`\n  ${chalk.cyan('Package pushed to registry via Git.')}`);
    console.log(`  ${chalk.dim('The post-receive hook will process and register the package.')}`);

    if (remoteUrl) {
      console.log(`\n  Remote: ${chalk.cyan(remoteUrl)}`);
      console.log(`  Branch: ${chalk.cyan(currentBranch || 'main')}`);
    }

  } catch (error) {
    spinner.fail(chalk.red('Publish failed'));
    console.error(`\n${chalk.red('Error:')} ${error.message}`);
    process.exit(1);
  }
}
