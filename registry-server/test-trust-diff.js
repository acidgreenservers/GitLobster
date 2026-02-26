const test = require('node:test');
const assert = require('node:assert');
const { calculatePermissionDiff } = require('./src/utils/trust-diff');

test('calculatePermissionDiff - Empty permissions', () => {
    const diff = calculatePermissionDiff({}, {});
    assert.strictEqual(diff.riskScore, 0);
    assert.strictEqual(diff.impact, 'NONE');
    assert.strictEqual(diff.added.length, 0);
    assert.strictEqual(diff.removed.length, 0);
});

test('calculatePermissionDiff - Adding high-risk permission (network)', () => {
    const base = { permissions: {} };
    const head = { permissions: { network: { outbound: ['google.com'] } } };
    const diff = calculatePermissionDiff(base.permissions, head.permissions);
    assert.strictEqual(diff.riskScore, 3);
    assert.strictEqual(diff.impact, 'HIGH');
    assert.ok(diff.added.includes('network:outbound:google.com'));
});

test('calculatePermissionDiff - Adding medium-risk permission (filesystem)', () => {
    const base = { permissions: {} };
    const head = { permissions: { filesystem: { read: ['/tmp'] } } };
    const diff = calculatePermissionDiff(base.permissions, head.permissions);
    assert.strictEqual(diff.riskScore, 2);
    assert.strictEqual(diff.impact, 'MEDIUM');
});

test('calculatePermissionDiff - Adding low-risk/unknown permission', () => {
    const base = { permissions: {} };
    const head = { permissions: { unknown: { action: ['something'] } } };
    const diff = calculatePermissionDiff(base.permissions, head.permissions);
    assert.strictEqual(diff.riskScore, 1);
    assert.strictEqual(diff.impact, 'MEDIUM');
});

test('calculatePermissionDiff - Removing permissions', () => {
    const base = { permissions: { network: { outbound: ['google.com'] } } };
    const head = { permissions: {} };
    const diff = calculatePermissionDiff(base.permissions, head.permissions);
    assert.strictEqual(diff.riskScore, 0);
    assert.strictEqual(diff.impact, 'LOW');
    assert.ok(diff.removed.includes('network:outbound:google.com'));
});

test('calculatePermissionDiff - Cumulative risk scoring', () => {
    const base = { permissions: {} };
    const head = {
        permissions: {
            network: { outbound: ['google.com'] },
            filesystem: { write: ['/var/log'] }
        }
    };
    const diff = calculatePermissionDiff(base.permissions, head.permissions);
    assert.strictEqual(diff.riskScore, 5);
    assert.strictEqual(diff.impact, 'HIGH');
});

test('calculatePermissionDiff - Multiple permissions in same category', () => {
    const base = { permissions: { network: { outbound: ['google.com'] } } };
    const head = { permissions: { network: { outbound: ['google.com', 'openai.com'] } } };
    const diff = calculatePermissionDiff(base.permissions, head.permissions);
    assert.strictEqual(diff.riskScore, 3);
    assert.strictEqual(diff.impact, 'HIGH');
});

test('calculatePermissionDiff - Nested permission structures', () => {
    const base = { permissions: {} };
    const head = {
        permissions: {
            shell: {
                exec: ['ls'],
                spawn: {
                    allowed: ['echo']
                }
            }
        }
    };
    const diff = calculatePermissionDiff(base.permissions, head.permissions);
    assert.strictEqual(diff.riskScore, 6);
    assert.strictEqual(diff.added.length, 2);
});
