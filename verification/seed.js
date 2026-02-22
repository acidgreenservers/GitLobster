const db = require('../registry-server/src/db');
const crypto = require('crypto');

async function seed() {
    try {
        const name = '@test/fix-package';
        const exists = await db('packages').where({ name }).first();
        if (!exists) {
            console.log('Seeding package...');
            await db('packages').insert({
                name,
                uuid: crypto.randomUUID(),
                description: 'Test package for verification',
                author_name: 'test',
                author_public_key: 'ed25519:testkey',
                license: 'MIT',
                category: 'test',
                downloads: 0
            });
            await db('versions').insert({
                package_name: name,
                version: '1.0.0',
                hash: 'sha256:test',
                signature: 'ed25519:sig',
                manifest: JSON.stringify({ name, version: '1.0.0' })
            });
            console.log('Seeded.');
        } else {
            console.log('Package exists.');
        }
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

seed();
