/**
 * Publish Command
 * Packages and publishes a skill to the registry
 */

import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { createGzip } from 'zlib';
import { create as createTar } from 'tar';
import { createHash } from 'crypto';
import ora from 'ora';
import chalk from 'chalk';
import { AgentGitClient } from '@agentgit/client-sdk';

export async function publishCommand(path, options) {
  const spinner = ora('Publishing skill package').start();

  try {
    const skillPath = resolve(path);

    // Step 1: Read and validate manifest
    spinner.text = 'Reading manifest...';
    const manifestPath = resolve(skillPath, 'manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf-8'));

    if (!manifest.name || !manifest.version) {
      throw new Error('manifest.json must include "name" and "version"');
    }

    spinner.succeed(`Manifest loaded: ${chalk.cyan(manifest.name)}@${chalk.cyan(manifest.version)}`);

    // Step 2: Create tarball
    spinner.start('Creating package tarball...');
    const tarball = await createPackageTarball(skillPath);
    const hash = createHash('sha256').update(tarball).digest('hex');

    spinner.succeed(`Package created (${formatBytes(tarball.length)}, sha256:${hash.slice(0, 8)}...)`);

    // Step 3: Sign the package
    spinner.start('Signing package...');
    const keyPath = resolve(options.key.replace(/^~/, process.env.HOME));
    const signature = await signPackage(hash, keyPath);

    spinner.succeed('Package signed');

    if (options.dryRun) {
      spinner.info('Dry run - package validated but not published');
      console.log('\nPackage details:');
      console.log(`  Name:      ${manifest.name}`);
      console.log(`  Version:   ${manifest.version}`);
      console.log(`  Size:      ${formatBytes(tarball.length)}`);
      console.log(`  Hash:      sha256:${hash}`);
      console.log(`  Signature: ${signature.slice(0, 16)}...`);
      return;
    }

    // Step 4: Publish to registry
    spinner.start(`Publishing to ${options.registry}...`);
    const client = new AgentGitClient({ registryUrl: options.registry });

    const result = await client.publish({
      name: manifest.name,
      version: manifest.version,
      tarball: tarball.toString('base64'),
      manifest,
      signature,
      hash: `sha256:${hash}`
    }, keyPath);

    spinner.succeed(chalk.green(`Published ${manifest.name}@${manifest.version}`));
    console.log(`\n  URL: ${chalk.cyan(result.url)}`);

  } catch (error) {
    spinner.fail(chalk.red('Publish failed'));
    console.error(`\n${chalk.red('Error:')} ${error.message}`);
    process.exit(1);
  }
}

async function createPackageTarball(skillPath) {
  // Create .tgz of the skill directory
  const files = [];
  const tarStream = createTar(
    { gzip: true, cwd: skillPath },
    ['.']
  );

  const chunks = [];
  for await (const chunk of tarStream) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

async function signPackage(hash, keyPath) {
  const nacl = await import('tweetnacl');
  const privateKeyRaw = await readFile(keyPath, 'utf-8');

  // Support both raw base64 (TweetNaCl format) and PEM format
  let secretKey;

  if (privateKeyRaw.trim().startsWith('-----BEGIN')) {
    // PEM format - not supported yet, throw helpful error
    throw new Error('PEM keys not supported. Please use raw base64 Ed25519 secret key (64 bytes).');
  } else {
    // Raw base64 format (TweetNaCl compatible)
    secretKey = Buffer.from(privateKeyRaw.trim(), 'base64');
  }

  if (secretKey.length !== 64) {
    throw new Error(`Invalid Ed25519 secret key length: ${secretKey.length} bytes (expected 64)`);
  }

  // Sign the hash using TweetNaCl
  const messageBytes = Buffer.from(hash, 'utf-8');
  const signature = nacl.default.sign.detached(messageBytes, secretKey);

  return `ed25519:${Buffer.from(signature).toString('base64')}`;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
