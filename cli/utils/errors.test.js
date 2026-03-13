import test from 'node:test';
import assert from 'node:assert';
import { CliError, createCliError, isCliError } from './errors.js';

test('CliError constructor', (t) => {
  const code = 'TEST_ERROR';
  const message = 'Test message';
  const suggestions = ['Try this', 'Try that'];

  const error = new CliError(code, message, suggestions);

  assert.strictEqual(error.name, 'CliError');
  assert.strictEqual(error.message, message);
  assert.strictEqual(error.code, code);
  assert.deepStrictEqual(error.suggestions, suggestions);
  assert.ok(error instanceof Error);
  assert.ok(error instanceof CliError);
});

test('createCliError helper', (t) => {
  const error = createCliError('CODE', 'Message', ['Suggestion']);

  assert.ok(error instanceof CliError);
  assert.strictEqual(error.code, 'CODE');
  assert.strictEqual(error.message, 'Message');
  assert.deepStrictEqual(error.suggestions, ['Suggestion']);
});

test('isCliError type guard', (t) => {
  const cliError = createCliError('CODE', 'Msg');
  const regularError = new Error('Msg');

  assert.strictEqual(isCliError(cliError), true);
  assert.strictEqual(isCliError(regularError), false);
  assert.strictEqual(isCliError({}), false);
  assert.strictEqual(isCliError(null), false);
});

test('CliError.toString() formatting', async (t) => {
  await t.test('without suggestions', () => {
    const error = createCliError('CODE', 'Message');
    assert.strictEqual(error.toString(), 'CODE: Message');
  });

  await t.test('with suggestions', () => {
    const error = createCliError('CODE', 'Message', ['Fix 1', 'Fix 2']);
    assert.strictEqual(error.toString(), 'CODE: Message\nSuggestions:\n  - Fix 1\n  - Fix 2');
  });
});

test('Edge case: suggestions as a single string', (t) => {
  // Based on the task description, we want to ensure suggestions is always an array
  const error = createCliError('CODE', 'Message', 'Single suggestion');

  // This test might fail currently if the implementation doesn't handle it
  assert.ok(Array.isArray(error.suggestions), 'suggestions should be an array');
  assert.deepStrictEqual(error.suggestions, ['Single suggestion']);
});

test('isCliError property', (t) => {
  const error = createCliError('CODE', 'Msg');
  assert.strictEqual(error.isCliError, true);
});
