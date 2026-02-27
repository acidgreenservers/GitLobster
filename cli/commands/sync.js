/**
 * Sync Command
 * Synchronize skills between local workspace and registry
 * 
 * Subcommands:
 *   push    - Push local skills to registry
 *   pull    - Pull skills from registry to local workspace
 *   list    - List skills in registry for authenticated agent
 *   status  - Compare local vs registry skills
 */

import { readdir, readFile, writeFile, access, stat, mkdir, rm } from 'fs/promises';
import { resolve, join, basename } from 'path';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { createWriteStream, createReadStream } from 'fs';
import { pipeline } from 'stream/promises';
import ora from 'ora';
import chalk from 'chalk';
import tar from 'tar';
import nacl from 'tweetnacl';
import { GitLobsterClient } from '@gitlobster/client-sdk';
import * as git from '../src/git-utils.js';

// Constants
const CONFIG_FILE = 'gitlobster.json';
const DEFAULT_REGISTRY = process.env.GITLOBSTER_REGISTRY || 'http://localhost:3000';
const DEFAULT_KEY_PATH = '~/.ssh/gitlobster_ed25519';
const DEFAULT_WORKSPACE = process.cwd();

/**
 * Resolve ~ in paths
 */
function resolvePath(p) {
  return resolve(p.replace(/^~/, process.env.HOME));
}

/**
 * Check if file exists
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
 * Load private key from file
 */
async function loadSecretKey(keyPath) {
  const keyRaw = await readFile(resolvePath(keyPath), 'utf-8');

  if (keyRaw.trim().startsWith('-----BEGIN')) {
    throw new Error('PEM keys not supported. Use raw base64 Ed25519 secret key (64 bytes).');
  }

  const secretKey = Buffer.from(keyRaw.trim(), 'base64');

  if (secretKey.length !== 64) {
    throw new Error(`Invalid Ed25519 secret key length: ${secretKey.length} bytes (expected 64).`);
  }

  return secretKey;
}

/**
 * Generate Ed25519-signed JWT
 */
async function generateJWT(scope, keyPath) {
  const secretKey = await loadSecretKey(keyPath);

  const header = { alg: 'EdDSA', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: scope,
    iss: 'gitlobster-cli',
    iat: now,
    exp: now + 3600,
    scope: 'publish'
  };

  const base64url = (input) => {
    const str = typeof input === 'string' ? input : input.toString('utf-8');
    return Buffer.from(str).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const messageBytes = Buffer.from(signingInput, 'utf-8');
  const signature = nacl.sign.detached(messageBytes, secretKey);

  return `${signingInput}.${base64url(Buffer.from(signature))}`;
}

/**
 * Extract scope from package name
 */
function extractScope(packageName) {
  const match = packageName.match(/^(@[^/]+)\//);
  return match ? match[1] : null;
}

/**
 * Increment version semver
 */
function incrementVersion(version, increment = 'patch') {
  const parts = version.split('.');
  let [major, minor, patch] = parts.map(p => parseInt(p, 10) || 0);

  if (increment === 'major') {
    major++;
    minor = 0;
    patch = 0;
  } else if (increment === 'minor') {
    minor++;
    patch = 0;
  } else {
    patch++;
  }

  return `${major}.${minor}.${patch}`;
}

/**
 * Create SSF (Signed Snapshot Format) tarball
 */
async function createSSFTarball(skillPath, outputPath) {
  // List of files to include in the package
  const files = [];
  
  try {
    const entries = await readdir(skillPath);
    for (const entry of entries) {
      // Skip .git directory and node_modules
      if (entry === '.git' || entry === 'node_modules') continue;
      
      const fullPath = join(skillPath, entry);
      const stats = await stat(fullPath);
      
      if (stats.isDirectory()) {
        // For directories, we'll include all contents
        files.push(entry);
      } else {
        files.push(entry);
      }
    }
  } catch (error) {
    throw new Error(`Failed to list skill directory: ${error.message}`);
  }

  // Create tarball
  await tar.create({
    file: outputPath,
    cwd: skillPath,
    gzip: true
  }, files.length > 0 ? files : ['.']);

  return outputPath;
}

/**
 * Sign data with Ed25519
 */
function signData(data, secretKey) {
  const dataBytes = Buffer.from(data, 'utf-8');
  const signature = nacl.sign.detached(dataBytes, secretKey);
  return Buffer.from(signature).toString('base64');
}

/**
 * Scan workspace for skills (directories with gitlobster.json)
 */
async function scanWorkspaceSkills(workspacePath) {
  const skills = [];
  
  if (!await fileExists(workspacePath)) {
    return skills;
  }

  const entries = await readdir(workspacePath);
  
  for (const entry of entries) {
    const fullPath = join(workspacePath, entry);
    
    if (!await isDirectory(fullPath)) continue;
    if (entry === '.git' || entry === 'node_modules') continue;
    
    const configPath = join(fullPath, CONFIG_FILE);
    if (await fileExists(configPath)) {
      try {
        const configContent = await readFile(configPath, 'utf-8');
        const config = JSON.parse(configContent);
        skills.push({
          name: config.name,
          version: config.version,
          path: fullPath,
          config
        });
      } catch (error) {
        // Skip invalid configs
      }
    }
  }

  return skills;
}

/**
 * Get list of skills from registry for authenticated agent
 */
async function getRegistrySkills(registryUrl, jwtToken) {
  const response = await fetch(`${registryUrl}/v1/agent/skills`, {
    headers: {
      'Authorization': `Bearer ${jwtToken}`
    }
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Authentication failed. Please check your key file.');
    }
    throw new Error(`Failed to fetch registry skills: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Push command - Scan local skills and publish to registry
 */
export async function syncPushCommand(workspacePath, options) {
  const spinner = ora('Starting sync push').start();
  
  try {
    const workspace = resolvePath(workspacePath || DEFAULT_WORKSPACE);
    const registryUrl = options.registry || DEFAULT_REGISTRY;
    const keyPath = options.key || DEFAULT_KEY_PATH;
    const increment = options.increment || 'patch';

    // Verify git is available
    if (!git.checkGitAvailable()) {
      throw new Error('Git is not available.');
    }

    spinner.text = 'Scanning workspace for skills...';
    const localSkills = await scanWorkspaceSkills(workspace);
    
    if (localSkills.length === 0) {
      spinner.succeed('No skills found in workspace');
      console.log(chalk.yellow('\nNo skills with gitlobster.json found in the workspace.'));
      console.log(chalk.dim('Run gitlobster init to create a new skill.'));
      return;
    }

    spinner.succeed(`Found ${localSkills.length} skill(s) in workspace`);

    // Get scope from first skill
    const scope = extractScope(localSkills[0].name);
    if (!scope) {
      throw new Error('Could not determine agent scope from skill name. Skills must be scoped (e.g., @agent/skill).');
    }

    // Generate JWT for authentication
    spinner.text = 'Generating authentication token...';
    const jwtToken = await generateJWT(scope, keyPath);
    spinner.succeed('Authentication token ready');

    let pushedCount = 0;
    let failedCount = 0;

    for (const skill of localSkills) {
      const skillSpinner = ora(`Processing ${skill.name}`).start();

      try {
        // Step 1: Increment version
        const newVersion = incrementVersion(skill.version, increment);
        skillSpinner.text = `Incrementing version ${skill.version} → ${newVersion}`;

        // Update gitlobster.json with new version
        skill.config.version = newVersion;
        await writeFile(
          join(skill.path, CONFIG_FILE),
          JSON.stringify(skill.config, null, 2),
          'utf-8'
        );
        skillSpinner.succeed(`Version bumped to ${newVersion}`);

        // Step 2: Commit changes locally
        const commitSpinner = ora('Committing changes').start();
        
        const addResult = git.addFiles(['.'], { cwd: skill.path });
        if (!addResult.success) {
          throw new Error(`Failed to add files: ${addResult.message}`);
        }

        const commitResult = git.commit(
          `Bump version to ${newVersion}`,
          skill.config.author,
          { cwd: skill.path }
        );

        if (!commitResult.success && !commitResult.message.includes('nothing to commit')) {
          throw new Error(`Failed to commit: ${commitResult.message}`);
        }
        commitSpinner.succeed('Changes committed');

        // Step 3: Push to remote (which triggers registry publish via post-receive hook)
        const pushSpinner = ora('Pushing to registry').start();
        
        const currentBranch = git.getCurrentBranch({ cwd: skill.path });
        const remoteUrl = git.getRemoteUrl('origin', { cwd: skill.path });

        if (!remoteUrl) {
          throw new Error('No remote "origin" configured.');
        }

        const pushResult = git.push('origin', currentBranch || 'main', { cwd: skill.path });
        if (!pushResult.success) {
          throw new Error(`Failed to push: ${pushResult.message}`);
        }
        
        pushSpinner.succeed(chalk.green(`Published ${skill.name}@${newVersion}`));
        pushedCount++;

      } catch (error) {
        skillSpinner.fail(chalk.red(`Failed: ${error.message}`));
        failedCount++;
      }
    }

    // Summary
    console.log('\n' + chalk.bold('Sync Push Summary:'));
    console.log(`  ${chalk.green('✓')} Published: ${pushedCount}`);
    if (failedCount > 0) {
      console.log(`  ${chalk.red('✗')} Failed: ${failedCount}`);
    }

  } catch (error) {
    spinner.fail(chalk.red('Sync push failed'));
    console.error(`\n${chalk.red('Error:')} ${error.message}`);
    process.exit(1);
  }
}

/**
 * Pull command - Download skills from registry to local workspace
 */
export async function syncPullCommand(workspacePath, options) {
  const spinner = ora('Starting sync pull').start();
  
  try {
    const workspace = resolvePath(workspacePath || DEFAULT_WORKSPACE);
    const registryUrl = options.registry || DEFAULT_REGISTRY;
    const keyPath = options.key || DEFAULT_KEY_PATH;
    const force = options.force || false;

    // Determine scope from local config or prompt
    let scope = options.scope || null;
    
    if (!scope) {
      // Try to read from local gitlobster.json
      const localConfigPath = resolve(workspace, CONFIG_FILE);
      if (await fileExists(localConfigPath)) {
        const config = JSON.parse(await readFile(localConfigPath, 'utf-8'));
        scope = extractScope(config.name);
      }
    }

    if (!scope) {
      throw new Error('Could not determine agent scope. Use --scope option or ensure workspace has a gitlobster.json.');
    }

    // Generate JWT
    spinner.text = 'Generating authentication token...';
    const jwtToken = await generateJWT(scope, keyPath);
    spinner.succeed('Authentication token ready');

    // Fetch skills from registry
    spinner.text = 'Fetching skills from registry...';
    const registryData = await getRegistrySkills(registryUrl, jwtToken);
    const registrySkills = registryData.skills || [];
    
    if (registrySkills.length === 0) {
      spinner.succeed('No skills found in registry');
      console.log(chalk.yellow('\nNo skills found in registry for ') + chalk.cyan(scope));
      return;
    }

    spinner.succeed(`Found ${registrySkills.length} skill(s) in registry`);

    // Ensure workspace directory exists
    await mkdir(workspace, { recursive: true });

    let pulledCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const skill of registrySkills) {
      const skillSpinner = ora(`Downloading ${skill.name}`).start();
      
      try {
        const skillPath = resolve(workspace, skill.name.split('/')[1]);
        
        // Check if already exists
        if (await isDirectory(skillPath) && !force) {
          skillSpinner.warn(`Already exists (use --force to overwrite)`);
          skippedCount++;
          continue;
        }

        // Get clone URL
        const cloneUrl = `${registryUrl}/git/${skill.name}.git`;
        
        // Remove existing directory if force
        if (force && await isDirectory(skillPath)) {
          await rm(skillPath, { recursive: true, force: true });
        }

        // Clone repository
        try {
          execSync(`git clone --depth 1 "${cloneUrl}" "${skillPath}"`, {
            stdio: 'pipe',
            encoding: 'utf-8'
          });
        } catch (gitError) {
          throw new Error(`Failed to clone: ${gitError.message}`);
        }

        // Checkout specific version tag if available
        if (skill.version) {
          const tagName = `v${skill.version}`;
          try {
            execSync(`git checkout ${tagName}`, { cwd: skillPath, stdio: 'pipe' });
          } catch {
            // Tag might not exist, stay on default branch
          }
        }

        skillSpinner.succeed(chalk.green(`Downloaded ${skill.name}@${skill.version || 'latest'}`));
        pulledCount++;

      } catch (error) {
        skillSpinner.fail(chalk.red(`Failed: ${error.message}`));
        failedCount++;
      }
    }

    // Summary
    console.log('\n' + chalk.bold('Sync Pull Summary:'));
    console.log(`  ${chalk.green('✓')} Downloaded: ${pulledCount}`);
    console.log(`  ${chalk.yellow('○')} Skipped: ${skippedCount}`);
    if (failedCount > 0) {
      console.log(`  ${chalk.red('✗')} Failed: ${failedCount}`);
    }

  } catch (error) {
    spinner.fail(chalk.red('Sync pull failed'));
    console.error(`\n${chalk.red('Error:')} ${error.message}`);
    process.exit(1);
  }
}

/**
 * List command - Show skills in registry for authenticated agent
 */
export async function syncListCommand(options) {
  try {
    const registryUrl = options.registry || DEFAULT_REGISTRY;
    const keyPath = options.key || DEFAULT_KEY_PATH;

    // Determine scope
    let scope = options.scope || null;
    
    if (!scope) {
      // Try to read from local workspace
      const workspace = resolvePath(DEFAULT_WORKSPACE);
      const localConfigPath = resolve(workspace, CONFIG_FILE);
      if (await fileExists(localConfigPath)) {
        const config = JSON.parse(await readFile(localConfigPath, 'utf-8'));
        scope = extractScope(config.name);
      }
    }

    if (!scope) {
      throw new Error('Could not determine agent scope. Use --scope option or ensure workspace has a gitlobster.json.');
    }

    const spinner = ora('Fetching skills from registry').start();

    // Generate JWT
    const jwtToken = await generateJWT(scope, keyPath);
    
    // Fetch skills
    const registryData = await getRegistrySkills(registryUrl, jwtToken);
    const skills = registryData.skills || [];
    
    spinner.succeed(`Found ${skills.length} skill(s)`);

    if (skills.length === 0) {
      console.log(chalk.yellow(`\nNo skills found in registry for ${scope}`));
      return;
    }

    // Display skills table
    console.log(chalk.bold(`\nSkills in registry for ${chalk.cyan(scope)}:\n`));
    console.log(chalk.dim('─'.repeat(70)));
    
    for (const skill of skills) {
      const name = chalk.cyan(skill.name);
      const version = chalk.green(`v${skill.version || 'unknown'}`);
      const published = skill.publishedAt 
        ? chalk.gray(new Date(skill.publishedAt).toLocaleDateString())
        : chalk.gray('N/A');
      
      console.log(`  ${name}  ${version}  ${published}`);
      
      if (skill.description) {
        console.log(chalk.dim(`    ${skill.description}`));
      }
    }
    
    console.log(chalk.dim('─'.repeat(70)));
    console.log(chalk.dim(`\nTotal: ${skills.length} skill(s)\n`));

  } catch (error) {
    console.error(chalk.red('Sync list failed:'), error.message);
    process.exit(1);
  }
}

/**
 * Status command - Compare local vs registry skills
 */
export async function syncStatusCommand(workspacePath, options) {
  const spinner = ora('Checking sync status').start();
  
  try {
    const workspace = resolvePath(workspacePath || DEFAULT_WORKSPACE);
    const registryUrl = options.registry || DEFAULT_REGISTRY;
    const keyPath = options.key || DEFAULT_KEY_PATH;

    // Determine scope
    let scope = options.scope || null;
    
    if (!scope) {
      const localConfigPath = resolve(workspace, CONFIG_FILE);
      if (await fileExists(localConfigPath)) {
        const config = JSON.parse(await readFile(localConfigPath, 'utf-8'));
        scope = extractScope(config.name);
      }
    }

    if (!scope) {
      throw new Error('Could not determine agent scope. Use --scope option or ensure workspace has a gitlobster.json.');
    }

    // Get local skills
    spinner.text = 'Scanning local workspace...';
    const localSkills = await scanWorkspaceSkills(workspace);
    spinner.text = 'Querying registry...';

    // Generate JWT and fetch registry skills
    const jwtToken = await generateJWT(scope, keyPath);
    const registryData = await getRegistrySkills(registryUrl, jwtToken);
    const registrySkills = registryData.skills || [];

    spinner.succeed('Status retrieved');

    // Build maps for comparison
    const localMap = new Map(localSkills.map(s => [s.name, s]));
    const registryMap = new Map(registrySkills.map(s => [s.name, s]));

    // Determine differences
    const inCloudOnly = []; // In registry but not local
    const inLocalOnly = []; // In local but not registry
    const different = []; // Both exist but versions differ

    // Check registry skills
    for (const [name, regSkill] of registryMap) {
      if (!localMap.has(name)) {
        inCloudOnly.push(regSkill);
      } else {
        const locSkill = localMap.get(name);
        if (locSkill.version !== regSkill.version) {
          different.push({
            name,
            localVersion: locSkill.version,
            registryVersion: regSkill.version,
            path: locSkill.path
          });
        }
      }
    }

    // Check local skills
    for (const [name, locSkill] of localMap) {
      if (!registryMap.has(name)) {
        inLocalOnly.push(locSkill);
      }
    }

    // Display results
    console.log(chalk.bold('\nSync Status Report\n'));
    
    // In cloud only
    if (inCloudOnly.length > 0) {
      console.log(chalk.cyan('📦 In Registry Only:'));
      console.log(chalk.dim('─'.repeat(50)));
      for (const skill of inCloudOnly) {
        console.log(`  ${chalk.cyan(skill.name)} ${chalk.green(`v${skill.version}`)}`);
      }
      console.log();
    }

    // In local only
    if (inLocalOnly.length > 0) {
      console.log(chalk.yellow('📁 Local Only (not published):'));
      console.log(chalk.dim('─'.repeat(50)));
      for (const skill of inLocalOnly) {
        console.log(`  ${chalk.cyan(skill.name)} ${chalk.gray(`v${skill.version}`)}`);
      }
      console.log();
    }

    // Different versions
    if (different.length > 0) {
      console.log(chalk.red('🔄 Version Mismatch:'));
      console.log(chalk.dim('─'.repeat(50)));
      for (const diff of different) {
        console.log(`  ${chalk.cyan(diff.name)}`);
        console.log(`    Local:     ${chalk.gray(diff.localVersion)}`);
        console.log(`    Registry:  ${chalk.green(diff.registryVersion)}`);
      }
      console.log();
    }

    // Summary
    if (inCloudOnly.length === 0 && inLocalOnly.length === 0 && different.length === 0) {
      console.log(chalk.green('✓ All skills are in sync!'));
    } else {
      console.log(chalk.bold('Summary:'));
      if (inCloudOnly.length > 0) {
        console.log(`  ${chalk.cyan('Pull available:')} ${inCloudOnly.length}`);
      }
      if (inLocalOnly.length > 0) {
        console.log(`  ${chalk.yellow('Push needed:')} ${inLocalOnly.length}`);
      }
      if (different.length > 0) {
        console.log(`  ${chalk.red('Update needed:')} ${different.length}`);
      }
    }

    console.log();

  } catch (error) {
    spinner.fail(chalk.red('Sync status failed'));
    console.error(`\n${chalk.red('Error:')} ${error.message}`);
    process.exit(1);
  }
}

/**
 * Main sync command dispatcher
 */
export async function syncCommand(subcommand, args, options) {
  // Handle sync with no subcommand (show help)
  if (!subcommand) {
    console.log('Usage: gitlobster sync <subcommand> [options]');
    console.log('\nSubcommands:');
    console.log('  push    Push local skills to registry');
    console.log('  pull    Pull skills from registry to local workspace');
    console.log('  list    List skills in registry for authenticated agent');
    console.log('  status  Compare local vs registry skills');
    console.log('\nOptions:');
    console.log('  -r, --registry <url>  Registry URL');
    console.log('  -k, --key <path>      Path to Ed25519 private key');
    console.log('  --scope <scope>       Agent scope (e.g., @myagent)');
    return;
  }

  switch (subcommand) {
    case 'push':
      await syncPushCommand(args[0], options);
      break;
    case 'pull':
      await syncPullCommand(args[0], options);
      break;
    case 'list':
      await syncListCommand(options);
      break;
    case 'status':
      await syncStatusCommand(args[0], options);
      break;
    default:
      console.error(chalk.red(`Unknown subcommand: ${subcommand}`));
      console.log('Run gitlobster sync without arguments to see available subcommands.');
      process.exit(1);
  }
}
