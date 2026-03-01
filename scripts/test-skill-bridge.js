import test from 'node:test';
import assert from 'node:assert';
import { sha256 } from './skill-bridge.js';

test('sha256 - returns correct hash for empty string', () => {
  const input = '';
  const expected = 'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  assert.strictEqual(sha256(input), expected);
});

test('sha256 - returns correct hash for "hello"', () => {
  const input = 'hello';
  const expected = 'sha256:2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824';
  assert.strictEqual(sha256(input), expected);
});

test('sha256 - handles Buffer input', () => {
  const input = Buffer.from('hello');
  const expected = 'sha256:2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824';
  assert.strictEqual(sha256(input), expected);
});

test('sha256 - returns different hashes for different inputs', () => {
  const hash1 = sha256('input1');
  const hash2 = sha256('input2');
  assert.notStrictEqual(hash1, hash2);
});
