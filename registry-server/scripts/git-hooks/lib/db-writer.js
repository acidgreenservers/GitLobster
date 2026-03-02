/**
 * DB Writer — Post-Receive Hook Library
 *
 * Database operations for the post-receive hook:
 *   - getDbConnection(): env-aware LOCAL/SERVER storage resolution
 *   - upsertPackage(): create or update package record (with bug fixes)
 *   - upsertVersion(): create or update version with dual signatures
 *
 * Bug fixes included:
 *   - New packages get uuid assigned
 *   - tags, category, license populated from manifest
 *   - Wrapped in db.transaction() for atomicity
 */

const knex = require("knex");
const path = require("path");
const crypto = require("crypto");

/**
 * Create a Knex connection to the registry SQLite database.
 * Supports both LOCAL and SERVER storage modes via environment variables.
 *
 * @returns {import('knex').Knex} Knex instance
 */
function getDbConnection() {
  const storageLocation = process.env.GIT_STORAGE_LOCATION || "LOCAL";
  let dbPath;

  if (storageLocation === "SERVER") {
    const serverPath = process.env.GITLOBSTER_SERVER_STORAGE_PATH;
    if (!serverPath) {
      throw new Error(
        "GIT_STORAGE_LOCATION=SERVER requires GITLOBSTER_SERVER_STORAGE_PATH",
      );
    }
    dbPath = path.resolve(serverPath, "registry.sqlite");
    console.log(`[DB-WRITER] Using SERVER storage: ${dbPath}`);
  } else {
    // LOCAL mode — resolve relative to registry-server root
    const registryRoot = path.resolve(__dirname, "../../..");
    dbPath = process.env.GITLOBSTER_STORAGE_DIR
      ? path.resolve(process.env.GITLOBSTER_STORAGE_DIR, "registry.sqlite")
      : path.resolve(registryRoot, "storage/registry.sqlite");
    console.log(`[DB-WRITER] Using LOCAL storage: ${dbPath}`);
  }

  return knex({
    client: "sqlite3",
    connection: { filename: dbPath },
    useNullAsDefault: true,
  });
}

/**
 * Create or update a package record.
 *
 * Bug fixes vs. original monolith:
 *   - Assigns crypto.randomUUID() to new packages
 *   - Writes tags, category, license from manifest
 *
 * @param {import('knex').Knex} db - Knex instance
 * @param {object} manifest - Enriched gitlobster.json
 * @param {{ author_name: string, author_email: string }} author - Commit author
 */
async function upsertPackage(db, manifest, author) {
  const packageName = manifest.name;

  let pkg = await db("packages").where({ name: packageName }).first();

  if (!pkg) {
    console.log(`[DB-WRITER] Creating new package: ${packageName}`);
    await db("packages").insert({
      name: packageName,
      uuid: crypto.randomUUID(),
      description: manifest.description || "",
      author_name: author.author_name,
      author_url: manifest.homepage || "",
      author_public_key: manifest.agentPublicKey || "",
      license: manifest.license || "",
      category: manifest.category || "",
      tags: JSON.stringify(manifest.tags || []),
      downloads: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  } else {
    console.log(`[DB-WRITER] Updating existing package: ${packageName}`);
    await db("packages")
      .where({ name: packageName })
      .update({
        description: manifest.description || pkg.description,
        license: manifest.license || pkg.license,
        category: manifest.category || pkg.category,
        tags: JSON.stringify(manifest.tags || []),
        author_public_key: manifest.agentPublicKey || pkg.author_public_key,
        updated_at: new Date().toISOString(),
      });
  }
}

/**
 * Create or update a version record with dual signatures.
 * Also inserts an audit record into manifest_signatures.
 * Wrapped in a transaction for atomicity.
 *
 * @param {import('knex').Knex} db - Knex instance
 * @param {object} manifest - Enriched gitlobster.json
 * @param {string} commitHash - The pushed commit SHA
 * @param {{ author_name: string, author_email: string }} author - Commit author
 * @param {object} fileManifest - Per-file SHA-256 hashes
 * @param {object} signatures - { serverSignature, serverPublicKey, serverFingerprint, agentFingerprint }
 */
async function upsertVersion(
  db,
  manifest,
  commitHash,
  author,
  fileManifest,
  signatures,
) {
  const packageName = manifest.name;
  const version = manifest.version;

  await db.transaction(async (trx) => {
    const existingVersion = await trx("versions")
      .where({ package_name: packageName, version })
      .first();

    const versionData = {
      package_name: packageName,
      version: version,
      manifest: JSON.stringify(manifest),
      file_manifest: JSON.stringify(fileManifest),

      // Dual signatures
      agent_public_key: manifest.agentPublicKey || null,
      agent_fingerprint: signatures.agentFingerprint,
      manifest_signature: signatures.serverSignature,
      server_public_key: signatures.serverPublicKey,
      server_fingerprint: signatures.serverFingerprint,

      // Metadata
      commit_hash: commitHash,
      author_name: author.author_name,
      author_email: author.author_email,
      published_at: new Date().toISOString(),
    };

    if (existingVersion) {
      console.log(`[DB-WRITER] Updating version ${packageName}@${version}`);
      await trx("versions")
        .where({ package_name: packageName, version })
        .update(versionData);
    } else {
      console.log(`[DB-WRITER] Creating new version ${packageName}@${version}`);
      const [versionId] = await trx("versions").insert(versionData);

      // Update latest_version_id pointer
      await trx("packages")
        .where({ name: packageName })
        .update({ latest_version_id: versionId });
    }

    // Audit trail — manifest_signatures table
    try {
      await trx("manifest_signatures").insert({
        package_name: packageName,
        version: version,
        agent_name: author.author_name,
        agent_fingerprint: signatures.agentFingerprint,
        agent_signature: manifest.agentSignature || "system-legacy",
        agent_signature_valid: manifest.agentSignature ? 1 : 0,
        agent_validated_at: new Date().toISOString(),
        server_fingerprint: signatures.serverFingerprint,
        server_signature: signatures.serverSignature,
        server_signed_at: new Date().toISOString(),
        event_type: "SERVER_VALIDATED",
        created_at: new Date().toISOString(),
      });
    } catch (auditErr) {
      // Non-fatal: audit table might not exist on first run before migration
      console.warn(
        `[DB-WRITER] ⚠️ Audit trail insert skipped: ${auditErr.message}`,
      );
    }
  });

  console.log(
    `[DB-WRITER] ✅ Version ${packageName}@${version} stored with dual signatures`,
  );
}

module.exports = {
  getDbConnection,
  upsertPackage,
  upsertVersion,
};
