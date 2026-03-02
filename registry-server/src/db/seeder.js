const path = require("path");
const fs = require("fs");
const cp = require("child_process");
const crypto = require("crypto");
const db = require("./connection");

/**
 * Seeds the @gitlobster/bridge default capability on first startup.
 * No-op if the package is already present or the source directory doesn't exist.
 */
async function seedBridgeSkill() {
  const pkgName = "@gitlobster/bridge";
  const pkgVersion = "1.0.0";

  const existingPkg = await db("packages").where({ name: pkgName }).first();
  if (existingPkg) return; // Already seeded

  const bridgePath = path.resolve(
    __dirname,
    "../../../packages/@gitlobster/bridge",
  );
  if (!fs.existsSync(bridgePath)) return; // Source dir missing — skip silently

  console.log("🌱 Seeding default capability: @gitlobster/bridge...");

  const manifest = JSON.parse(
    fs.readFileSync(path.join(bridgePath, "manifest.json"), "utf-8"),
  );

  manifest.readme = fs.readFileSync(
    path.join(bridgePath, "README.md"),
    "utf-8",
  );
  manifest.skillDoc = fs.readFileSync(
    path.join(bridgePath, "SKILL.md"),
    "utf-8",
  );

  const STORAGE_DIR = process.env.GITLOBSTER_STORAGE_DIR
    ? path.resolve(process.env.GITLOBSTER_STORAGE_DIR)
    : path.resolve(__dirname, "../../storage");

  const packageDir = path.join(STORAGE_DIR, "packages", pkgName);
  fs.mkdirSync(packageDir, { recursive: true });

  const tarballPath = path.join(packageDir, `${pkgVersion}.tgz`);
  cp.execFileSync("tar", ["-czf", tarballPath, "-C", bridgePath, "."]);

  const tarballBuffer = fs.readFileSync(tarballPath);
  const hash = `sha256:${crypto.createHash("sha256").update(tarballBuffer).digest("hex")}`;
  const relativePath = path.relative(STORAGE_DIR, tarballPath);

  // Deterministic system agent key (not used for real auth — seeding only)
  const pubKey = crypto
    .createHash("sha256")
    .update("system-agent-bridge-seed")
    .digest("base64");
  const agentName = "@gitlobster";

  const existingAgent = await db("agents").where({ name: agentName }).first();
  if (!existingAgent) {
    await db("agents").insert({
      name: agentName,
      public_key: pubKey,
      bio: "The default GitLobster system agent providing the bridging capabilities.",
      is_trust_anchor: true,
      metadata: JSON.stringify({ isSystem: true }),
    });
  }

  await db("packages").insert({
    name: pkgName,
    uuid: crypto.randomUUID(),
    description: manifest.description,
    author_name: "gitlobster",
    author_url: manifest.author.url,
    author_public_key: pubKey,
    license: manifest.license,
    category: manifest.category,
    tags: JSON.stringify(manifest.tags || []),
    downloads: 0,
  });

  const fileManifestRaw = {
    "manifest.json": "sha256:system_seeded",
    "SKILL.md": "sha256:system_seeded",
  };
  const sortedKeys = Object.keys(fileManifestRaw).sort();
  const filesStr = sortedKeys
    .map((k) => `"${k}":"${fileManifestRaw[k]}"`)
    .join(",");
  const canonicalManifest = `{"format_version":"1.0","files":{${filesStr}},"total_files":${sortedKeys.length}}`;

  await db("versions").insert({
    package_name: pkgName,
    version: pkgVersion,
    storage_path: relativePath,
    hash,
    signature: "system-seeded-signature",
    manifest: JSON.stringify(manifest),
    file_manifest: canonicalManifest,
    manifest_signature: "system-seeded-signature",
  });

  console.log("✅ Default capability @gitlobster/bridge successfully seeded.");
}

module.exports = { seedBridgeSkill };
