/**
 * Init Command - Initialize a new skill package
 * Creates gitlobster.json, README.md with YAML frontmatter, and .gitignore
 */

import { writeFile, mkdir, access } from 'fs/promises';
import { resolve, basename } from 'path';
import ora from 'ora';
import chalk from 'chalk';
import * as git from '../src/git-utils.js';

// File constants
const CONFIG_FILE = 'gitlobster.json';
const README_FILE = 'README.md';
const GITIGNORE_FILE = '.gitignore';

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
 * Create directory if it doesn't exist
 * @param {string} path - Directory path
 */
async function ensureDirectory(path) {
  const exists = await fileExists(path);
  if (!exists) {
    await mkdir(path, { recursive: true });
  }
}

/**
 * Generate gitlobster.json content
 * @param {object} options - Package options
 * @returns {object} Package manifest
 */
function generatePackageJson(options) {
  return {
    name: options.name,
    version: '1.0.0',
    description: options.description,
    author: {
      name: options.author,
      email: options.email
    },
    permissions: {},
    dependencies: {}
  };
}

/**
 * Generate README.md with YAML frontmatter
 * @param {object} options - Package options
 * @returns {string} README content
 */
function generateReadme(options) {
  const frontmatter = `---
title: ${options.name}
description: ${options.description}
version: 1.0.0
author: ${options.author}
---

# ${options.name}

${options.description}

## Installation

\`\`\`bash
gitlobster install ${options.name}
\`\`\`

## Usage

Describe how to use this skill package.

## License

MIT
`;

  return frontmatter;
}

/**
 * Generate .gitignore content
 * @returns {string} Gitignore content
 */
function generateGitignore() {
  return `# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Build outputs
dist/
build/
*.egg-info/

# Logs
logs/
*.log

# Temporary files
tmp/
temp/
`;
}

/**
 * Main init command
 * @param {string} path - Target directory path
 * @param {object} options - Command options
 */
export async function initCommand(path = '.', options) {
  const targetPath = resolve(path);
  const spinner = ora('Initializing skill package').start();

  try {
    // Step 1: Derive name from directory if not provided
    const packageName = options.name || basename(targetPath);
    
    // Step 2: Ensure target directory exists
    spinner.text = 'Creating directory...';
    await ensureDirectory(targetPath);
    spinner.succeed('Directory ready');

    // Step 3: Check if gitlobster.json already exists
    spinner.text = 'Checking for existing package...';
    const configPath = resolve(targetPath, CONFIG_FILE);
    if (await fileExists(configPath)) {
      spinner.warn(chalk.yellow('Package already initialized'));
      console.log(`\n${chalk.yellow('A gitlobster.json already exists in this directory.')}`);
      console.log(chalk.yellow('To reinitialize, remove the existing package files first.'));
      process.exit(0);
    }
    spinner.succeed('No existing package found');

    // Step 4: Check if git is available
    spinner.text = 'Checking Git availability...';
    if (!git.checkGitAvailable()) {
      throw new Error('Git is not available. Please install Git and ensure it is in your PATH.');
    }
    spinner.succeed('Git is available');

    // Step 5: Prepare package options
    const packageOptions = {
      name: packageName,
      description: options.description || 'A GitLobster skill package',
      author: options.author || 'Unknown',
      email: options.email || ''
    };

    // Step 6: Create gitlobster.json
    spinner.text = 'Creating gitlobster.json...';
    const packageJson = generatePackageJson(packageOptions);
    await writeFile(configPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf-8');
    spinner.succeed(`${chalk.cyan(CONFIG_FILE)} created`);

    // Step 7: Create README.md with YAML frontmatter
    spinner.text = 'Creating README.md...';
    const readmePath = resolve(targetPath, README_FILE);
    const readmeContent = generateReadme(packageOptions);
    await writeFile(readmePath, readmeContent, 'utf-8');
    spinner.succeed(`${chalk.cyan(README_FILE)} created`);

    // Step 8: Create .gitignore
    spinner.text = 'Creating .gitignore...';
    const gitignorePath = resolve(targetPath, GITIGNORE_FILE);
    const gitignoreContent = generateGitignore();
    await writeFile(gitignorePath, gitignoreContent, 'utf-8');
    spinner.succeed(`${chalk.cyan(GITIGNORE_FILE)} created`);

    // Step 9: Initialize git repository
    spinner.text = 'Initializing Git repository...';
    const initResult = git.initRepo(targetPath);
    if (!initResult.success) {
      throw new Error(`Failed to initialize Git: ${initResult.message}`);
    }
    spinner.succeed('Git repository initialized');

    // Step 10: Initial commit
    spinner.text = 'Creating initial commit...';
    const addResult = git.addFiles(['.'], { cwd: targetPath });
    if (!addResult.success) {
      spinner.warn(chalk.yellow('Could not add files to staging'));
    }

    const commitResult = git.commit(
      'Initial commit - GitLobster skill package',
      { name: packageOptions.author, email: packageOptions.email },
      { cwd: targetPath }
    );

    if (commitResult.success) {
      spinner.succeed('Initial commit created');
    } else if (commitResult.message.includes('nothing to commit')) {
      spinner.succeed('Initial commit created');
    } else {
      spinner.warn(chalk.yellow('Could not create initial commit'));
    }

    // Final success message
    spinner.succeed(chalk.green('Skill package initialized!'));
    console.log(`\n  ${chalk.cyan('Package:')} ${chalk.green(packageName)}`);
    console.log(`  ${chalk.cyan('Version:')} 1.0.0`);
    console.log(`  ${chalk.cyan('Path:')} ${chalk.dim(targetPath)}`);
    console.log(`\n  ${chalk.dim('Next steps:')}`);
    console.log(`  ${chalk.dim('1.')} Add your skill code`);
    console.log(`  ${chalk.dim('2.')} Edit README.md with usage instructions`);
    console.log(`  ${chalk.dim('3.')} Run ${chalk.cyan('gitlobster publish')} to publish\n`);

  } catch (error) {
    spinner.fail(chalk.red('Initialization failed'));
    console.error(`\n${chalk.red('Error:')} ${error.message}`);
    process.exit(1);
  }
}
