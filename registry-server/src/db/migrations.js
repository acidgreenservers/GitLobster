const db = require("./connection");
const crypto = require("crypto");

/**
 * Incremental migrations — each is idempotent (hasTable / hasColumn guards).
 * Add new migrations at the bottom; never remove old ones.
 */
async function runMigrations() {
  // ── packages table ───────────────────────────────────────────────────────
  if (!(await db.schema.hasColumn("packages", "stars"))) {
    console.log("🔄 Adding stars column to packages table...");
    await db.schema.table("packages", (t) => t.integer("stars").defaultTo(0));
    console.log("✅ Stars column added");
  }

  if (!(await db.schema.hasColumn("packages", "agent_stars"))) {
    console.log("🔄 Adding agent_stars column to packages table...");
    await db.schema.table("packages", (t) =>
      t.integer("agent_stars").defaultTo(0),
    );
    console.log("✅ agent_stars column added");
  }

  if (!(await db.schema.hasColumn("packages", "latest_version_id"))) {
    console.log("🔄 Adding latest_version_id column to packages table...");
    await db.schema.table("packages", (t) =>
      t.integer("latest_version_id").nullable().references("versions.id"),
    );
    console.log("✅ latest_version_id column added");
  }

  if (!(await db.schema.hasColumn("packages", "uuid"))) {
    console.log("🔄 Adding uuid column to packages table...");
    await db.schema.table("packages", (t) => t.string("uuid", 36).nullable());
    const existingPkgs = await db("packages").select("name");
    for (const pkg of existingPkgs) {
      await db("packages")
        .where({ name: pkg.name })
        .update({ uuid: crypto.randomUUID() });
    }
    console.log("✅ uuid column added to packages");
  }

  // ── versions table ───────────────────────────────────────────────────────
  if (!(await db.schema.hasColumn("versions", "file_manifest"))) {
    console.log("🔄 Adding file_manifest column to versions table...");
    await db.schema.table("versions", (t) => t.json("file_manifest"));
    console.log("✅ file_manifest column added");
  }

  if (!(await db.schema.hasColumn("versions", "manifest_signature"))) {
    console.log("🔄 Adding manifest_signature column to versions table...");
    await db.schema.table("versions", (t) => t.text("manifest_signature"));
    console.log("✅ manifest_signature column added");
  }

  if (!(await db.schema.hasColumn("versions", "commit_hash"))) {
    console.log("🔄 Adding commit_hash column to versions table...");
    await db.schema.table("versions", (t) =>
      t.string("commit_hash", 40).nullable(),
    );
    console.log("✅ commit_hash column added");
  }

  if (!(await db.schema.hasColumn("versions", "author_name"))) {
    console.log("🔄 Adding author_name column to versions table...");
    await db.schema.table("versions", (t) =>
      t.string("author_name").nullable(),
    );
    console.log("✅ author_name column added");
  }

  if (!(await db.schema.hasColumn("versions", "author_email"))) {
    console.log("🔄 Adding author_email column to versions table...");
    await db.schema.table("versions", (t) =>
      t.string("author_email").nullable(),
    );
    console.log("✅ author_email column added");
  }

  // ── agents table ─────────────────────────────────────────────────────────
  if (!(await db.schema.hasColumn("agents", "is_trust_anchor"))) {
    console.log("🔄 Adding is_trust_anchor column to agents table...");
    await db.schema.table("agents", (t) =>
      t.boolean("is_trust_anchor").defaultTo(false),
    );
    console.log("✅ is_trust_anchor column added");
  }

  // ── endorsements table ───────────────────────────────────────────────────
  if (!(await db.schema.hasColumn("endorsements", "endorsement_type"))) {
    console.log("🔄 Adding endorsement_type column to endorsements table...");
    await db.schema.table("endorsements", (t) =>
      t.string("endorsement_type").defaultTo("full_review"),
    );
    console.log("✅ endorsement_type column added");
  }

  // ── agent_activity_log table ─────────────────────────────────────────────
  if (!(await db.schema.hasColumn("agent_activity_log", "details"))) {
    console.log("🔄 Adding details column to agent_activity_log...");
    await db.schema.table("agent_activity_log", (t) => t.json("details"));
    console.log("✅ details column added to agent_activity_log");
  }

  if (!(await db.schema.hasColumn("agent_activity_log", "target_type"))) {
    console.log("🔄 Adding target_type column to agent_activity_log...");
    await db.schema.table("agent_activity_log", (t) =>
      t.string("target_type").defaultTo("package"),
    );
    console.log("✅ target_type column added to agent_activity_log");
  }

  // ── stars table (standalone migration in case schema init was skipped) ───
  if (!(await db.schema.hasTable("stars"))) {
    console.log("🔄 Creating stars table...");
    await db.schema.createTable("stars", (table) => {
      table.increments("id");
      table.string("agent_name").references("agents.name");
      table.string("package_name").references("packages.name");
      table.timestamp("starred_at").defaultTo(db.fn.now());
      table.unique(["agent_name", "package_name"]);
    });
    console.log("✅ Stars table created");
  }

  // ── forks table (standalone migration in case schema init was skipped) ───
  if (!(await db.schema.hasTable("forks"))) {
    console.log("🔄 Creating forks table...");
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
    console.log("✅ Forks table created");
  }

  if (!(await db.schema.hasColumn("forks", "parent_uuid"))) {
    console.log("🔄 Adding parent_uuid column to forks table...");
    await db.schema.table("forks", (t) =>
      t.string("parent_uuid", 36).nullable(),
    );
    console.log("✅ parent_uuid column added to forks");
  }

  // ── observations table ───────────────────────────────────────────────────
  if (!(await db.schema.hasTable("observations"))) {
    console.log("🔄 Creating observations table...");
    await db.schema.createTable("observations", (table) => {
      table.increments("id");
      table.string("package_name").notNullable().references("packages.name");
      table.string("observer_name").notNullable();
      table.string("observer_type").notNullable();
      table.text("content").notNullable();
      table.string("category");
      table.string("sentiment");
      table.timestamp("created_at").defaultTo(db.fn.now());
      table.string("signature");
    });
    console.log("✅ Observations table created");
  }

  // ── flags table ──────────────────────────────────────────────────────────
  if (!(await db.schema.hasTable("flags"))) {
    console.log("🔄 Creating flags table...");
    await db.schema.createTable("flags", (table) => {
      table.increments("id");
      table.string("package_name").notNullable().references("packages.name");
      table.string("reporter_name").notNullable();
      table.string("reporter_type").notNullable();
      table.text("reason").notNullable();
      table.json("evidence");
      table.string("signature");
      table.string("status").defaultTo("open");
      table.timestamp("created_at").defaultTo(db.fn.now());
    });
    console.log("✅ Flags table created");
  }

  // ── auth_challenges table ────────────────────────────────────────────────
  if (!(await db.schema.hasTable("auth_challenges"))) {
    console.log("🔄 Creating auth_challenges table...");
    await db.schema.createTable("auth_challenges", (table) => {
      table.increments("id");
      table.string("agent_name").notNullable();
      table.string("public_key").notNullable();
      table.string("challenge").notNullable();
      table.timestamp("expires_at").notNullable();
      table.timestamp("created_at").defaultTo(db.fn.now());
      table.index(["agent_name", "challenge"]);
    });
    console.log("✅ auth_challenges table created");
  }
}

module.exports = { runMigrations };
