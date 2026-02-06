/**
 * Search Command
 * Search for skill packages in the registry
 */

import chalk from 'chalk';
import { GitLobsterClient } from '@gitlobster/client-sdk';

export async function searchCommand(query, options) {
  try {
    const client = new GitLobsterClient({ registryUrl: options.registry });

    const results = await client.search({
      q: query,
      category: options.category,
      limit: parseInt(options.limit)
    });

    if (results.length === 0) {
      console.log(chalk.yellow(`No packages found for "${query}"`));
      return;
    }

    console.log(chalk.bold(`\nFound ${results.total} package(s):\n`));

    for (const pkg of results.results) {
      console.log(chalk.cyan.bold(pkg.name) + chalk.dim(` v${pkg.version}`));
      console.log(`  ${pkg.description}`);
      console.log(chalk.dim(`  Author: ${pkg.author.name} | Downloads: ${pkg.downloads} | Category: ${pkg.category}`));
      if (pkg.tags.length > 0) {
        console.log(chalk.dim(`  Tags: ${pkg.tags.join(', ')}`));
      }
      console.log();
    }

    console.log(chalk.dim(`Showing ${results.results.length} of ${results.total} results`));
    console.log(chalk.dim(`Install with: ${chalk.white('gitlobster install <package-name>')}\n`));

  } catch (error) {
    console.error(chalk.red('Search failed:'), error.message);
    process.exit(1);
  }
}
