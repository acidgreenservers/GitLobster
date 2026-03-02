const db = require("./connection");
const crypto = require("crypto");

/**
 * Creates all base tables on first run.
 * Called once during init() — no-op if tables already exist.
 */
async function createSchema() {
  const hasPackages = await db.schema.hasTable("packages");
  if (hasPackages) return; // Already initialized

  console.log("🚧 Initializing Database Schema...");

  await db.schema.createTable("packages", (table) => {
    table.string("name").primary(); // @scope/name
    table.string("description");
    table.string("author_name");
    table.string("author_url");
    table.string("author_public_key");
    table.string("license");
    table.string("category");
    table.json("tags");
    table.integer("downloads").defaultTo(0);
    table.timestamp("created_at").defaultTo(db.fn.now());
    table.timestamp("updated_at").defaultTo(db.fn.now());
  });

  await db.schema.createTable("versions", (table) => {
    table.increments("id");
    table.string("package_name").references("packages.name");
    table.string("version");
    table.string("storage_path");
    table.string("hash");
    table.string("signature");
    table.json("manifest");
    table.timestamp("published_at").defaultTo(db.fn.now());
    table.unique(["package_name", "version"]);
  });

  await db.schema.createTable("maintainers", (table) => {
    table.increments("id");
    table.string("package_name").references("packages.name");
    table.string("public_key");
    table.string("role").defaultTo("owner");
  });

  await db.schema.createTable("agents", (table) => {
    table.string("name").primary();
    table.string("public_key");
    table.string("bio");
    table.string("human_facilitator");
    table.json("metadata");
    table.timestamp("joined_at").defaultTo(db.fn.now());
  });

  await db.schema.createTable("endorsements", (table) => {
    table.increments("id");
    table.string("package_name").references("packages.name");
    table.string("signer_name");
    table.string("signer_type").defaultTo("agent");
    table.string("comment");
    table.string("signature");
    table.integer("trust_level").defaultTo(1);
    table.timestamp("created_at").defaultTo(db.fn.now());
  });

  await db.schema.createTable("identity_keys", (table) => {
    table.increments("id");
    table.string("agent_name").references("agents.name");
    table.string("public_key").unique();
    table.string("key_fingerprint").unique();
    table.timestamp("first_seen").defaultTo(db.fn.now());
    table.timestamp("last_used").defaultTo(db.fn.now());
    table.boolean("is_active").defaultTo(true);
    table.string("revocation_reason");
    table.string("revocation_signature");
  });

  await db.schema.createTable("trust_score_components", (table) => {
    table.string("agent_name").primary().references("agents.name");
    table.float("capability_reliability").defaultTo(0.5);
    table.float("review_consistency").defaultTo(0.5);
    table.float("flag_history_score").defaultTo(1.0);
    table.float("trust_anchor_overlap").defaultTo(0.0);
    table.float("time_in_network").defaultTo(0.0);
    table.float("computed_score").defaultTo(0.5);
    table.timestamp("last_computed").defaultTo(db.fn.now());
  });

  await db.schema.createTable("agent_activity_log", (table) => {
    table.increments("id");
    table.string("agent_name").references("agents.name");
    table.string("activity_type");
    table.string("target");
    table.timestamp("timestamp").defaultTo(db.fn.now());
  });

  await db.schema.createTable("stars", (table) => {
    table.increments("id");
    table.string("agent_name").references("agents.name");
    table.string("package_name").references("packages.name");
    table.timestamp("starred_at").defaultTo(db.fn.now());
    table.unique(["agent_name", "package_name"]);
  });

  await db.schema.createTable("forks", (table) => {
    table.increments("id");
    table.string("parent_package").references("packages.name");
    table.string("forked_package").references("packages.name");
    table.string("fork_reason");
    table.string("fork_point_version");
    table.string("fork_point_commit").defaultTo("no_git_repo");
    table.string("forker_agent").references("agents.name");
    table.string("signature");
    table.timestamp("forked_at").defaultTo(db.fn.now());
  });

  console.log(
    "✅ Schema Initialized: packages, versions, maintainers, agents, endorsements, identity_keys, trust_score_components, agent_activity_log, stars, forks",
  );
}

/**
 * Creates all performance indexes (idempotent via IF NOT EXISTS).
 */
async function createIndexes() {
  try {
    await db.raw(
      "CREATE INDEX IF NOT EXISTS idx_packages_category ON packages(category)",
    );
    await db.raw(
      "CREATE INDEX IF NOT EXISTS idx_packages_author_name ON packages(author_name)",
    );
    await db.raw(
      "CREATE INDEX IF NOT EXISTS idx_packages_downloads_created ON packages(downloads, created_at)",
    );
    await db.raw(
      "CREATE INDEX IF NOT EXISTS idx_versions_published_at ON versions(published_at)",
    );
    await db.raw(
      "CREATE INDEX IF NOT EXISTS idx_versions_package_published ON versions(package_name, published_at)",
    );
    await db.raw(
      "CREATE INDEX IF NOT EXISTS idx_endorsements_package_created ON endorsements(package_name, created_at)",
    );
    await db.raw(
      "CREATE INDEX IF NOT EXISTS idx_forks_parent ON forks(parent_package)",
    );
    await db.raw(
      "CREATE INDEX IF NOT EXISTS idx_forks_forked ON forks(forked_package)",
    );
    await db.raw(
      "CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON agent_activity_log(timestamp)",
    );
    await db.raw(
      "CREATE INDEX IF NOT EXISTS idx_activity_agent ON agent_activity_log(agent_name)",
    );
    await db.raw(
      "CREATE INDEX IF NOT EXISTS idx_activity_type ON agent_activity_log(activity_type)",
    );
    console.log("✅ Performance indexes ensured");
  } catch (err) {
    console.log("ℹ️  Indexes already exist or error:", err.message);
  }
}

module.exports = { createSchema, createIndexes };
