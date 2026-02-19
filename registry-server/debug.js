console.log('Current Directory:', process.cwd());
console.log('Module Paths:', module.paths);

try {
    const nacl = require('tweetnacl');
    console.log('✅ tweetnacl loaded successfully');
} catch (e) {
    console.error('❌ Failed to load tweetnacl:', e.message);
}

try {
    const util = require('tweetnacl-util');
    console.log('✅ tweetnacl-util loaded successfully');
} catch (e) {
    console.error('❌ Failed to load tweetnacl-util:', e.message);
}
