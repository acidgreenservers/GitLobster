/**
 * Centralized CLI error class providing consistent, actionable error messages.
 *
 * The GitLobster CLI historically returned plain strings or simple objects.
 * This caused duplicated error handling across commands and made it hard
 * to surface helpful remediation steps to the user.
 *
 * `CliError` encapsulates:
 *   - a short `code` (machine‑readable identifier)
 *   - a human‑readable `message`
 *   - an optional array of `suggestions` that can be displayed as tips
 *
 * All command modules should `throw` an instance of `CliError` (or a subclass)
 * instead of returning `{ success, message }`. The top‑level CLI entry point
 * (`cli/bin/gitlobster.js`) can catch these errors and render them uniformly:
 *
 *   console.error(`❌ ${err.message}`);
 *   if (err.suggestions?.length) {
 *     err.suggestions.forEach(s => console.error(`   • ${s}`));
 *   }
 *
 * This design enables:
 *   • Consistent formatting across commands
 *   • Easy integration with a `--verbose` flag (by printing `err.stack`)
 *   • Future localization or machine‑readable error handling
 */

export class CliError extends Error {
  /**
   * Constructs a new CliError instance.
   * @param {string} code - Machine-readable error code (e.g. "MANIFEST_INVALID")
   * @param {string} message - Human-readable error message
   * @param {string[]} [suggestions=[]] - Actionable remediation suggestions
   */
  constructor(code, message, suggestions = []) {
    super(message);
    this.name = "CliError";
    this.code = code;
    this.suggestions = Array.isArray(suggestions) ? suggestions : [suggestions];
    this.isCliError = true;
    // Preserve proper stack trace (V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CliError);
    }
  }

  /**
   * Returns a formatted string suitable for console output.
   * @returns {string}
   */
  toString() {
    let out = `${this.code}: ${this.message}`;
    if (this.suggestions.length) {
      out += "\nSuggestions:";
      for (const s of this.suggestions) {
        out += `\n  - ${s}`;
      }
    }
    return out;
  }
}

/**
 * Helper to create a `CliError` without the `new` keyword.
 *
 * @param {string} code
 * @param {string} message
 * @param {string[]} [suggestions]
 * @returns {CliError}
 */
export function createCliError(code, message, suggestions = []) {
  return new CliError(code, message, suggestions);
}

/**
 * Type guard to check if an error is a CliError.
 *
 * @param {any} err - The error object to test.
 * @returns {boolean}
 */
export function isCliError(err) {
  return err instanceof CliError;
}
