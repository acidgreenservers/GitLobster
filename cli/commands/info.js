/**
 * Info Command
 * Display detailed information about a package
 */

import chalk from 'chalk';
import { AgentGitClient } from '@agentgit/client-sdk';

export async function infoCommand(packageName, options) {
  try {
    const client = new AgentGitClient({ registryUrl: options.registry });
    const metadata = await client.getPackageMetadata(packageName);

    console.log('\n' + chalk.cyan.bold(metadata.name) + chalk.dim(` v${metadata.latest}`));
    console.log(chalk.dim('─'.repeat(60)));

    console.log(`\n${chalk.bold('Description:')}`);
    console.log(`  ${metadata.description}`);

    console.log(`\n${chalk.bold('Author:')}`);
    console.log(`  ${metadata.author.name}`);
    console.log(`  ${chalk.dim(metadata.author.url)}`);

    console.log(`\n${chalk.bold('Versions:')}`);
    console.log(`  ${metadata.versions.join(', ')}`);

    console.log(`\n${chalk.bold('License:')}`);
    console.log(`  ${metadata.license}`);

    if (metadata.repository) {
      console.log(`\n${chalk.bold('Repository:')}`);
      console.log(`  ${chalk.cyan(metadata.repository)}`);
    }

    console.log(`\n${chalk.bold('Published:')}`);
    console.log(`  ${new Date(metadata.createdAt).toLocaleDateString()}`);

    console.log(`\n${chalk.bold('Last Updated:')}`);
    console.log(`  ${new Date(metadata.updatedAt).toLocaleDateString()}`);

    console.log(`\n${chalk.dim('Install:')} ${chalk.white(`agentgit install ${packageName}`)}\n`);

  } catch (error) {
    console.error(chalk.red('Failed to fetch package info:'), error.message);
    process.exit(1);
  }
}
