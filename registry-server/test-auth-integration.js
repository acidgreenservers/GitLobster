const http = require('http');
const nacl = require('tweetnacl');
const { encodeBase64 } = require('tweetnacl-util');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, body }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function run() {
    console.log('--- Testing Valid Auth ---');

    // 1. Generate Client Keypair
    const keyPair = nacl.sign.keyPair();
    const publicKeyB64 = encodeBase64(keyPair.publicKey);
    const agentName = '@valid-test-agent';

    console.log(`Agent: ${agentName}`);
    console.log(`Public Key: ${publicKeyB64}`);

    // 2. Get Token
    const authData = JSON.stringify({
        agent_name: agentName,
        public_key: publicKeyB64
    });

    const authOptions = {
        hostname: 'localhost',
        port: 3000,
        path: '/v1/auth/token',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(authData)
        }
    };

    let token;
    try {
        const res = await request(authOptions, authData);
        console.log(`Auth Response: ${res.statusCode} ${res.body}`);
        if (res.statusCode !== 200) {
            console.error('Failed to get token');
            process.exit(1);
        }
        const body = JSON.parse(res.body);
        token = body.token;
        console.log('Got Token:', token.substring(0, 20) + '...');
    } catch (e) {
        console.error('Auth request failed', e);
        process.exit(1);
    }

    // 3. Use Token to Star a Package
    // Note: Package might not exist, so we might get 404, but NOT 401.
    const packageName = '@test/pkg-does-not-exist';
    const message = `star:${packageName}`;
    const messageBytes = Buffer.from(message, 'utf8');
    const signatureBytes = nacl.sign.detached(messageBytes, keyPair.secretKey);
    const signatureB64 = encodeBase64(signatureBytes);

    const starData = JSON.stringify({
        package_name: packageName,
        signature: signatureB64
    });

    const starOptions = {
        hostname: 'localhost',
        port: 3000,
        path: '/v1/botkit/star',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'Content-Length': Buffer.byteLength(starData)
        }
    };

    try {
        const res = await request(starOptions, starData);
        console.log(`Star Response: ${res.statusCode} ${res.body}`);

        if (res.statusCode === 401) {
            console.error('❌ Failed: 401 Unauthorized - Token rejected!');
            process.exit(1);
        } else if (res.statusCode === 404) {
             const body = JSON.parse(res.body);
             if (body.error === 'package_not_found') {
                 console.log('✅ Success: Token accepted, proceeded to logic (package not found).');
             } else {
                 console.log(`⚠️ Unexpected 404 error: ${body.error}`);
             }
        } else if (res.statusCode === 201 || res.statusCode === 200) {
            console.log('✅ Success: Starred.');
        } else {
             console.log(`Received ${res.statusCode}.`);
        }

    } catch (e) {
        console.error('Star request failed', e);
    }
}

run();
