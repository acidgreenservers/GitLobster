const { test, describe, it } = require('node:test');
const assert = require('node:assert');
const { scopedToDirName } = require('./src/git-middleware');

describe('scopedToDirName Security Tests', () => {

    // Valid cases
    it('should handle standard scoped package names', () => {
        assert.strictEqual(scopedToDirName('@scope/package'), 'scope-package.git');
    });

    it('should handle unscoped package names', () => {
        assert.strictEqual(scopedToDirName('package'), 'package.git');
    });

    it('should handle package names with hyphens', () => {
        assert.strictEqual(scopedToDirName('@scope/my-package'), 'scope-my-package.git');
    });

    it('should handle package names with underscores', () => {
        assert.strictEqual(scopedToDirName('@scope/my_package'), 'scope-my_package.git');
    });

    it('should handle package names with dots', () => {
        assert.strictEqual(scopedToDirName('my.package.js'), 'my.package.js.git');
    });

    // Invalid / Dangerous cases
    it('should sanitize path traversal attempts', () => {
        const result = scopedToDirName('@scope/../../etc/passwd');
        // Expect result to be safe (no slashes, no .. as path component)
        assert.ok(!result.includes('/'), 'Result should not contain slashes');
        assert.ok(!result.includes('..'), 'Result should not contain .. sequence');
        // The exact output depends on implementation details but it must be safe
        // e.g. 'scope-..-..-etc-passwd.git' (if .. is allowed as text) or 'scope----etc-passwd.git' (if .. is replaced)
        // For strict security, we expect .. to be neutralized.
        // My proposed implementation replaces .. with --
        assert.strictEqual(result, 'scope-------etc-passwd.git');
    });

    it('should sanitize command injection characters', () => {
        const dangerous = [
            'package; rm -rf /',
            'package | whoami',
            'package$(id)',
            'package`id`',
            'package<script>',
            'package>',
            'package&',
            'package"',
            "package'",
            'package ',
            'package\t',
            'package\n',
            'package\\',
            'package*'
        ];

        dangerous.forEach(input => {
            const result = scopedToDirName(input);
            assert.ok(!result.includes(';'), `Result for "${input}" contained ;`);
            assert.ok(!result.includes('|'), `Result for "${input}" contained |`);
            assert.ok(!result.includes('$'), `Result for "${input}" contained $`);
            assert.ok(!result.includes('`'), `Result for "${input}" contained \``);
            assert.ok(!result.includes('<'), `Result for "${input}" contained <`);
            assert.ok(!result.includes('>'), `Result for "${input}" contained >`);
            assert.ok(!result.includes('&'), `Result for "${input}" contained &`);
            assert.ok(!result.includes('"'), `Result for "${input}" contained "`);
            assert.ok(!result.includes("'"), `Result for "${input}" contained '`);
            assert.ok(!result.includes(' '), `Result for "${input}" contained space`);
            assert.ok(!result.includes('\t'), `Result for "${input}" contained tab`);
            assert.ok(!result.includes('\n'), `Result for "${input}" contained newline`);
            assert.ok(!result.includes('\\'), `Result for "${input}" contained backslash`);
            assert.ok(!result.includes('*'), `Result for "${input}" contained *`);

            // Check only safe characters remain (alphanumeric, -, _, .)
            const invalidChars = result.replace(/[a-zA-Z0-9_\-\.]/g, '');
            assert.strictEqual(invalidChars, '', `Result "${result}" contains invalid chars: ${invalidChars}`);
        });
    });

    it('should preserve multiple hyphens (to avoid collisions)', () => {
         // We do NOT want to collapse hyphens as it would cause collisions between foo-bar and foo--bar
         assert.strictEqual(scopedToDirName('@scope///pkg'), 'scope---pkg.git');
    });

    it('should handle @ in the middle of name (if allowed)', () => {
        // If we only remove leading @, then @ in middle is replaced by -
        assert.strictEqual(scopedToDirName('my@package'), 'my-package.git');
    });

    it('should handle complex nested paths (which should be flattened)', () => {
        assert.strictEqual(scopedToDirName('@scope/sub/dir/pkg'), 'scope-sub-dir-pkg.git');
    });
});
