/**
 * Manifest validator – validates a `gitlobster.json` (skill manifest) against
 * the JSON schema defined in `gitlobster-schema.json`.
 *
 * The validator uses AJV (Another JSON Schema Validator). If validation
 * fails, a `CliError` with code `MANIFEST_INVALID` is thrown so that the
 * top‑level CLI can display a clear error message together with actionable
 * suggestions.
 *
 * Usage example (in a command file):
 *
 *   import { validateManifest } from './manifestValidator.js';
 *   const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
 *   validateManifest(manifest, manifestPath);
 *
 * The function returns `true` on success (for convenience) and throws on
 * failure.
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import Ajv from "ajv";
import { createCliError } from "./errors.js";

// Resolve __dirname equivalent in ESM
const __dirname = dirname(fileURLToPath(import.meta.url));

// Load and parse the JSON schema (cached at module load time)
const schemaPath = join(__dirname, "gitlobster-schema.json");
let schema;
try {
  schema = JSON.parse(readFileSync(schemaPath, "utf8"));
} catch (err) {
  // If the schema file cannot be read, this is a developer error – abort early.
  throw new Error(
    `Failed to load GitLobster manifest schema from ${schemaPath}: ${err.message}`,
  );
}

// Initialise AJV – `allErrors` provides a full list of validation problems.
const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

/**
 * Validates a manifest object against the GitLobster schema.
 *
 * @param {object} manifest - Parsed JSON object (the contents of gitlobster.json).
 * @param {string} [manifestPath] - Optional file path for richer error messages.
 * @returns {boolean} Returns true if the manifest is valid.
 * @throws {CliError} Throws a `CliError` with code `MANIFEST_INVALID` on failure.
 */
export function validateManifest(manifest, manifestPath) {
  const valid = validate(manifest);
  if (!valid) {
    const errorMessages = (validate.errors || [])
      .map((e) => `${e.instancePath || "/"} ${e.message}`)
      .join("; ");
    const suggestions = [
      "Run `gitlobster init` to generate a new manifest",
      "Fix the JSON structure according to the schema (see `gitlobster docs` for schema reference)",
    ];
    throw createCliError(
      "MANIFEST_INVALID",
      `Manifest validation failed${manifestPath ? ` at ${manifestPath}` : ""}: ${errorMessages}`,
      suggestions,
    );
  }
  return true;
}
