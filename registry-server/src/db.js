const knex = require('knex');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const cp = require('child_process');

const DB_PATH = process.env.GITLOBSTER_STORAGE_DIR
  ? path.resolve(process.env.GITLOBSTER_STORAGE_DIR, process.env.GITLOBSTER_DB_FILE || 'registry.sqlite')
  : path.join(__dirname, '../storage/registry.sqlite');

// Database configuration
const db = knex({
  client: 'sqlite3',
  connection: {
    filename: DB_PATH
  },
  useNullAsDefault: true
});

// Initialize Schema
async function init() {
  const hasPackages = await db.schema.hasTable('packages');

  if (!hasPackages) {
    console.log('🚧 Initializing Database Schema...');

    // Table: packages (Metadata)
    await db.schema.createTable('packages', (table) => {
      table.string('name').primary(); // @scope/name
      table.string('description');
      table.string('author_name');
      table.string('author_url');
      table.string('author_public_key');
      table.string('license');
      table.string('category');
      table.json('tags'); // JSON array of tags
      table.integer('downloads').defaultTo(0);
      table.timestamp('created_at').defaultTo(db.fn.now());
      table.timestamp('updated_at').defaultTo(db.fn.now());
    });

    // Table: versions (Specific releases)
    await db.schema.createTable('versions', (table) => {
      table.increments('id');
      table.string('package_name').references('packages.name');
      table.string('version'); // 1.0.0
      table.string('storage_path'); // relative path to .tgz
      table.string('hash'); // sha256
      table.string('signature'); // ed25519
      table.json('manifest'); // Full manifest cache
      table.timestamp('published_at').defaultTo(db.fn.now());

      table.unique(['package_name', 'version']);
    });

    // Table: maintainers (Access control - Future proofing)
    await db.schema.createTable('maintainers', (table) => {
      table.increments('id');
      table.string('package_name').references('packages.name');
      table.string('public_key'); // Ed25519 public key
      table.string('role').defaultTo('owner'); // owner, maintainer
    });

    // Table: agents (The Social Profile)
    await db.schema.createTable('agents', (table) => {
      table.string('name').primary(); // e.g. @molt
      table.string('public_key');
      table.string('bio');
      table.string('human_facilitator'); // The Human Anchor
      table.json('metadata'); // coding intrests, social stuff
      table.timestamp('joined_at').defaultTo(db.fn.now());
    });

    // Table: endorsements (The Web of Trust)
    await db.schema.createTable('endorsements', (table) => {
      table.increments('id');
      table.string('package_name').references('packages.name');
      table.string('signer_name'); // Who is endorsing
      table.string('signer_type').defaultTo('agent'); // agent or human
      table.string('comment'); // Pattern feedback
      table.string('signature'); // Ed25519 signature of the comment + package hash
      table.integer('trust_level').defaultTo(1);
      table.timestamp('created_at').defaultTo(db.fn.now());
    });

    // Table: identity_keys (Cryptographic Identity Tracking)
    await db.schema.createTable('identity_keys', (table) => {
      table.increments('id');
      table.string('agent_name').references('agents.name');
      table.string('public_key').unique(); // Ed25519 public key
      table.string('key_fingerprint').unique(); // First 12 chars of key
      table.timestamp('first_seen').defaultTo(db.fn.now());
      table.timestamp('last_used').defaultTo(db.fn.now());
      table.boolean('is_active').defaultTo(true);
      table.string('revocation_reason'); // If key was revoked
      table.string('revocation_signature'); // Signed revocation
    });

    // Table: trust_score_components (Decomposed Trust Metrics)
    await db.schema.createTable('trust_score_components', (table) => {
      table.string('agent_name').primary().references('agents.name');
      table.float('capability_reliability').defaultTo(0.5); // 0.0 to 1.0
      table.float('review_consistency').defaultTo(0.5);
      table.float('flag_history_score').defaultTo(1.0); // 1.0 = no flags
      table.float('trust_anchor_overlap').defaultTo(0.0); // How many anchors trust this agent
      table.float('time_in_network').defaultTo(0.0); // Days active
      table.float('computed_score').defaultTo(0.5); // Weighted combination
      table.timestamp('last_computed').defaultTo(db.fn.now());
    });

    // Table: agent_activity_log (For time-in-network calculation)
    await db.schema.createTable('agent_activity_log', (table) => {
      table.increments('id');
      table.string('agent_name').references('agents.name');
      table.string('activity_type'); // 'publish', 'endorse', 'flag'
      table.string('target'); // What they acted on
      table.timestamp('timestamp').defaultTo(db.fn.now());
    });

    // Table: stars (Package favorites tracking)
    await db.schema.createTable('stars', (table) => {
      table.increments('id');
      table.string('agent_name').references('agents.name');
      table.string('package_name').references('packages.name');
      table.timestamp('starred_at').defaultTo(db.fn.now());
      table.unique(['agent_name', 'package_name']); // Prevent duplicate stars
    });

    // Table: forks (Package fork relationships)
    await db.schema.createTable('forks', (table) => {
      table.increments('id');
      table.string('parent_package').references('packages.name');
      table.string('forked_package').references('packages.name');
      table.string('fork_reason');
      table.string('fork_point_version'); // Version at time of fork
      table.string('fork_point_commit').defaultTo('no_git_repo'); // Git commit if available
      table.string('forker_agent').references('agents.name'); // Who forked it
      table.string('signature'); // Ed25519 signature of fork declaration
      table.timestamp('forked_at').defaultTo(db.fn.now());
    });

    console.log('✅ Schema Initialized: packages, versions, maintainers, agents, endorsements, identity_keys, trust_score_components, agent_activity_log, stars, forks');
  }

  // Migration: Add stars column to packages if it doesn't exist
  const hasStarsColumn = await db.schema.hasColumn('packages', 'stars');
  if (!hasStarsColumn) {
    console.log('🔄 Adding stars column to packages table...');
    await db.schema.table('packages', (table) => {
      table.integer('stars').defaultTo(0);
    });
    console.log('✅ Stars column added');
  }

  // Migration: Create stars table if it doesn't exist
  const hasStarsTable = await db.schema.hasTable('stars');
  if (!hasStarsTable) {
    console.log('🔄 Creating stars table...');
    await db.schema.createTable('stars', (table) => {
      table.increments('id');
      table.string('agent_name').references('agents.name');
      table.string('package_name').references('packages.name');
      table.timestamp('starred_at').defaultTo(db.fn.now());
      table.unique(['agent_name', 'package_name']);
    });
    console.log('✅ Stars table created');
  }

  // Migration: Add is_trust_anchor column to agents if it doesn't exist
  const hasTrustAnchorColumn = await db.schema.hasColumn('agents', 'is_trust_anchor');
  if (!hasTrustAnchorColumn) {
    console.log('🔄 Adding is_trust_anchor column to agents table...');
    await db.schema.table('agents', (table) => {
      table.boolean('is_trust_anchor').defaultTo(false);
    });
    console.log('✅ is_trust_anchor column added');
  }

  // Migration: Add endorsement_type column to endorsements if it doesn't exist
  const hasEndorsementTypeColumn = await db.schema.hasColumn('endorsements', 'endorsement_type');
  if (!hasEndorsementTypeColumn) {
    console.log('🔄 Adding endorsement_type column to endorsements table...');
    await db.schema.table('endorsements', (table) => {
      table.string('endorsement_type').defaultTo('full_review'); // 'star' or 'full_review'
    });
    console.log('✅ endorsement_type column added');
  }

  // Migration: Add agent_stars column to packages if it doesn't exist
  const hasAgentStarsColumn = await db.schema.hasColumn('packages', 'agent_stars');
  if (!hasAgentStarsColumn) {
    console.log('🔄 Adding agent_stars column to packages table...');
    await db.schema.table('packages', (table) => {
      table.integer('agent_stars').defaultTo(0); // Verified agent stars only
    });
    console.log('✅ agent_stars column added');
  }

  // Migration: Create forks table if it doesn't exist
  const hasForksTable = await db.schema.hasTable('forks');
  if (!hasForksTable) {
    console.log('🔄 Creating forks table...');
    await db.schema.createTable('forks', (table) => {
      table.increments('id');
      table.string('parent_package').references('packages.name');
      table.string('forked_package').references('packages.name');
      table.string('fork_reason');
      table.string('fork_point_version');
      table.string('fork_point_commit').defaultTo('no_git_repo');
      table.string('forker_agent').references('agents.name');
      table.string('signature');
      table.timestamp('forked_at').defaultTo(db.fn.now());
    });
    console.log('✅ Forks table created');
  }

  // Migration: Create observations table if it doesn't exist
  const hasObservationsTable = await db.schema.hasTable('observations');
  if (!hasObservationsTable) {
    console.log('🔄 Creating observations table...');
    await db.schema.createTable('observations', (table) => {
      table.increments('id');
      table.string('package_name').notNullable().references('packages.name');
      table.string('observer_name').notNullable(); // Human name or agent ID
      table.string('observer_type').notNullable(); // 'human' or 'agent'
      table.text('content').notNullable(); // The observation content
      table.string('category'); // 'security', 'quality', 'compatibility', 'general'
      table.string('sentiment'); // 'positive', 'neutral', 'concern'
      table.timestamp('created_at').defaultTo(db.fn.now());
      table.string('signature'); // Optional: Agent-signed observations
    });
    console.log('✅ Observations table created');
  }

  // Migration: Add file_manifest column to versions if it doesn't exist
  const hasFileManifest = await db.schema.hasColumn('versions', 'file_manifest');
  if (!hasFileManifest) {
    console.log('🔄 Adding file_manifest column to versions table...');
    await db.schema.table('versions', (table) => {
      table.json('file_manifest'); // Signed file manifest (per-file SHA-256 hashes)
    });
    console.log('✅ file_manifest column added');
  }

  // Migration: Add manifest_signature column to versions if it doesn't exist
  const hasManifestSignature = await db.schema.hasColumn('versions', 'manifest_signature');
  if (!hasManifestSignature) {
    console.log('🔄 Adding manifest_signature column to versions table...');
    await db.schema.table('versions', (table) => {
      table.text('manifest_signature'); // Ed25519 signature of canonical file manifest
    });
    console.log('✅ manifest_signature column added');
  }

  // Migration: Create flags table if it doesn't exist
  const hasFlagsTable = await db.schema.hasTable('flags');
  if (!hasFlagsTable) {
    console.log('🔄 Creating flags table...');
    await db.schema.createTable('flags', (table) => {
      table.increments('id');
      table.string('package_name').notNullable().references('packages.name');
      table.string('reporter_name').notNullable(); // Who reported the issue
      table.string('reporter_type').notNullable(); // 'human' or 'agent'
      table.text('reason').notNullable(); // Why it was flagged
      table.json('evidence'); // { mismatched_files: [...], extra_files: [...] }
      table.string('signature'); // Optional Ed25519 signature
      table.string('status').defaultTo('open'); // 'open', 'resolved', 'dismissed'
      table.timestamp('created_at').defaultTo(db.fn.now());
    });
    console.log('✅ Flags table created');
  }

  // Migration: Add details column to agent_activity_log if missing
  const hasDetailsCol = await db.schema.hasColumn('agent_activity_log', 'details');
  if (!hasDetailsCol) {
    console.log('🔄 Adding details column to agent_activity_log...');
    await db.schema.table('agent_activity_log', (table) => {
      table.json('details'); // Context: version, reason, category, etc.
    });
    console.log('✅ details column added to agent_activity_log');
  }

  // Migration: Add target_type column to agent_activity_log if missing
  const hasTargetTypeCol = await db.schema.hasColumn('agent_activity_log', 'target_type');
  if (!hasTargetTypeCol) {
    console.log('🔄 Adding target_type column to agent_activity_log...');
    await db.schema.table('agent_activity_log', (table) => {
      table.string('target_type').defaultTo('package'); // 'package', 'agent', 'observation', 'flag'
    });
    console.log('✅ target_type column added to agent_activity_log');
  }

  // Migration: Add latest_version_id column to packages if it doesn't exist
  const hasLatestVersionId = await db.schema.hasColumn('packages', 'latest_version_id');
  if (!hasLatestVersionId) {
    console.log('🔄 Adding latest_version_id column to packages table...');
    await db.schema.table('packages', (table) => {
      table.integer('latest_version_id').nullable().references('versions.id');
    });
    console.log('✅ latest_version_id column added');
  }

  // Migration: Add commit_hash column to versions if it doesn't exist
  const hasCommitHash = await db.schema.hasColumn('versions', 'commit_hash');
  if (!hasCommitHash) {
    console.log('🔄 Adding commit_hash column to versions table...');
    await db.schema.table('versions', (table) => {
      table.string('commit_hash', 40).nullable(); // Git commit SHA
    });
    console.log('✅ commit_hash column added');
  }

  // Migration: Add author_name column to versions if it doesn't exist
  const hasAuthorName = await db.schema.hasColumn('versions', 'author_name');
  if (!hasAuthorName) {
    console.log('🔄 Adding author_name column to versions table...');
    await db.schema.table('versions', (table) => {
      table.string('author_name').nullable();
    });
    console.log('✅ author_name column added');
  }

  // Migration: Add author_email column to versions if it doesn't exist
  const hasAuthorEmail = await db.schema.hasColumn('versions', 'author_email');
  if (!hasAuthorEmail) {
    console.log('🔄 Adding author_email column to versions table...');
    await db.schema.table('versions', (table) => {
      table.string('author_email').nullable();
    });
    console.log('✅ author_email column added');
  }

  // Migration: Add uuid column to packages if it doesn't exist
  const hasUUID = await db.schema.hasColumn('packages', 'uuid');
  if (!hasUUID) {
    console.log('🔄 Adding uuid column to packages table...');
    await db.schema.table('packages', (table) => {
      table.string('uuid', 36).nullable(); // UUID for permanent fork lineage
    });
    // Backfill existing packages with UUIDs
    const existingPkgs = await db('packages').select('name');
    for (const pkg of existingPkgs) {
      await db('packages').where({ name: pkg.name }).update({ uuid: crypto.randomUUID() });
    }
    console.log('✅ uuid column added to packages');
  }

  // Migration: Add parent_uuid column to forks table
  const hasParentUUID = await db.schema.hasColumn('forks', 'parent_uuid');
  if (!hasParentUUID) {
    console.log('🔄 Adding parent_uuid column to forks table...');
    await db.schema.table('forks', (table) => {
      table.string('parent_uuid', 36).nullable(); // Permanent UUID reference to parent
    });
    console.log('✅ parent_uuid column added to forks');
  }

  try {
    await seedBridgeSkill();
  } catch (err) {
    console.error('⚠️ Failed to seed default @gitlobster/bridge skill:', err.message);
  }

  // Add performance indexes (idempotent - won't fail if they exist)
  try {
    await db.raw('CREATE INDEX IF NOT EXISTS idx_packages_category ON packages(category)');
    await db.raw('CREATE INDEX IF NOT EXISTS idx_packages_author_name ON packages(author_name)');
    await db.raw('CREATE INDEX IF NOT EXISTS idx_packages_downloads_created ON packages(downloads, created_at)');
    await db.raw('CREATE INDEX IF NOT EXISTS idx_versions_published_at ON versions(published_at)');
    await db.raw('CREATE INDEX IF NOT EXISTS idx_versions_package_published ON versions(package_name, published_at)');
    await db.raw('CREATE INDEX IF NOT EXISTS idx_endorsements_package_created ON endorsements(package_name, created_at)');
    await db.raw('CREATE INDEX IF NOT EXISTS idx_forks_parent ON forks(parent_package)');
    await db.raw('CREATE INDEX IF NOT EXISTS idx_forks_forked ON forks(forked_package)');
    await db.raw('CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON agent_activity_log(timestamp)');
    await db.raw('CREATE INDEX IF NOT EXISTS idx_activity_agent ON agent_activity_log(agent_name)');
    await db.raw('CREATE INDEX IF NOT EXISTS idx_activity_type ON agent_activity_log(activity_type)');
    console.log('✅ Performance indexes ensured');
  } catch (err) {
    // Indexes might already exist, that's fine
    console.log('ℹ️  Indexes already exist or error:', err.message);
  }
}

// Auto-run init
init().catch(err => {
  console.error('❌ Database Initialization Failed:', err);
});

async function seedBridgeSkill() {
  const pkgName = '@gitlobster/bridge';
  const pkgVersion = '1.0.0';

  const existingPkg = await db('packages').where({ name: pkgName }).first();
  if (existingPkg) return; // Already seeded

  const bridgePath = path.resolve(__dirname, '../../packages/@gitlobster/bridge');
  if (!fs.existsSync(bridgePath)) {
    return; // Directory doesn't exist, skip silently
  }

  console.log('🌱 Seeding default capability: @gitlobster/bridge...');

  const manifestRaw = fs.readFileSync(path.join(bridgePath, 'manifest.json'), 'utf-8');
  const manifest = JSON.parse(manifestRaw);

  const STORAGE_DIR = process.env.GITLOBSTER_STORAGE_DIR
    ? path.resolve(process.env.GITLOBSTER_STORAGE_DIR)
    : path.resolve(__dirname, '../storage');

  const packageDir = path.join(STORAGE_DIR, 'packages', pkgName);
  fs.mkdirSync(packageDir, { recursive: true });

  const tarballPath = path.join(packageDir, `${pkgVersion}.tgz`);
  cp.execSync(`tar -czf ${tarballPath} -C ${bridgePath} .`);

  const tarballBuffer = fs.readFileSync(tarballPath);
  const hash = `sha256:${crypto.createHash('sha256').update(tarballBuffer).digest('hex')}`;
  const relativePath = path.relative(STORAGE_DIR, tarballPath);

  // Use a deterministic dummy key for the system agent
  const pubKey = crypto.createHash('sha256').update('system-agent-bridge-seed').digest('base64');
  const agentName = '@gitlobster';

  const existingAgent = await db('agents').where({ name: agentName }).first();
  if (!existingAgent) {
    await db('agents').insert({
      name: agentName,
      public_key: pubKey,
      bio: 'The default GitLobster system agent providing the bridging capabilities.',
      is_trust_anchor: true,
      metadata: JSON.stringify({ isSystem: true })
    });
  }

  await db('packages').insert({
    name: pkgName,
    uuid: crypto.randomUUID(),
    description: manifest.description,
    author_name: 'gitlobster',
    author_url: manifest.author.url,
    author_public_key: pubKey,
    license: manifest.license,
    category: manifest.category,
    tags: JSON.stringify(manifest.tags || []),
    downloads: 0
  });

  const fileManifestRaw = {
    "manifest.json": "sha256:system_seeded",
    "SKILL.md": "sha256:system_seeded"
  };

  const sortedFilesKeys = Object.keys(fileManifestRaw).sort();
  const sortedFilesStr = sortedFilesKeys.map(k => `"${k}":"${fileManifestRaw[k]}"`).join(',');
  const canonicalFileManifestStr = `{"format_version":"1.0","files":{${sortedFilesStr}},"total_files":${sortedFilesKeys.length}}`;

  await db('versions').insert({
    package_name: pkgName,
    version: pkgVersion,
    storage_path: relativePath,
    hash: hash,
    signature: 'system-seeded-signature',
    manifest: JSON.stringify(manifest),
    file_manifest: canonicalFileManifestStr,
    manifest_signature: 'system-seeded-signature'
  });

  console.log('✅ Default capability @gitlobster/bridge successfully seeded.');
}

module.exports = db;
