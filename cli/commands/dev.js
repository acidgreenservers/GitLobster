/**
 * Development Server Command
 * Local development server with hot-reloading for skill testing
 *
 * Architecture:
 * - Single source-of-truth server script written to `<skillPath>/.gitlobster-dev/server.mjs`
 * - Static UI written to `<skillPath>/.gitlobster-dev/index.html`
 * - File watcher managed via a { current } ref to avoid closure-capture bug
 * - Server readiness detected via stdout pattern (with fallback timeout)
 */

import { readFile, writeFile, mkdir, watch } from "fs/promises";
import { existsSync } from "fs";
import { resolve, join } from "path";
import { execFileSync, spawn } from "child_process";
import ora from "ora";
import chalk from "chalk";

/** Directory inside the skill where dev-server artefacts are written */
const DEV_DIR = ".gitlobster-dev";

/**
 * Check if a command exists in PATH using execFileSync (no shell injection)
 * @param {string} command
 * @returns {boolean}
 */
function commandExists(command) {
  try {
    execFileSync("which", [command], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Write the static HTML UI for the skill dev server
 * @param {string} devDir
 * @param {object} manifest
 */
async function writeDevUI(devDir, manifest) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${manifest.name} — GitLobster Dev</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; background: #0f0f13; color: #e2e8f0; min-height: 100vh; padding: 2rem; }
    header { border-bottom: 1px solid #2d3748; padding-bottom: 1rem; margin-bottom: 1.5rem; }
    h1 { font-size: 1.5rem; color: #a78bfa; }
    h2 { font-size: 1rem; color: #818cf8; margin-bottom: 0.75rem; }
    .badge { display: inline-block; background: #1e1b4b; color: #a78bfa; border: 1px solid #4c1d95; border-radius: 4px; padding: 0.2rem 0.5rem; font-size: 0.8rem; margin-left: 0.5rem; }
    .card { background: #1a1a2e; border: 1px solid #2d3748; border-radius: 8px; padding: 1.25rem; margin-bottom: 1.25rem; }
    pre { background: #111827; border-radius: 6px; padding: 1rem; overflow-x: auto; font-size: 0.85rem; color: #34d399; }
    textarea { width: 100%; min-height: 100px; background: #111827; color: #e2e8f0; border: 1px solid #374151; border-radius: 6px; padding: 0.75rem; font-family: monospace; font-size: 0.875rem; resize: vertical; }
    button { background: #7c3aed; color: white; border: none; padding: 0.6rem 1.4rem; border-radius: 6px; cursor: pointer; font-size: 0.9rem; transition: background 0.2s; }
    button:hover { background: #6d28d9; }
    .result { margin-top: 1rem; }
    .error { color: #f87171; }
  </style>
</head>
<body>
  <header>
    <h1>${manifest.name} <span class="badge">v${manifest.version}</span></h1>
    <p style="color:#94a3b8;margin-top:.5rem">${manifest.description || ""}</p>
  </header>

  <div class="card">
    <h2>Skill Manifest</h2>
    <pre id="manifest-data">Loading…</pre>
  </div>

  <div class="card">
    <h2>Test Skill Execution</h2>
    <label for="input-data" style="font-size:.85rem;color:#94a3b8">Input JSON:</label>
    <textarea id="input-data" placeholder='{"action": "test", "data": {}}'></textarea>
    <div style="margin-top:.75rem">
      <button onclick="testSkill()">Execute Skill</button>
    </div>
    <div id="result" class="result"></div>
  </div>

  <script>
    async function loadManifest() {
      try {
        const res = await fetch('/api/manifest');
        document.getElementById('manifest-data').textContent = JSON.stringify(await res.json(), null, 2);
      } catch (e) {
        document.getElementById('manifest-data').textContent = 'Failed to load manifest: ' + e.message;
      }
    }

    async function testSkill() {
      const el = document.getElementById('input-data');
      const resultEl = document.getElementById('result');
      let input;
      try { input = JSON.parse(el.value || '{}'); } catch {
        resultEl.innerHTML = '<p class="error">Invalid JSON input</p>'; return;
      }
      try {
        const res = await fetch('/api/execute', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input })
        });
        resultEl.innerHTML = '<pre>' + JSON.stringify(await res.json(), null, 2) + '</pre>';
      } catch (e) {
        resultEl.innerHTML = '<p class="error">Error: ' + e.message + '</p>';
      }
    }

    loadManifest();
  </script>
</body>
</html>`;

  await writeFile(join(devDir, "index.html"), html, "utf-8");
}

/**
 * Write the Express dev server script
 * @param {string} devDir
 * @param {string} skillPath  — parent directory (where gitlobster.json lives)
 * @param {number} port
 */
async function writeServerScript(devDir, skillPath, port) {
  const script = `import express from 'express';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// skillPath is the parent of the .gitlobster-dev dir
const SKILL_PATH = ${JSON.stringify(skillPath)};

const app = express();
const PORT = ${port};

app.use(express.static(join(SKILL_PATH, 'src')));
app.use(express.static(join(SKILL_PATH, 'public')));
app.use(express.static(__dirname)); // serves index.html

app.get('/api/manifest', async (req, res) => {
  try {
    const data = await readFile(join(SKILL_PATH, 'gitlobster.json'), 'utf-8');
    res.json(JSON.parse(data));
  } catch { res.status(500).json({ error: 'Failed to load manifest' }); }
});

app.post('/api/execute', express.json(), (req, res) => {
  const { input = {}, context = {} } = req.body;
  res.json({ success: true, output: \`Skill executed with input: \${JSON.stringify(input)}\`, context });
});

app.get('/', async (req, res) => {
  try {
    res.send(await readFile(join(__dirname, 'index.html'), 'utf-8'));
  } catch { res.status(500).send('Error loading interface'); }
});

app.listen(PORT, () => {
  // This exact string is used by the parent process to detect readiness
  console.log(\`gitlobster-dev-ready:\${PORT}\`);
});
`;
  await writeFile(join(devDir, "server.mjs"), script, "utf-8");
}

/**
 * Spawn the dev server and wait until it signals readiness on stdout.
 * @param {string} devDir
 * @param {number} port
 * @returns {Promise<import('child_process').ChildProcess>} The spawned server process
 */
function startDevServerProcess(devDir, port) {
  return new Promise((resolve, reject) => {
    const child = spawn("node", ["server.mjs"], {
      cwd: devDir,
      stdio: ["ignore", "pipe", "pipe"],
    });

    // Resolve when the server signals it's ready
    child.stdout.on("data", (data) => {
      if (data.toString().includes(`gitlobster-dev-ready:${port}`)) {
        resolve(child);
      }
    });

    child.stderr.on("data", (data) => {
      // Print stderr but don't fail — could be harmless warnings
      process.stderr.write(
        chalk.dim(`  [dev-server] ${data.toString().trim()}\n`),
      );
    });

    child.on("exit", (code) => {
      if (code !== 0) {
        reject(new Error(`Dev server exited with code ${code}`));
      }
    });

    // Safety timeout — reject if not ready within 8 seconds
    const timeout = setTimeout(() => {
      reject(new Error("Dev server failed to start within 8 seconds"));
    }, 8000);

    // Clear timeout once resolved
    child.stdout.once("data", () => clearTimeout(timeout));
  });
}

/**
 * Set up file watching for hot reload.
 * Uses a ref object ({ current }) to avoid the closure-capture mutation bug
 * where re-assigning a parameter doesn't update the outer reference.
 *
 * @param {string} skillPath
 * @param {string} devDir
 * @param {{ current: import('child_process').ChildProcess }} serverRef
 * @param {number} port
 */
async function setupFileWatcher(skillPath, devDir, serverRef, port) {
  const WATCH_EXTENSIONS = new Set([
    ".js",
    ".ts",
    ".mjs",
    ".json",
    ".html",
    ".css",
    ".md",
  ]);

  const watcher = watch(skillPath, { recursive: true });

  for await (const event of watcher) {
    const { filename } = event;
    if (!filename) continue;

    // Skip changes inside the dev dir itself (avoids infinite loop)
    if (filename.startsWith(DEV_DIR)) continue;

    const ext = filename.slice(filename.lastIndexOf("."));
    if (!WATCH_EXTENSIONS.has(ext)) continue;

    console.log(chalk.yellow(`\n  File changed: ${filename}`));
    console.log(chalk.dim("  Restarting dev server..."));

    // Kill old server
    try {
      serverRef.current.kill("SIGTERM");
    } catch {
      /* already dead */
    }

    // Restart and update the ref
    try {
      serverRef.current = await startDevServerProcess(devDir, port);
      console.log(chalk.green("  Server restarted ✓"));
    } catch (err) {
      console.error(chalk.red(`  Restart failed: ${err.message}`));
    }
  }
}

/**
 * Main dev server command
 * @param {string} skillPath - Path to skill directory (default: current dir)
 * @param {object} options
 * @param {number|string} options.port
 * @param {boolean} options.watch
 * @param {boolean} options.open
 */
export async function devServerCommand(skillPath, options) {
  const targetPath = resolve(skillPath || ".");
  const port = parseInt(options.port, 10) || 3000;
  const shouldWatch = options.watch !== false;
  const shouldOpen = options.open !== false;

  const spinner = ora("Starting development server").start();

  try {
    // Step 1: Validate skill directory
    spinner.text = "Validating skill directory...";
    const manifestPath = resolve(targetPath, "gitlobster.json");

    if (!existsSync(manifestPath)) {
      throw new Error("No gitlobster.json found. Run 'gitlobster init' first.");
    }

    let manifest;
    try {
      manifest = JSON.parse(await readFile(manifestPath, "utf-8"));
    } catch {
      throw new Error(
        "gitlobster.json could not be parsed. Ensure it is valid JSON.",
      );
    }
    spinner.succeed(`Validated skill: ${chalk.cyan(manifest.name)}`);

    // Step 2: Install dependencies if package.json exists
    const packageJsonPath = resolve(targetPath, "package.json");
    if (existsSync(packageJsonPath)) {
      spinner.text = "Installing skill dependencies...";
      try {
        // Use execFileSync with array — no shell injection
        execFileSync("npm", ["install", "--silent"], {
          cwd: targetPath,
          stdio: "pipe",
        });
        spinner.succeed("Dependencies installed");
      } catch {
        spinner.warn(
          chalk.yellow("Could not install dependencies — continuing anyway"),
        );
      }
    }

    // Step 3: Check Express is available (needed by the dev server)
    spinner.text = "Checking for Express...";
    const devDir = resolve(targetPath, DEV_DIR);
    await mkdir(devDir, { recursive: true });

    // Install express into dev dir if needed
    const expressPath = join(targetPath, "node_modules", "express");
    if (!existsSync(expressPath)) {
      spinner.text = "Installing express for dev server...";
      try {
        execFileSync(
          "npm",
          ["install", "--prefix", targetPath, "--save-dev", "express"],
          {
            stdio: "pipe",
          },
        );
      } catch {
        throw new Error(
          "express is required for the dev server. Run `npm install express` in your skill directory.",
        );
      }
    }

    // Step 4: Write server artefacts
    spinner.text = "Generating dev server files...";
    await writeDevUI(devDir, manifest);
    await writeServerScript(devDir, targetPath, port);
    spinner.succeed("Dev server configured");

    // Step 5: Start the server
    spinner.text = `Starting server on port ${port}...`;
    // serverRef allows the file watcher to replace the process safely
    const serverRef = { current: await startDevServerProcess(devDir, port) };

    spinner.succeed(
      chalk.green(`Development server running → http://localhost:${port}`),
    );
    console.log(`\n  ${chalk.cyan("Skill:")} ${manifest.name}`);
    console.log(`  ${chalk.cyan("Version:")} ${manifest.version}`);
    console.log(`  ${chalk.cyan("Path:")} ${targetPath}`);
    console.log(`\n  ${chalk.dim("Press Ctrl+C to stop")}`);
    if (shouldWatch) {
      console.log(
        `  ${chalk.dim("Hot-reload is active — file changes will restart the server")}\n`,
      );
    }

    // Step 6: Open browser
    if (shouldOpen) {
      setTimeout(() => {
        try {
          const url = `http://localhost:${port}`;
          if (process.platform === "darwin") execFileSync("open", [url]);
          else if (process.platform === "win32")
            execFileSync("cmd", ["/c", "start", url]);
          else execFileSync("xdg-open", [url]);
        } catch {
          /* Browser open failed — server is still running */
        }
      }, 500);
    }

    // Step 7: Graceful shutdown
    const shutdown = () => {
      console.log(chalk.yellow("\n  Shutting down dev server..."));
      try {
        serverRef.current.kill("SIGTERM");
      } catch {
        /* ignore */
      }
      process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    // Step 8: Start file watcher (runs indefinitely using async-iterator)
    if (shouldWatch) {
      await setupFileWatcher(targetPath, devDir, serverRef, port);
    } else {
      // No watcher — just keep alive
      await new Promise(() => {});
    }
  } catch (error) {
    spinner.fail(chalk.red("Failed to start development server"));
    console.error(`\n${chalk.red("Error:")} ${error.message}`);
    process.exit(1);
  }
}
