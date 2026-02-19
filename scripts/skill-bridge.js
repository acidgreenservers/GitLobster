/**
 * GitLobster Skill Bridge
 * Scans a skills/ directory and scaffolds SSF-compliant packages.
 * 
 * Generates all required files for the Signed File Manifest protocol:
 * - manifest.json (with readme and skillDoc fields)
 * - README.md (auto-generated from SKILL.md)
 * - SKILL.md (copied from source)
 * - src/index.js (stub)
 * - file_manifest.json (per-file SHA-256 hashes for integrity verification)
 */

import { readdir, readFile, mkdir, writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { createHash } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Configuration via Env Vars with generic defaults for public release
const SKILLS_DIR = process.env.OPENCLAW_SKILLS_DIR || './skills';
const OUTPUT_DIR = process.env.GITLOBSTER_PACKAGES_DIR || resolve(__dirname, '../packages');

/**
 * Generate a SHA-256 hash of a buffer/string with the "sha256:" prefix.
 */
function sha256(content) {
  return `sha256:${createHash('sha256').update(content).digest('hex')}`;
}

/**
 * Generate a README.md from SKILL.md content and metadata.
 */
function generateReadme(skillName, description, skillContent) {
  const lines = skillContent.split('\n');
  const firstParagraph = lines
    .filter(l => l.trim() && !l.startsWith('#'))
    .slice(0, 3)
    .join('\n');

  return `# ${skillName}

${description}

## Overview

${firstParagraph || 'See SKILL.md for full documentation.'}

## Installation

\`\`\`bash
# Download from GitLobster registry
# 1. Inspect the file manifest BEFORE downloading:
curl http://your-registry/v1/packages/${skillName}/latest/file-manifest

# 2. Download the tarball:
curl -O http://your-registry/v1/packages/${skillName}/latest/tarball

# 3. Extract and verify file hashes match the manifest
\`\`\`

## File Structure

\`\`\`
├── manifest.json          # Package metadata and permissions
├── README.md              # This file
├── SKILL.md               # Skill documentation for humans and agents
├── file_manifest.json     # Per-file SHA-256 hashes (integrity verification)
└── src/
    └── index.js           # Executable skill logic
\`\`\`

## Integrity Verification

This package includes a \`file_manifest.json\` with SHA-256 hashes for every file.
After downloading and extracting, verify each file's hash matches the manifest
to ensure nothing has been tampered with.

## License

MIT
`;
}

/**
 * Generate a file_manifest object with per-file SHA-256 hashes.
 * This is the core of the "Declare, Don't Extract" integrity protocol.
 */
function generateFileManifest(files) {
  const manifest = {
    format_version: '1.0',
    files: {},
    total_files: Object.keys(files).length,
    required_files_present: []
  };

  // Sort keys for deterministic output
  const sortedKeys = Object.keys(files).sort();
  for (const key of sortedKeys) {
    manifest.files[key] = sha256(files[key]);
  }

  // Check required files
  const required = ['README.md', 'SKILL.md', 'manifest.json'];
  manifest.required_files_present = required.filter(f => manifest.files[f]);

  return manifest;
}

async function bridge() {
  console.log('🦞 Starting GitLobster Skill Bridge...');
  console.log(`📂 Source: ${SKILLS_DIR}`);
  console.log(`🎯 Destination: ${OUTPUT_DIR}`);

  try {
    let skills;
    try {
      skills = await readdir(SKILLS_DIR);
    } catch (e) {
      console.error(`❌ Could not read source directory: ${SKILLS_DIR}`);
      return;
    }

    let processed = 0;

    for (const skill of skills) {
      const skillPath = join(SKILLS_DIR, skill);
      const skillMdPath = join(skillPath, 'SKILL.md');

      try {
        const skillContent = await readFile(skillMdPath, 'utf-8');
        console.log(`🔍 Processing: ${skill}`);

        // Basic Metadata Extraction
        const name = `@local/${skill}`;
        const lines = skillContent.split('\n');
        const description = lines.find(l => l.startsWith('#'))?.replace(/^#\s+/, '') || 'No description provided';

        // Create Package Directory
        const pkgPath = join(OUTPUT_DIR, `@local/${skill}`);
        await mkdir(join(pkgPath, 'src'), { recursive: true });

        // Generate README.md
        const readmeContent = generateReadme(name, description, skillContent);

        // Generate stub index.js
        const indexJs = `/**\n * Bridge for ${skill}\n */\nexport async function run(input, context) {\n  throw new Error('Logic migration pending.');\n}\n`;

        // Build manifest.json with readme and skillDoc fields
        const manifest = {
          name,
          version: '1.0.0',
          description,
          author: {
            name: 'Local Bridge',
            url: process.env.GITLOBSTER_REGISTRY || 'http://localhost:3000'
          },
          license: 'MIT',
          entry: 'src/index.js',
          runtime: 'node20',
          permissions: {
            filesystem: { read: [], write: [] },
            network: { domains: [] }
          },
          readme: readmeContent,
          skillDoc: skillContent
        };

        const manifestJson = JSON.stringify(manifest, null, 2);

        // Write all files
        await writeFile(join(pkgPath, 'manifest.json'), manifestJson);
        await writeFile(join(pkgPath, 'README.md'), readmeContent);
        await writeFile(join(pkgPath, 'SKILL.md'), skillContent);
        await writeFile(join(pkgPath, 'src/index.js'), indexJs);

        // Generate file_manifest with per-file SHA-256 hashes
        const fileContents = {
          'manifest.json': manifestJson,
          'README.md': readmeContent,
          'SKILL.md': skillContent,
          'src/index.js': indexJs
        };

        const fileManifest = generateFileManifest(fileContents);
        await writeFile(join(pkgPath, 'file_manifest.json'), JSON.stringify(fileManifest, null, 2));

        console.log(`✅ Scaffolded ${name}`);
        console.log(`   📋 Files: ${fileManifest.total_files} | Required: ${fileManifest.required_files_present.join(', ')}`);
        processed++;

      } catch (e) {
        // Skip directories without SKILL.md
      }
    }

    console.log(`\n✨ Bridge Complete. Processed ${processed} skills.`);
    console.log(`\n⚠️  Next steps:`);
    console.log(`   1. Review generated packages in ${OUTPUT_DIR}`);
    console.log(`   2. Migrate logic into src/index.js`);
    console.log(`   3. Sign file_manifest.json with your Ed25519 key before publishing`);
    console.log(`   4. Publish to your GitLobster registry`);

  } catch (err) {
    console.error('❌ Bridge failed:', err.message);
  }
}

bridge();
