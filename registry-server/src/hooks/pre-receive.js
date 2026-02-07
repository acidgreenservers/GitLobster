const fs = require('fs');
const { execSync } = require('child_process');

// 🛡️ GitLobster Security Hook: Enforce Commit Signing
// Rejects any push that contains unsigned commits.

const ZERO_OID = '0000000000000000000000000000000000000000';

function readStdin() {
    return fs.readFileSync(0, 'utf-8');
}

function checkSignatures(oldSha, newSha, refName) {
    if (newSha === ZERO_OID) {
        // Deletion - allow (subject to other permissions, but signatures irrelevant)
        return true;
    }

    let range;
    if (oldSha === ZERO_OID) {
        // New branch - check all commits reachable from newSha not reachable from other branches?
        // Actually, just checking newSha is often enough for simple enforcement, 
        // but robustly we should check all new commits.
        // For 'pre-receive', we can check commits not in --not --all? 
        // Simplest strict mode: just check the tip. If tip is signed, history is chained.
        // GitLobster Spec usually implies chain of trust.
        // Let's check the revisions introduced.
        // 'git rev-list newSha --not --all' gives new commits.
        try {
            // Note: --not --all might correspond to existing refs. 
            // If this is the FIRST push, --not --all covers nothing.
            range = newSha; // Just check the tip for simplest MVP start, or rev-list logic.

            // Better: Get list of commits to check
            // For new branch: newSha
            // For update: oldSha..newSha
        } catch (e) {
            range = newSha;
        }
    } else {
        range = `${oldSha}..${newSha}`;
    }

    // Get all commits in range
    // Format: %H (hash) %G? (signature status) %GP (signer fingerprint)
    try {
        const cmd = `git log --format="%H %G? %GP" ${oldSha === ZERO_OID ? newSha + ' --not --all' : range}`;
        const output = execSync(cmd, { encoding: 'utf-8' });

        const lines = output.trim().split('\n');

        for (const line of lines) {
            if (!line) continue;
            const [hash, status, fingerprint] = line.split(' ');

            // Assessment
            // G: Good
            // U: Untrusted (Good signature, unknown key) -> ACCEPT for now (Registry verifies key identity later)
            // B: Bad -> REJECT
            // N: None -> REJECT
            // X, Y, R, E -> REJECT

            if (status === 'B') {
                console.log(`❌ [GitLobster] Commit ${hash} has a BAD signature.`);
                return false;
            }
            if (status === 'N') {
                console.log(`❌ [GitLobster] Commit ${hash} is UNSIGNED. All commits must be signed (Ed25519).`);
                return false;
            }
            // Strict mode: might require G/U.
            if (!['G', 'U'].includes(status)) {
                console.log(`❌ [GitLobster] Commit ${hash} signature status '${status}' is not acceptable.`);
                return false;
            }
        }

        return true;

    } catch (e) {
        // If git log fails (e.g. valid range issue), be conservative?
        // Or maybe it's just empty range.
        if (oldSha === ZERO_OID && range.includes('--not --all')) {
            // Fallback for first push
            const fallbackCmd = `git log --format="%H %G? %GP" -n 1 ${newSha}`;
            // Logic repeated... simplified for this script length
        }
        console.error('Error verifying signatures:', e.message);
        return false;
    }
}

const input = readStdin();
const lines = input.trim().split('\n');

function checkStructure(newSha, refName) {
    if (newSha === ZERO_OID) return true; // Deletion

    // Only enforce mandatory manifest on main branches?
    // Or all branches? Let's enforce on standard branches to prevent pollution.
    const isMainBranch = refName === 'refs/heads/master' || refName === 'refs/heads/main';

    if (!isMainBranch) return true;

    // check if manifest.json exists
    try {
        // git cat-file -e $newSha:manifest.json
        // But git show $newSha:manifest.json is easier to read content too
        execSync(`git cat-file -e ${newSha}:manifest.json`, { stdio: 'ignore' });

        // It exists, now read and parse
        try {
            const content = execSync(`git show ${newSha}:manifest.json`, { encoding: 'utf-8' });
            JSON.parse(content);
            return true;
        } catch (parseErr) {
            console.log(`❌ [GitLobster] manifest.json is invalid JSON.`);
            return false;
        }
    } catch (e) {
        // Does not exist
        console.log(`❌ [GitLobster] Missing 'manifest.json' at root. Required for all packages.`);
        return false;
    }
}

let allGood = true;

for (const line of lines) {
    const [oldSha, newSha, refName] = line.split(' ');

    if (!checkSignatures(oldSha, newSha, refName)) {
        allGood = false;
        break; // Fail fast
    }

    if (!checkStructure(newSha, refName)) {
        allGood = false;
        break;
    }
}

if (!allGood) {
    console.log('🚫 Push rejected by GitLobster Trust Enforcer.');
    process.exit(1);
}

process.exit(0);
