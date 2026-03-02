#!/usr/bin/env node

/**
 * Git Post-Receive Hook — V2.6 Dual-Signature Trust
 *
 * Orchestrator: delegates to focused lib/ modules.
 *
 * Flow:
 *   1. Read push info from stdin
 *   2. Extract manifest, README, SKILL from commit
 *   3. Validate all inputs + verify agent signature
 *   4. Upsert package in database
 *   5. Generate tarball + file manifest
 *   6. Sign canonical manifest with server key
 *   7. Store version with dual signatures + audit trail
 */

const {
  readStdin,
  getFileFromCommit,
  getCommitAuthor,
  extractAgentSignature,
} = require("./lib/git-reader");
const { runAll } = require("./lib/validator");
const {
  getDbConnection,
  upsertPackage,
  upsertVersion,
} = require("./lib/db-writer");
const { generateTarball, calculateFileManifest } = require("./lib/tarball");
const {
  signCanonicalManifest,
  getFingerprint,
} = require("./lib/manifest-signer");

async function main() {
  console.log("[POST-RECEIVE] Hook started (V2.6 Dual-Signature)");

  let db;
  try {
    // 1. Read push info
    const { oldRev, newRev: commitHash, refName } = readStdin();

    if (!refName.startsWith("refs/heads/")) {
      console.log("[POST-RECEIVE] Not a branch push, skipping");
      process.exit(0);
    }

    if (/^0+$/.test(commitHash)) {
      console.log("[POST-RECEIVE] Branch deletion, skipping");
      process.exit(0);
    }

    console.log(
      `[POST-RECEIVE] Push: ${oldRev.substring(0, 7)} -> ${commitHash.substring(0, 7)} (${refName})`,
    );

    // 2. Extract files from commit
    console.log("[POST-RECEIVE] Reading manifest files...");
    const manifestContent = getFileFromCommit(commitHash, "gitlobster.json");
    if (!manifestContent) {
      console.error("[POST-RECEIVE] ❌ gitlobster.json not found");
      process.exit(1);
    }

    let manifest;
    try {
      manifest = JSON.parse(manifestContent);
    } catch (parseErr) {
      console.error(
        `[POST-RECEIVE] ❌ Failed to parse gitlobster.json: ${parseErr.message}`,
      );
      process.exit(1);
    }

    const readmeContent = getFileFromCommit(commitHash, "README.md");
    const skillDocContent = getFileFromCommit(commitHash, "SKILL.md");

    // 3. Validate all inputs (enriches manifest with readme + skillDoc)
    const agentSig = extractAgentSignature(manifest);
    manifest = runAll(manifest, readmeContent, skillDocContent, agentSig);

    // 4. Get author info
    const author = getCommitAuthor(commitHash);
    console.log(
      `[POST-RECEIVE] Author: ${author.author_name} <${author.author_email}>`,
    );

    // 5. Database operations
    db = getDbConnection();
    await upsertPackage(db, manifest, author);

    // 6. Generate tarball
    await generateTarball(manifest.name, manifest.version, commitHash, db);

    // 7. Calculate per-file integrity manifest
    const fileManifest = calculateFileManifest(commitHash);

    // 8. Sign canonical manifest with server key
    const agentFingerprint = agentSig
      ? getFingerprint(agentSig.publicKey)
      : "legacy-unsigned";

    const signatures = signCanonicalManifest(
      manifest,
      agentFingerprint,
      fileManifest,
    );

    // 9. Store version with dual signatures + audit
    await upsertVersion(
      db,
      manifest,
      commitHash,
      author,
      fileManifest,
      signatures,
    );

    console.log("[POST-RECEIVE] ✅ Push validated and stored successfully");
    process.exit(0);
  } catch (err) {
    console.error(`[POST-RECEIVE] ❌ Error: ${err.message}`);
    process.exit(1);
  } finally {
    if (db) {
      await db.destroy().catch(() => {});
    }
  }
}

main();
