/**
 * Template System Command
 * Create skill templates for common skill types
 */

import { writeFile, mkdir } from "fs/promises";
import { resolve, join } from "path";
import { existsSync } from "fs";
import ora from "ora";
import chalk from "chalk";

/**
 * Available skill templates
 */
const TEMPLATES = {
  memory: {
    name: "Memory Skill",
    description: "Skill for managing agent memory and context",
    files: {
      "gitlobster.json": {
        content: `{
  "name": "{{name}}",
  "version": "1.0.0",
  "description": "Memory management skill for GitLobster agents",
  "author": {
    "name": "{{author}}",
    "email": "{{email}}"
  },
  "permissions": {
    "filesystem": {
      "read": ["~/.gitlobster/memory/**"],
      "write": ["~/.gitlobster/memory/**"]
    },
    "env": ["GITLOBSTER_HOME"]
  },
  "dependencies": {
    "skills": {}
  }
}`,
        type: "json",
      },
      "src/index.js": {
        content: `/**
 * Memory Management Skill
 * Handles agent memory operations and context management
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { resolve, join } from 'path';

/**
 * Memory skill class
 */
export class MemorySkill {
  constructor(options = {}) {
    this.memoryPath = options.memoryPath || process.env.GITLOBSTER_HOME || '~/.gitlobster/memory';
    this.contextSize = options.contextSize || 10;
  }

  /**
   * Store memory entry
   */
  async storeMemory(key, data, metadata = {}) {
    const timestamp = new Date().toISOString();
    const entry = {
      key,
      data,
      metadata: {
        ...metadata,
        timestamp,
        version: '1.0.0'
      }
    };

    const filePath = join(this.memoryPath, key + '.json');
    await writeFile(filePath, JSON.stringify(entry, null, 2));
    return { success: true, key, timestamp };
  }

  /**
   * Retrieve memory entry
   */
  async retrieveMemory(key) {
    const filePath = join(this.memoryPath, key + '.json');
    
    try {
      const content = await readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  }

  /**
   * Get recent context
   */
  async getContext(limit = this.contextSize) {
    // Implementation for retrieving recent memory entries
    return [];
  }

  /**
   * Clear memory
   */
  async clearMemory(key) {
    const filePath = join(this.memoryPath, key + '.json');
    
    try {
      await writeFile(filePath, JSON.stringify({ entries: [] }, null, 2));
      return { success: true, key };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

/**
 * Main skill execution function
 */
export async function execute(input, context = {}) {
  const skill = new MemorySkill();
  
  const { action, key, data, metadata } = input;
  
  switch (action) {
    case 'store':
      return await skill.storeMemory(key, data, metadata);
    case 'retrieve':
      return await skill.retrieveMemory(key);
    case 'context':
      return await skill.getContext(input.limit);
    case 'clear':
      return await skill.clearMemory(key);
    default:
      return {
        success: false,
        error: 'Unknown action: ' + action
      };
  }
}`,
        type: "javascript",
      },
      "README.md": {
        content: `# {{name}}

Memory management skill for GitLobster agents.

## Description

This skill provides memory storage and retrieval capabilities for agents, allowing them to persist context and data across sessions.

## Usage

\`\`\`javascript
import { execute } from './src/index.js';

// Store memory
const result = await execute({
  action: 'store',
  key: 'user_preferences',
  data: { theme: 'dark', language: 'en' },
  metadata: { source: 'user_settings' }
});

// Retrieve memory
const memory = await execute({
  action: 'retrieve',
  key: 'user_preferences'
});
\`\`\`

## API

### Actions

- \`store\`: Store data in memory
- \`retrieve\`: Retrieve data from memory
- \`context\`: Get recent context entries
- \`clear\`: Clear memory for a key

## Permissions

This skill requires:
- Filesystem read/write access to \`~/.gitlobster/memory/**\`
- Environment variable access to \`GITLOBSTER_HOME\`
`,
        type: "markdown",
      },
    },
  },

  "web-scraper": {
    name: "Web Scraper Skill",
    description: "Skill for scraping and extracting data from websites",
    files: {
      "gitlobster.json": {
        content: `{
  "name": "{{name}}",
  "version": "1.0.0",
  "description": "Web scraping skill for extracting data from websites",
  "author": {
    "name": "{{author}}",
    "email": "{{email}}"
  },
  "permissions": {
    "network": {
      "domains": ["*"]
    },
    "filesystem": {
      "write": ["./scraped_data/**"]
    }
  },
  "dependencies": {
    "skills": {}
  }
}`,
        type: "json",
      },
      "src/index.js": {
        content: `/**
 * Web Scraper Skill
 * Extracts data from websites using various methods
 */

import { writeFile, mkdir } from 'fs/promises';
import { resolve, join } from 'path';
import { execFileSync } from 'child_process';

/**
 * Web scraper class
 */
export class WebScraper {
  constructor(options = {}) {
    this.timeout = options.timeout || 30000;
    this.userAgent = options.userAgent || 'GitLobster-Scraper/1.0';
  }

  /**
   * Scrape using curl (Security Hardened)
   */
  async scrapeWithCurl(url, options = {}) {
    try {
      const args = [
        '-s',
        '-L',
        '--user-agent', this.userAgent,
        '--connect-timeout', String(Math.floor(this.timeout / 1000)),
        '--',
        url
      ];

      const html = execFileSync('curl', args, { encoding: 'utf-8' });
      return { success: true, html, url };
    } catch (error) {
      return { success: false, error: error.message, url };
    }
  }

  /**
   * Extract data using regex
   */
  extractData(html, patterns) {
    const results = {};
    
    for (const [key, pattern] of Object.entries(patterns)) {
      const regex = new RegExp(pattern, 'gi');
      const matches = html.match(regex) || [];
      results[key] = matches;
    }
    
    return results;
  }

  /**
   * Save scraped data
   */
  async saveData(data, filename) {
    const outputPath = resolve('./scraped_data');
    await mkdir(outputPath, { recursive: true });
    
    const filePath = join(outputPath, filename);
    await writeFile(filePath, JSON.stringify(data, null, 2));
    
    return { success: true, path: filePath };
  }

  /**
   * Scrape a list of URLs
   */
  async scrapeMultiple(urls, options = {}) {
    const results = [];
    
    for (const url of urls) {
      const result = await this.scrapeWithCurl(url, options);
      results.push(result);
    }
    
    return results;
  }
}

/**
 * Main skill execution function
 */
export async function execute(input, context = {}) {
  const scraper = new WebScraper();
  
  const { action, url, urls, patterns, filename } = input;
  
  switch (action) {
    case 'scrape':
      return await scraper.scrapeWithCurl(url);
    case 'extract':
      return scraper.extractData(input.html, patterns);
    case 'save':
      return await scraper.saveData(input.data, filename);
    case 'scrapeMultiple':
      return await scraper.scrapeMultiple(urls);
    default:
      return {
        success: false,
        error: \`Unknown action: \${action}\`
      };
  }
}`,
        type: "javascript",
      },
      "README.md": {
        content: `# {{name}}

Web scraping skill for extracting data from websites.

## Description

This skill provides web scraping capabilities using curl and regex pattern matching to extract structured data from HTML content.

## Usage

\`\`\`javascript
import { execute } from './src/index.js';

// Scrape a single URL
const result = await execute({
  action: 'scrape',
  url: 'https://example.com'
});

// Extract data using patterns
const extracted = await execute({
  action: 'extract',
  html: result.html,
  patterns: {
    emails: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
    links: 'href="([^"]+)"'
  }
});

// Save scraped data
await execute({
  action: 'save',
  data: extracted,
  filename: 'scraped_data.json'
});
\`\`\`

## API

### Actions

- \`scrape\`: Scrape a single URL
- \`extract\`: Extract data using regex patterns
- \`save\`: Save data to file
- \`scrapeMultiple\`: Scrape multiple URLs

## Permissions

This skill requires:
- Network access to any domain
- Filesystem write access to \`./scraped_data/**\`
`,
        type: "markdown",
      },
    },
  },

  calculator: {
    name: "Calculator Skill",
    description: "Basic mathematical operations and calculations",
    files: {
      "gitlobster.json": {
        content: `{
  "name": "{{name}}",
  "version": "1.0.0",
  "description": "Calculator skill for mathematical operations",
  "author": {
    "name": "{{author}}",
    "email": "{{email}}"
  },
  "permissions": {},
  "dependencies": {
    "skills": {}
  }
}`,
        type: "json",
      },
      "src/index.js": {
        content: `/**
 * Calculator Skill
 * Performs mathematical calculations and operations
 */

/**
 * Calculator class
 */
export class Calculator {
  /**
   * Add numbers
   */
  add(...numbers) {
    return numbers.reduce((sum, num) => sum + num, 0);
  }

  /**
   * Subtract numbers
   */
  subtract(a, b) {
    return a - b;
  }

  /**
   * Multiply numbers
   */
  multiply(...numbers) {
    return numbers.reduce((product, num) => product * num, 1);
  }

  /**
   * Divide numbers
   */
  divide(a, b) {
    if (b === 0) {
      throw new Error('Division by zero');
    }
    return a / b;
  }

  /**
   * Calculate power
   */
  power(base, exponent) {
    return Math.pow(base, exponent);
  }

  /**
   * Calculate square root
   */
  sqrt(value) {
    if (value < 0) {
      throw new Error('Cannot calculate square root of negative number');
    }
    return Math.sqrt(value);
  }

  /**
   * Calculate factorial
   */
  factorial(n) {
    if (n < 0) return undefined;
    if (n === 0 || n === 1) return 1;
    return n * this.factorial(n - 1);
  }
}

/**
 * Main skill execution function
 */
export async function execute(input, context = {}) {
  const calc = new Calculator();
  
  const { operation, numbers, a, b, base, exponent, value, n } = input;
  
  try {
    switch (operation) {
      case 'add':
        return { success: true, result: calc.add(...numbers) };
      case 'subtract':
        return { success: true, result: calc.subtract(a, b) };
      case 'multiply':
        return { success: true, result: calc.multiply(...numbers) };
      case 'divide':
        return { success: true, result: calc.divide(a, b) };
      case 'power':
        return { success: true, result: calc.power(base, exponent) };
      case 'sqrt':
        return { success: true, result: calc.sqrt(value) };
      case 'factorial':
        return { success: true, result: calc.factorial(n) };
      default:
        return {
          success: false,
          error: \`Unknown operation: \${operation}\`
        };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}`,
        type: "javascript",
      },
      "README.md": {
        content: `# {{name}}

Calculator skill for mathematical operations.

## Description

This skill provides basic mathematical operations including addition, subtraction, multiplication, division, power, square root, and factorial calculations.

## Usage

\`\`\`javascript
import { execute } from './src/index.js';

// Addition
const result1 = await execute({
  operation: 'add',
  numbers: [1, 2, 3, 4, 5]
});

// Division
const result2 = await execute({
  operation: 'divide',
  a: 10,
  b: 2
});

// Square root
const result3 = await execute({
  operation: 'sqrt',
  value: 16
});
\`\`\`

## API

### Operations

- \`add\`: Add multiple numbers
- \`subtract\`: Subtract two numbers
- \`multiply\`: Multiply multiple numbers
- \`divide\`: Divide two numbers
- \`power\`: Calculate power (base^exponent)
- \`sqrt\`: Calculate square root
- \`factorial\`: Calculate factorial

## Permissions

This skill requires no special permissions.
`,
        type: "markdown",
      },
    },
  },
};

/**
 * Template command
 * @param {string} templateType - Type of template to create
 * @param {string} skillName - Name of the skill
 * @param {object} options - Command options
 * @param {string} options.path - Output directory (default: current directory)
 * @param {string} options.author - Author name
 * @param {string} options.email - Author email
 * @param {boolean} options.yes - Skip confirmation prompts
 */
export async function templateCommand(templateType, skillName, options) {
  const spinner = ora("Creating skill template").start();

  try {
    // Step 1: Validate template type
    if (!TEMPLATES[templateType]) {
      throw new Error(
        `Unknown template type: ${templateType}. Available templates: ${Object.keys(TEMPLATES).join(", ")}`,
      );
    }

    const template = TEMPLATES[templateType];
    spinner.succeed(`Using template: ${chalk.cyan(template.name)}`);

    // Step 2: Get author information
    let author = options.author;
    let email = options.email;

    if (!author || !email) {
      const readline = await import("readline");
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      if (!author) {
        author = await new Promise((resolve) => {
          rl.question("Author name: ", resolve);
        });
      }

      if (!email) {
        email = await new Promise((resolve) => {
          rl.question("Author email: ", resolve);
        });
      }

      rl.close();
    }

    // Step 3: Create output directory
    const outputPath = resolve(options.path || ".");
    spinner.text = `Creating directory: ${outputPath}`;

    if (existsSync(outputPath) && options.path) {
      if (!options.yes) {
        spinner.stop();
        const readline = await import("readline");
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        const answer = await new Promise((resolve) => {
          rl.question(
            chalk.yellow(
              `Directory ${outputPath} already exists. Overwrite? (y/N): `,
            ),
            (ans) => {
              rl.close();
              resolve(ans.toLowerCase().trim());
            },
          );
        });

        if (answer !== "y") {
          console.log(chalk.yellow("\nTemplate creation cancelled."));
          process.exit(0);
        }
        spinner.start();
      }
    }

    spinner.succeed("Directory ready");

    // Step 4: Generate files
    spinner.text = "Generating template files...";

    for (const [filePath, fileConfig] of Object.entries(template.files)) {
      const fullPath = resolve(outputPath, filePath);
      const dirPath = resolve(fullPath, "..");

      // Create directory if needed
      await mkdir(dirPath, { recursive: true });

      // Process template content
      let content = fileConfig.content;
      content = content.replace(/\{\{name\}\}/g, skillName);
      content = content.replace(/\{\{author\}\}/g, author);
      content = content.replace(/\{\{email\}\}/g, email);

      await writeFile(fullPath, content, "utf-8");
    }

    spinner.succeed("Template files created");

    // Step 5: Create additional directories
    spinner.text = "Creating project structure...";
    await mkdir(resolve(outputPath, "src"), { recursive: true });
    await mkdir(resolve(outputPath, "tests"), { recursive: true });
    spinner.succeed("Project structure created");

    // Final success message
    spinner.succeed(chalk.green(`Template created successfully!`));
    console.log(`\n  ${chalk.cyan("Template:")} ${template.name}`);
    console.log(`  ${chalk.cyan("Skill:")} ${chalk.green(skillName)}`);
    console.log(`  ${chalk.cyan("Path:")} ${outputPath}`);
    console.log(`  ${chalk.cyan("Description:")} ${template.description}`);
    console.log(`\n  ${chalk.dim("Next steps:")}`);
    console.log(
      `  ${chalk.dim("1.")} Customize the skill implementation in src/index.js`,
    );
    console.log(
      `  ${chalk.dim("2.")} Update gitlobster.json with your specific requirements`,
    );
    console.log(
      `  ${chalk.dim("3.")} Run ${chalk.cyan("gitlobster dev")} to start development`,
    );
    console.log(
      `  ${chalk.dim("4.")} Run ${chalk.cyan("gitlobster publish")} to publish your skill\n`,
    );
  } catch (error) {
    spinner.fail(chalk.red("Template creation failed"));
    console.error(`\n${chalk.red("Error:")} ${error.message}`);
    process.exit(1);
  }
}

/**
 * List available templates
 */
export function listTemplatesCommand() {
  console.log(chalk.bold("Available Skill Templates:\n"));

  for (const [key, template] of Object.entries(TEMPLATES)) {
    console.log(`${chalk.cyan(key)} - ${template.name}`);
    console.log(`  ${chalk.dim(template.description)}`);
    console.log();
  }

  console.log(
    `${chalk.dim("Usage: gitlobster template <type> <name> [options]")}`,
  );
  console.log(
    `${chalk.dim("Example: gitlobster template memory my-memory-skill")}`,
  );
}
