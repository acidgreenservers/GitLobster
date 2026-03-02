/**
 * Validator — Post-Receive Hook Library
 *
 * All business-rule validation for incoming pushes:
 *   - Manifest structure (name, version, semver)
 *   - README.md presence + frontmatter + title
 *   - SKILL.md presence (transparency requirement)
 *   - Agent signature verification (tweetnacl)
 *   - Metadata consistency (manifest.name === README title)
 *
 * Also enriches the manifest with documentation content
 * (readme, skillDoc) for database persistence.
 */

const nacl = require("tweetnacl");

/**
 * Fields added by CLI signing — stripped before
 * rebuilding canonical JSON for verification.
 */
const SIGNATURE_FIELDS = ["agentSignature", "agentPublicKey"];

/**
 * Validate manifest has required fields and correct types.
 *
 * @param {object} manifest - Parsed gitlobster.json
 * @throws {Error} On validation failure
 */
function validateManifest(manifest) {
  if (!manifest.name || !manifest.version) {
    throw new Error("Manifest missing required fields: name, version");
  }

  if (
    typeof manifest.name !== "string" ||
    typeof manifest.version !== "string"
  ) {
    throw new Error("Manifest name and version must be strings");
  }

  if (!/^\d+\.\d+\.\d+/.test(manifest.version)) {
    throw new Error(`Invalid semver format: ${manifest.version}`);
  }
}

/**
 * Validate README.md content: must have YAML frontmatter with title.
 *
 * @param {string|null} content - README.md content
 * @returns {object} Parsed frontmatter
 * @throws {Error} On validation failure
 */
function validateReadme(content) {
  if (!content) {
    throw new Error("README.md not found in commit");
  }

  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    throw new Error("README.md missing YAML frontmatter (--- title: Name ---)");
  }

  const frontmatter = {};
  match[1].split("\n").forEach((line) => {
    const colonIndex = line.indexOf(":");
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim();
      frontmatter[key] = value;
    }
  });

  if (!frontmatter.title) {
    throw new Error("README.md frontmatter missing title field");
  }

  return frontmatter;
}

/**
 * Validate SKILL.md is present (required for transparency).
 *
 * @param {string|null} content - SKILL.md content
 * @throws {Error} If SKILL.md is missing
 */
function validateSkillDoc(content) {
  if (!content) {
    throw new Error(
      "SKILL.md not found. A SKILL.md file is strictly required for transparency.",
    );
  }
}

/**
 * Validate agent signature using tweetnacl.
 * Rebuilds the canonical JSON (without signature fields) and
 * verifies with nacl.sign.detached.verify().
 *
 * Returns true for legacy unsigned manifests (backwards compat).
 *
 * @param {object} manifest - Full manifest (may include agentSignature)
 * @param {string|null} agentPublicKeyB64 - Base64-encoded public key
 * @param {string|null} agentSignatureB64 - Base64-encoded signature
 * @returns {boolean} True if valid or legacy-unsigned
 * @throws {Error} If signature exists but fails verification
 */
function validateAgentSignature(
  manifest,
  agentPublicKeyB64,
  agentSignatureB64,
) {
  if (!agentPublicKeyB64 || !agentSignatureB64) {
    console.warn(
      "[VALIDATOR] ⚠️ No agent signature found — legacy unsigned manifest (acceptable)",
    );
    return true;
  }

  try {
    // Rebuild canonical JSON: strip signature fields, sort keys
    const cleaned = {};
    for (const key of Object.keys(manifest).sort()) {
      if (!SIGNATURE_FIELDS.includes(key)) {
        cleaned[key] = manifest[key];
      }
    }
    const canonicalJSON = JSON.stringify(cleaned, Object.keys(cleaned).sort());

    const message = new Uint8Array(Buffer.from(canonicalJSON, "utf-8"));
    const publicKey = new Uint8Array(Buffer.from(agentPublicKeyB64, "base64"));
    const signature = new Uint8Array(Buffer.from(agentSignatureB64, "base64"));

    const isValid = nacl.sign.detached.verify(message, signature, publicKey);

    if (!isValid) {
      throw new Error("Agent Ed25519 signature verification FAILED");
    }

    console.log("[VALIDATOR] ✅ Agent signature verified");
    return true;
  } catch (err) {
    throw new Error(`Agent signature validation error: ${err.message}`);
  }
}

/**
 * Validate manifest.name matches README frontmatter title.
 *
 * @param {object} manifest - Parsed gitlobster.json
 * @param {object} frontmatter - Parsed README frontmatter
 * @throws {Error} On mismatch
 */
function validateMetadata(manifest, frontmatter) {
  if (manifest.name !== frontmatter.title) {
    throw new Error(
      `Metadata mismatch! manifest.name "${manifest.name}" !== ` +
        `README title "${frontmatter.title}"`,
    );
  }
}

/**
 * Run all validations and enrich manifest with documentation.
 * Attaches readme and skillDoc to manifest for DB persistence.
 *
 * @param {object} manifest - Parsed gitlobster.json
 * @param {string|null} readmeContent - README.md content
 * @param {string|null} skillDocContent - SKILL.md content
 * @param {{ signature: string, publicKey: string }|null} agentSig - Agent signature info
 * @returns {object} Enriched manifest with readme + skillDoc
 */
function runAll(manifest, readmeContent, skillDocContent, agentSig) {
  console.log("[VALIDATOR] Starting validation...");

  try {
    validateManifest(manifest);

    const frontmatter = validateReadme(readmeContent);
    validateSkillDoc(skillDocContent);

    if (agentSig) {
      validateAgentSignature(manifest, agentSig.publicKey, agentSig.signature);
    }

    validateMetadata(manifest, frontmatter);

    // Enrich manifest with documentation content for DB persistence
    manifest.readme = readmeContent;
    manifest.skillDoc = skillDocContent;

    console.log("[VALIDATOR] ✅ All validations passed");
    return manifest;
  } catch (err) {
    console.error(`[VALIDATOR] ❌ Validation failed: ${err.message}`);
    process.exit(1);
  }
}

module.exports = { runAll };
