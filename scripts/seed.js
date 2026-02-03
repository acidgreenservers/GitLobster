/**
 * GitLobster Genesis Seed Script
 * Bootstraps a fresh forge with the core capability library.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const tar = require('tar');

const ROOT_DIR = path.resolve(__dirname, '..');
const STORAGE_DIR = path.join(ROOT_DIR, 'registry-server/storage');
const PACKAGES_SRC_DIR = path.join(ROOT_DIR, 'packages');

// Mock Knex setup for direct DB seeding
const db = require('../registry-server/src/db');

const GENESIS_SKILLS = [
  '@molt/memory-scraper',
  '@gemini/security-auditor',
  '@gitlobster/bridge'
];

async function seed() {
  console.log('🌱 Starting GitLobster Genesis Seed...');

  for (const pkgName of GENESIS_SKILLS) {
    const pkgDir = path.join(PACKAGES_SRC_DIR, pkgName);
    const manifestPath = path.join(pkgDir, 'manifest.json');
    
    if (!fs.existsSync(manifestPath)) {
      console.warn(`⚠️ Skipping ${pkgName}: Manifest not found.`);
      continue;
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const version = manifest.version;
    const tarballName = `${pkgName.replace(/[@\/]/g, '-')}-${version}.tgz`;
    const tarballPath = path.join(STORAGE_DIR, 'packages', pkgName, `${version}.tgz`);

    console.log(`📦 Seeding ${pkgName}@${version}...`);

    // 1. Create Tarball
    fs.mkdirSync(path.dirname(tarballPath), { recursive: true });
    await tar.c(
      {
        gzip: true,
        file: tarballPath,
        cwd: pkgDir
      },
      ['.']
    );

    // 2. Compute Hash
    const tarballBuffer = fs.readFileSync(tarballPath);
    const hash = `sha256:${crypto.createHash('sha256').update(tarballBuffer).digest('hex')}`;

    // 3. Insert Metadata
    const packageExists = await db('packages').where({ name: pkgName }).first();
    if (!packageExists) {
      await db('packages').insert({
        name: pkgName,
        description: manifest.description,
        author_name: manifest.author.name,
        author_url: manifest.author.url,
        author_public_key: 'GENESIS_KEY',
        license: manifest.license,
        category: manifest.category,
        tags: JSON.stringify(manifest.tags || []),
        downloads: 0,
        created_at: new Date(),
        updated_at: new Date()
      });
    }

    // 4. Insert Version
    await db('versions').insert({
      package_name: pkgName,
      version: version,
      storage_path: path.relative(STORAGE_DIR, tarballPath),
      hash: hash,
      signature: 'ed25519:GENESIS_SIG',
      manifest: JSON.stringify(manifest),
      published_at: new Date()
    });

    console.log(`✅ ${pkgName} is now live in the local forge.`);
  }

  console.log('\n✨ Genesis Seed Complete. Your forge is now operational.');
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Seeding failed:', err.message);
  process.exit(1);
});
