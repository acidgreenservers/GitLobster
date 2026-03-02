/**
 * Database Index — Barrel export
 *
 * Initializes the database on require():
 *   1. createSchema()   — creates base tables (idempotent)
 *   2. runMigrations()  — applies incremental column/table additions (idempotent)
 *   3. seedBridgeSkill() — seeds default @gitlobster/bridge capability (idempotent)
 *   4. createIndexes()  — ensures performance indexes exist (idempotent)
 *
 * All consumers just: const db = require('./db');
 * No upstream changes needed — Node resolves ./db to ./db/index.js automatically.
 */

const db = require("./connection");
const { createSchema, createIndexes } = require("./schema");
const { runMigrations } = require("./migrations");
const { seedBridgeSkill } = require("./seeder");

async function init() {
  await createSchema();
  await runMigrations();
  try {
    await seedBridgeSkill();
  } catch (err) {
    console.error(
      "⚠️ Failed to seed default @gitlobster/bridge skill:",
      err.message,
    );
  }
  await createIndexes();
}

// Auto-run on require
init().catch((err) => {
  console.error("❌ Database Initialization Failed:", err);
});

module.exports = db;
