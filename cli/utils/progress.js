/**
 * Progress utility – a thin wrapper around the `ora` spinner.
 *
 * The CLI currently creates many independent `ora` spinners directly in
 * command implementations. This leads to duplicated configuration and makes
 * it harder to enforce a consistent look‑and‑feel (e.g., colour, prefix,
 * handling of failures). The `progress` module centralises this logic so
 * that commands can simply call `startSpinner(message)` and later invoke
 * `succeed()`, `fail(error)`, or `stop()` as needed.
 *
 * Usage example in a command file:
 *
 *   import { startSpinner } from './progress.js';
 *   const spinner = startSpinner('Installing package');
 *   try {
 *     await doWork();
 *     spinner.succeed('Installation complete');
 *   } catch (err) {
 *     spinner.fail(err);
 *     throw err; // or re‑throw a CliError
 *   }
 *
 * The wrapper also prints any attached `CliError` suggestions when a failure
 * occurs, providing the user with actionable remediation steps.
 */

import ora from "ora";
import chalk from "chalk";
import { isCliError } from "./errors.js";

/**
 * Starts a spinner with the given message.
 *
 * @param {string} message - The text to display while the spinner is active.
 * @param {object} [options] - Optional ora configuration overrides.
 * @returns {object} An object exposing `succeed`, `fail`, `update`, and `stop` methods.
 */
export function startSpinner(message, options = {}) {
  const spinner = ora({
    text: message,
    color: "cyan",
    // Allow callers to override any ora option via `options`.
    ...options,
  }).start();

  return {
    /**
     * Marks the spinner as successful.
     * @param {string} [successMessage] - Optional success text, defaults to original.
     */
    succeed(successMessage) {
      spinner.succeed(successMessage ?? message);
    },

    /**
     * Marks the spinner as failed.
     * If the error is a `CliError`, prints its suggestions.
     * @param {Error|string} err - The error that caused the failure.
     */
    fail(err) {
      const failMsg =
        err && err.message
          ? err.message
          : typeof err === "string"
            ? err
            : "Failed";
      spinner.fail(chalk.red(failMsg));

      // If the error is a CliError, output its suggestions for the user.
      if (isCliError(err) && err.suggestions?.length) {
        err.suggestions.forEach((s) => {
          console.error(chalk.yellow(`   • ${s}`));
        });
      }
    },

    /**
     * Updates the spinner text mid-operation.
     * @param {string} text - New spinner text.
     */
    update(text) {
      spinner.text = text;
    },

    /**
     * Stops the spinner without marking success or failure.
     * Useful for long‑running operations where intermediate updates are printed.
     */
    stop() {
      spinner.stop();
    },

    /**
     * Direct access to the underlying ora instance (rarely needed).
     */
    raw: spinner,
  };
}
