/**
 * Install Command
 * Downloads, verifies, and installs a skill package
 */

import { mkdir, writeFile } from 'fs/promises';
import { resolve } from 'path';
import { extract } from 'tar';
import { createHash } from 'crypto';
import ora from 'ora';
import chalk from 'chalk';
import { GitLobsterClient } from '@gitlobster/client-sdk';

export async function installCommand(packageName, options) {
  const spinner = ora(`Installing ${packageName}`).start();

  try {
    const client = new GitLobsterClient({ registryUrl: options.registry });
    const destPath = resolve(options.destination.replace(/^~/, process.env.HOME));

    // Step 1: Fetch package metadata
    spinner.text = 'Fetching package metadata...';
    const metadata = await client.getPackageMetadata(packageName);

    const version = options.version === 'latest' ? metadata.latest : options.version;

    if (!metadata.versions.includes(version)) {
      throw new Error(`Version ${version} not found. Available: ${metadata.versions.join(', ')}`);
    }

    spinner.succeed(`Found ${chalk.cyan(packageName)}@${chalk.cyan(version)}`);

    // Step 2: Fetch manifest
    spinner.start('Fetching manifest...');
    const manifest = await client.getManifest(packageName, version);

    // Step 3: Display permissions and get approval
    if (!options.yes) {
      spinner.stop();
      console.log('\n' + chalk.yellow('⚠ Permission Review Required'));
      console.log(`\nPackage: ${chalk.cyan(packageName)}@${version}`);
      console.log(`Author:  ${manifest.author.name} (${manifest.author.url})`);

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
        console.log(`  Domains: ${manifest.permissions.network.domains.join(', ')}`);
      }

      if (manifest.permissions.env) {
        console.log('\n' + chalk.bold('Environment Variables:'));
        console.log(`  ${manifest.permissions.env.join(', ')}`);
      }

      // In a real implementation, we'd prompt for confirmation here
      // For now, we'll just show the permissions
      console.log('\n' + chalk.dim('(Use --yes to skip this prompt)\n'));
      spinner.start();
    }

    // Step 4: Download package
    spinner.text = 'Downloading package...';
    const { tarball, hash, signature } = await client.downloadPackage(packageName, version);

    spinner.succeed(`Downloaded package (${formatBytes(tarball.length)})`);

    // Step 5: Verify hash
    spinner.start('Verifying package integrity...');
    const computedHash = `sha256:${createHash('sha256').update(tarball).digest('hex')}`;

    if (computedHash !== hash) {
      throw new Error(`Hash mismatch! Expected ${hash}, got ${computedHash}`);
    }

    spinner.succeed('Package integrity verified');

    // Step 6: Verify signature
    spinner.start('Verifying signature...');
    const isValid = await verifySignature(hash, signature, manifest.author.publicKey);

    if (!isValid) {
      throw new Error('Invalid package signature!');
    }

    spinner.succeed('Signature verified');

    // Step 7: Extract package
    spinner.start('Installing package...');
    const installPath = resolve(destPath, packageName);
    await mkdir(installPath, { recursive: true });

    const os = await import('os');
    const tempFile = resolve(os.tmpdir(), `gitlobster-${Date.now()}.tgz`);
    await writeFile(tempFile, tarball);

    await extract({
      file: tempFile,
      cwd: installPath,
      strip: 1
    });

    const { unlink } = await import('fs/promises');
    await unlink(tempFile).catch(() => { });

    spinner.succeed(chalk.green(`Installed ${packageName}@${version}`));
    console.log(`\n  Location: ${chalk.cyan(installPath)}`);

    // Step 8: Check dependencies
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

async function verifySignature(hash, signature, publicKey) {
  const nacl = (await import('tweetnacl')).default;

  try {
    const sigValue = signature.replace(/^ed25519:/, '');
    const sigBytes = Buffer.from(sigValue, 'base64');
    const pubKeyBytes = Buffer.from(publicKey, 'base64');
    const hashValue = hash.replace(/^sha256:/, '');
    const messageBytes = Buffer.from(hashValue, 'utf8');

    return nacl.sign.detached.verify(
      messageBytes,
      sigBytes,
      pubKeyBytes
    );
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
