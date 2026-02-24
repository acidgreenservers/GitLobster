const path = require('path');
const crypto = require('crypto');
const db = require('../../db');
const { verifyPackageSignature } = require('../../auth');
const { logActivity } = require('../../activity');
const { scopedToDirName, GIT_PROJECT_ROOT: GIT_DIR } = require('../../git-middleware');
const { execFileSync, spawnSync, execFile } = require('child_process');
const util = require('util');
const execFilePromise = util.promisify(execFile);

async function injectForkLineage(forkedGitPath, parentPackage, parentUUID, forkCommit, latestVersion, forkedAt) {
        const currentContent = execFileSync('git', ['show', 'HEAD:gitlobster.json'], {
            cwd: forkedGitPath, encoding: 'utf-8'
        });
        const manifest = JSON.parse(currentContent);

        manifest.forked_from = {
            name: parentPackage, uuid: parentUUID, commit: forkCommit,
            version: latestVersion, forked_at: forkedAt
        };

        const newContent = JSON.stringify(manifest, null, 2) + '\n';
        // Use spawnSync with input option to write to stdin, avoiding pipe and shell
        const hashObjectResult = spawnSync('git', ['hash-object', '-w', '--stdin'], {
            cwd: forkedGitPath,
            input: newContent,
            encoding: 'utf-8'
        });

        if (hashObjectResult.error) throw hashObjectResult.error;
        if (hashObjectResult.status !== 0) throw new Error(`git hash-object failed: ${hashObjectResult.stderr}`);

        const blobHash = hashObjectResult.stdout.trim();

        execFileSync('git', ['read-tree', 'HEAD'], { cwd: forkedGitPath, stdio: 'ignore' });
        execFileSync('git', ['update-index', '--cacheinfo', `100644,${blobHash},gitlobster.json`], { cwd: forkedGitPath, stdio: 'ignore' });
        const newTree = execFileSync('git', ['write-tree'], { cwd: forkedGitPath, encoding: 'utf-8' }).trim();

        const env = {
            ...process.env, GIT_AUTHOR_NAME: 'GitLobster Registry',
            GIT_AUTHOR_EMAIL: 'registry@gitlobster', GIT_COMMITTER_NAME: 'GitLobster Registry',
            GIT_COMMITTER_EMAIL: 'registry@gitlobster', GIT_DIR: forkedGitPath
        };

        // SECURITY: Use execFileSync with array args to prevent command injection via parentPackage
        const newCommit = execFileSync(
            'git',
            ['commit-tree', newTree, '-p', 'HEAD', '-m', `fork: inject lineage metadata from ${parentPackage}`],
            { cwd: forkedGitPath, encoding: 'utf-8', env }
        ).trim();

        execFileSync('git', ['update-ref', 'HEAD', newCommit], { cwd: forkedGitPath, stdio: 'ignore' });
        console.log(`[Fork] Injected forked_from lineage into gitlobster.json, new commit: ${newCommit}`);
        return newCommit;
    } catch (err) {
        console.warn(`[Fork] Warning: Could not inject lineage into gitlobster.json: ${err.message}`);
        return null;
    }
}

async function botkitFork(agentName, parent_package, forked_package, fork_reason, signature, reqProtocol, reqHost) {
    const parentPkg = await db('packages').where({ name: parent_package }).first();
    if (!parentPkg) { throw { statusCode: 404, error: 'parent_package_not_found' }; }

    const latestVersionRecord = await db('versions').where({ package_name: parent_package }).orderBy('published_at', 'desc').first();
    const latestVersion = latestVersionRecord?.version || '0.0.0';

    const existingForked = await db('packages').where({ name: forked_package }).first();
    if (existingForked) {
        throw { statusCode: 409, error: 'package_exists', message: `Package ${forked_package} already exists.` };
    }

    const expectedScope = agentName.startsWith('@') ? agentName : `@${agentName}`;
    if (!forked_package.startsWith(expectedScope + '/')) {
        throw { statusCode: 403, error: 'scope_violation', message: `You can only create packages under your scope: ${expectedScope}/...` };
    }

    const agent = await db('agents').where({ name: agentName }).first();
    if (!agent || !agent.public_key) { throw { statusCode: 404, error: 'agent_not_found_or_no_public_key' }; }

    let forkCommit = 'no_git_repo';
    const parentDirName = scopedToDirName(parent_package);
    const parentGitPath = path.join(GIT_DIR, parentDirName);
    const forkedDirName = scopedToDirName(forked_package);
    const forkedGitPath = path.join(GIT_DIR, forkedDirName);
    const fs = require('fs').promises;

    try {
        const parentExists = await fs.access(parentGitPath).then(() => true).catch(() => false);
        if (parentExists) {
            await execFilePromise('git', ['clone', '--bare', parentGitPath, forkedGitPath]);
            const { stdout: headHash } = await execFilePromise('git', ['rev-parse', 'HEAD'], { cwd: forkedGitPath });
            forkCommit = headHash.trim();
            const parentUUID = parentPkg.uuid || parentPkg.name;
            const forkedAt = new Date().toISOString();
            await injectForkLineage(forkedGitPath, parent_package, parentUUID, forkCommit, latestVersion, forkedAt);
        }
    } catch (gitError) {
        console.error(`[Fork] Git clone failed: ${gitError.message}`);
        forkCommit = 'no_git_repo';
    }

    const message = `fork:${parent_package}:${forked_package}:${fork_reason}:${latestVersion}:${forkCommit}`;
    const isValid = verifyPackageSignature(message, signature, agent.public_key);
    if (!isValid) {
        if (forkCommit !== 'no_git_repo') {
            const fallbackMessage = `fork:${parent_package}:${forked_package}:${fork_reason}:${latestVersion}:no_git_repo`;
            const fallbackValid = verifyPackageSignature(fallbackMessage, signature, agent.public_key);
            if (!fallbackValid) { throw { statusCode: 400, error: 'invalid_signature' }; }
        } else {
            throw { statusCode: 400, error: 'invalid_signature' };
        }
    }

    const existingFork = await db('forks').where({ parent_package, forked_package }).first();
    if (existingFork) { throw { statusCode: 409, error: 'fork_already_exists', message: 'This fork relationship already exists' }; }

    const forkUUID = crypto.randomUUID();
    await db('forks').insert({
        parent_package, forked_package, fork_reason, fork_point_version: latestVersion,
        fork_point_commit: forkCommit, forker_agent: agentName, signature,
        parent_uuid: parentPkg.uuid || null, forked_at: db.fn.now()
    });

    const gitUrl = `${reqProtocol}://${reqHost}/git/${forkedDirName}`;
    await logActivity('fork', agentName, parent_package, 'package', { forked_package, fork_reason });

    return {
        statusCode: 201,
        data: {
            status: 'forked', fork_uuid: forkUUID, parent_package, forked_package, fork_reason,
            fork_point_version: latestVersion, fork_point_commit: forkCommit,
            parent_uuid: parentPkg.uuid || null, forked_at: new Date().toISOString(),
            git_url: gitUrl, message: 'Package forked and cryptographically verified'
        }
    };
}

module.exports = {
    injectForkLineage,
    botkitFork
};
