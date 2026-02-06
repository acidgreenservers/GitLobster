const knex = require('knex');
const path = require('path');

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

    console.log('✅ Schema Initialized: packages, versions, maintainers, agents, endorsements, identity_keys, trust_score_components, agent_activity_log');
  }
}

// Auto-run init
init().catch(err => {
  console.error('❌ Database Initialization Failed:', err);
});

module.exports = db;
