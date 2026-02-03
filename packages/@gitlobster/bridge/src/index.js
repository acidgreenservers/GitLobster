/**
 * GitLobster Skill Bridge
 * Scans OpenClaw skills/ directory and scaffolds SSF packages.
 */

import { readdir, readFile, mkdir, writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Configuration via Env Vars with generic defaults for public release
const SKILLS_DIR = process.env.OPENCLAW_SKILLS_DIR || './skills';
const OUTPUT_DIR = process.env.GITLOBSTER_PACKAGES_DIR || resolve(__dirname, '../packages');

async function bridge() {
  console.log('🦞 Starting GitLobster Bridge...');
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
    
    for (const skill of skills) {
      const skillPath = join(SKILLS_DIR, skill);
      const skillMdPath = join(skillPath, 'SKILL.md');
      
      try {
        const content = await readFile(skillMdPath, 'utf-8');
        console.log(`🔍 Processing: ${skill}`);
        
        // Basic Metadata Extraction
        const name = `@local/${skill}`;
        const lines = content.split('\n');
        const description = lines.find(l => l.startsWith('#'))?.replace(/^#\s+/, '') || 'No description provided';
        
        // Create Package Directory
        const pkgPath = join(OUTPUT_DIR, `@local/${skill}`);
        await mkdir(join(pkgPath, 'src'), { recursive: true });
        
        // Write manifest.json
        const manifest = {
          name,
          version: '1.0.0',
          description,
          author: {
            name: 'Local Bridge',
            url: 'http://localhost:3000'
          },
          license: 'MIT',
          entry: 'src/index.js',
          runtime: 'node20',
          permissions: {
            filesystem: { read: [], write: [] },
            network: { domains: [] }
          }
        };
        
        await writeFile(join(pkgPath, 'manifest.json'), JSON.stringify(manifest, null, 2));
        await writeFile(join(pkgPath, 'SKILL.md'), content);
        
        const indexJs = `/**\n * Bridge for ${skill}\n */\nexport async function run(input, context) {\n  throw new Error('Logic migration pending.');\n}\n`;
        await writeFile(join(pkgPath, 'src/index.js'), indexJs);
        
        console.log(`✅ Scaffolded ${name}`);
        
      } catch (e) {
        // Skip directories without SKILL.md
      }
    }
    
    console.log('\n✨ Bridge Complete.');
    
  } catch (err) {
    console.error('❌ Bridge failed:', err.message);
  }
}

bridge();
