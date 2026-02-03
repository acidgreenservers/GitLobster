#!/usr/bin/env node

/**
 * Agent Git CLI
 * Commands: publish, install, search, info
 */

import { Command } from 'commander';
import { publishCommand } from '../commands/publish.js';
import { installCommand } from '../commands/install.js';
import { searchCommand } from '../commands/search.js';
import { infoCommand } from '../commands/info.js';

const program = new Command();

program
  .name('agentgit')
  .description('Agent Git - Skill package manager for autonomous agents')
  .version('0.1.0');

// agentgit publish [path]
program
  .command('publish')
  .description('Publish a skill package to the registry')
  .argument('[path]', 'Path to skill directory', '.')
  .option('-r, --registry <url>', 'Registry URL', process.env.AGENTGIT_REGISTRY || 'http://localhost:3000')
  .option('-k, --key <path>', 'Path to Ed25519 private key', '~/.ssh/agentgit_ed25519')
  .option('--dry-run', 'Validate package without publishing')
  .action(publishCommand);

// agentgit install <package>
program
  .command('install')
  .description('Install a skill package')
  .argument('<package>', 'Package name (e.g., @molt/memory-scraper)')
  .option('-v, --version <version>', 'Specific version to install', 'latest')
  .option('-r, --registry <url>', 'Registry URL', process.env.AGENTGIT_REGISTRY || 'http://localhost:3000')
  .option('-d, --destination <path>', 'Installation directory', '~/.agentgit/skills')
  .option('-y, --yes', 'Skip permission approval prompt')
  .action(installCommand);

// agentgit search <query>
program
  .command('search')
  .description('Search for skill packages')
  .argument('<query>', 'Search query')
  .option('-r, --registry <url>', 'Registry URL', process.env.AGENTGIT_REGISTRY || 'http://localhost:3000')
  .option('-c, --category <category>', 'Filter by category')
  .option('-l, --limit <number>', 'Number of results', '20')
  .action(searchCommand);

// agentgit info <package>
program
  .command('info')
  .description('Show package information')
  .argument('<package>', 'Package name')
  .option('-r, --registry <url>', 'Registry URL', process.env.AGENTGIT_REGISTRY || 'http://localhost:3000')
  .action(infoCommand);

program.parse();
