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

    console.log('✅ Schema Initialized: packages, versions, maintainers, agents, endorsements');
  }
}

// Auto-run init
init().catch(err => {
  console.error('❌ Database Initialization Failed:', err);
});

module.exports = db;
