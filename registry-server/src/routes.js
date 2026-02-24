/**
 * API Routes
 * Implements the Agent Git Registry Protocol endpoints
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const db = require('./db');
const { requireAuth, verifyPackageSignature } = require('./auth');
const { logActivity, EVENT_TYPES } = require('./activity');
const { calculateVersionDiff } = require('./utils/version-diff');

const STORAGE_DIR = process.env.GITLOBSTER_STORAGE_DIR || path.join(__dirname, '../storage');
const PACKAGES_DIR = path.join(STORAGE_DIR, 'packages');

// Ensure packages directory exists
fs.mkdir(PACKAGES_DIR, { recursive: true }).catch(err => {
  if (err.code !== 'EEXIST') console.error('Error creating packages dir:', err);
});

/**
 * GET /v1/packages - Search packages
 */
async function searchPackages(req, res) {
  try {
    const { q, category, tag, limit = 20, offset = 0 } = req.query;

    let query = db('packages').select('*');

    if (q) {
      query = query.where(function () {
        this.where('name', 'like', `%${q}%`)
          .orWhere('description', 'like', `%${q}%`);
      });
    } else {
      // Hide system skills from default listing
      query = query.where('name', '!=', 'gitlobster-sync');
    }

    if (category) {
      query = query.where('category', category);
    }

    if (tag) {
      query = query.whereRaw('tags LIKE ?', [`%"${tag}"%`]);
    }

    const total = await query.clone().count('* as count').first();
    const results = await query.limit(parseInt(limit)).offset(parseInt(offset));

    // Parse JSON tags for each result
    const formatted = results.map(pkg => ({
      ...pkg,
      tags: JSON.parse(pkg.tags || '[]')
    }));

    res.json({
      results: formatted,
      total: total.count,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'search_failed', message: error.message });
  }
}

/**
 * GET /v1/packages/:name - Get package metadata
 */
async function getPackageMetadata(req, res) {
  console.log("getPackageMetadata params:", req.params);
  try {
    const { name } = req.params;

    const pkg = await db('packages').where({ name }).first();

    if (!pkg) {
      return res.status(404).json({
        error: 'package_not_found',
        message: `Package ${name} not found`
      });
    }

    // Get all versions
    const versions = await db('versions')
      .where({ package_name: name })
      .select('version', 'published_at')
      .orderBy('published_at', 'desc');

    const latest = versions[0]?.version || '0.0.0';

    // Count endorsements for this package
    const endorsementCount = await db('endorsements')
      .where({ package_name: name })
      .count('* as count')
      .first();

    // Check if this package is a fork
    const forkRecord = await db('forks').where({ forked_package: name }).first();

    // Count total forks of this package
    const forkCount = await db('forks')
      .where({ parent_package: name })
      .count('* as count')
      .first();

    res.json({
      name: pkg.name,
      versions: versions,
      latest,
      description: pkg.description,
      author: {
        name: pkg.author_name,
        url: pkg.author_url,
        publicKey: pkg.author_public_key
      },
      license: pkg.license,
      category: pkg.category,
      tags: JSON.parse(pkg.tags || '[]'),
      downloads: pkg.downloads,
      stars: pkg.stars || 0,
      agent_stars: pkg.agent_stars || 0,
      endorsement_count: endorsementCount.count || 0,
      // Fork metadata
      is_fork: !!forkRecord,
      parent_package: forkRecord?.parent_package || null,
      fork_reason: forkRecord?.fork_reason || null,
      fork_count: parseInt(forkCount?.count || 0),
      createdAt: pkg.created_at,
      updatedAt: pkg.updated_at
    });

  } catch (error) {
    console.error('Metadata error:', error);
    res.status(500).json({ error: 'metadata_failed', message: error.message });
  }
}

/**
 * GET /v1/packages/:name/:version/manifest - Get package manifest
 */
async function getManifest(req, res) {
  try {
    const { name, version } = req.params;

    const versionData = await db('versions')
      .where({ package_name: name, version })
      .first();

    if (!versionData) {
      return res.status(404).json({
        error: 'version_not_found',
        message: `Version ${version} of ${name} not found`
      });
    }

    const manifest = JSON.parse(versionData.manifest);

    res.json(manifest);

  } catch (error) {
    console.error('Manifest error:', error);
    res.status(500).json({ error: 'manifest_failed', message: error.message });
  }
}

/**
 * GET /v1/packages/:name/:version/tarball - Download package tarball
 */
async function downloadTarball(req, res) {
  try {
    let { name, version } = req.params;

    // Handle "latest" as a special case
    if (version === 'latest') {
      const latestVersion = await db('versions')
        .where({ package_name: name })
        .orderBy('published_at', 'desc')
        .first();

      if (!latestVersion) {
        return res.status(404).json({
          error: 'package_not_found',
          message: `Package ${name} has no published versions`
        });
      }

      version = latestVersion.version;
    }

    const versionData = await db('versions')
      .where({ package_name: name, version })
      .first();

    if (!versionData) {
      return res.status(404).json({
        error: 'version_not_found',
        message: `Version ${version} of ${name} not found`
      });
    }

    const tarballPath = path.join(STORAGE_DIR, versionData.storage_path);

    // Check if file exists
    try {
      await fs.access(tarballPath);
    } catch {
      return res.status(500).json({
        error: 'file_not_found',
        message: 'Package file missing from storage'
      });
    }

    // Increment download counter
    await db('packages').where({ name }).increment('downloads', 1);

    // Set headers
    const filename = `${name.replace(/[@\/]/g, '-')}-${version}.tgz`;
    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Package-Hash', versionData.hash);
    res.setHeader('X-Package-Signature', versionData.signature);

    // Stream file
    const fileStream = require('fs').createReadStream(tarballPath);
    fileStream.pipe(res);

  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'download_failed', message: error.message });
  }
}

/**
 * POST /v1/publish - Publish a package
 * 
 * @deprecated This endpoint is deprecated as of V2.5.
 * V2.5 uses Git push instead for package publishing.
 * This endpoint will be removed in a future version.
 * Use Git push to the repository instead: git push origin <package-name>
 * 
 * The server's post-receive hook will automatically process pushes.
 */

/**
 * GET /v1/agents - List all agents
 */
async function listAgents(req, res) {
  try {
    const agents = await db('agents').select('*').orderBy('name', 'asc');

    const { getTrustScoreBreakdown } = require('./trust-score');

    const enhancedAgents = await Promise.all(agents.map(async (agent) => {
      const skillCount = await db('packages')
        .where({ author_name: agent.name })
        .count('* as count')
        .first();

      const trustScore = await getTrustScoreBreakdown(agent.name);

      return {
        ...agent,
        metadata: JSON.parse(agent.metadata || '{}'),
        skills_count: skillCount.count,
        trust_score: trustScore.computed_score
      };
    }));

    res.json(enhancedAgents);
  } catch (error) {
    console.error('List agents error:', error);
    res.status(500).json({ error: 'list_agents_failed', message: error.message });
  }
}

/**
 * GET /v1/agents/:name - Get enhanced agent profile
 */
async function getAgentProfile(req, res) {
  try {
    const { name } = req.params;
    const agent = await db('agents').where({ name }).first();

    if (!agent) {
      return res.status(404).json({ error: 'agent_not_found', message: 'Agent not found' });
    }

    const rawSkills = await db('packages').where({ author_name: name });

    // Enhance skills with latest version and parsed tags
    const skills = await Promise.all(rawSkills.map(async (pkg) => {
      const latest = await db('versions')
        .where({ package_name: pkg.name })
        .orderBy('published_at', 'desc')
        .first();

      return {
        ...pkg,
        tags: typeof pkg.tags === 'string' ? JSON.parse(pkg.tags || '[]') : (pkg.tags || []),
        latest_version: latest ? latest.version : '0.0.0'
      };
    }));

    // Get identity metadata
    const { getIdentityMetadata } = require('./identity');
    const identityMeta = await getIdentityMetadata(name);

    // Get trust score breakdown
    const { getTrustScoreBreakdown } = require('./trust-score');
    const trustScore = await getTrustScoreBreakdown(name);

    res.json({
      ...agent,
      metadata: JSON.parse(agent.metadata || '{}'),
      skills,
      identity: identityMeta,
      trustScore: {
        overall: trustScore.computed_score,
        components: {
          capabilityReliability: trustScore.capability_reliability,
          reviewConsistency: trustScore.review_consistency,
          flagHistory: trustScore.flag_history_score,
          trustAnchorOverlap: trustScore.trust_anchor_overlap,
          timeInNetwork: trustScore.time_in_network
        },
        lastComputed: trustScore.last_computed
      }
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'profile_failed', message: error.message });
  }
}

/**
 * GET /v1/agents/:name/manifest.json - Get agent profile manifest (machine-readable)
 */
async function getAgentManifest(req, res) {
  try {
    const { name } = req.params;
    const agent = await db('agents').where({ name }).first();

    if (!agent) {
      return res.status(404).json({ error: 'agent_not_found', message: 'Agent not found' });
    }

    // Get identity metadata
    const { getIdentityMetadata } = require('./identity');
    const identityMeta = await getIdentityMetadata(name);

    // Get trust score
    const { getTrustScoreBreakdown } = require('./trust-score');
    const trustScore = await getTrustScoreBreakdown(name);

    // Get skill count
    const skillCount = await db('packages')
      .where({ author_name: name })
      .count('* as count')
      .first();

    // Machine-readable manifest
    res.json({
      schema_version: "1.0",
      agent_name: name,
      identity: {
        public_key: identityMeta.fullPublicKey,
        key_fingerprint: identityMeta.keyFingerprint,
        key_age_days: identityMeta.keyAge,
        continuity_status: identityMeta.continuity,
        continuity_score: identityMeta.continuityScore
      },
      trust_score: {
        overall: trustScore.computed_score,
        components: {
          capability_reliability: trustScore.capability_reliability,
          review_consistency: trustScore.review_consistency,
          flag_history: trustScore.flag_history_score,
          trust_anchor_overlap: trustScore.trust_anchor_overlap,
          time_in_network: trustScore.time_in_network
        }
      },
      statistics: {
        skill_count: skillCount.count,
        joined_at: agent.joined_at
      },
      trust_posture: determineTrustPosture(trustScore.computed_score),
      last_updated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Manifest error:', error);
    res.status(500).json({ error: 'manifest_failed', message: error.message });
  }
}

/**
 * Determine trust posture based on score
 */
function determineTrustPosture(score) {
  if (score >= 0.75) return 'conservative'; // High trust, low risk
  if (score >= 0.50) return 'balanced'; // Medium trust
  return 'experimental'; // Low trust, high risk
}

/**
 * POST /v1/packages/:name/endorse - Add an endorsement
 */
async function addEndorsement(req, res) {
  try {
    const { name } = req.params;
    const { signer_name, signer_type, comment, signature, trust_level } = req.body;

    // Verify package exists
    const pkg = await db('packages').where({ name }).first();
    if (!pkg) {
      return res.status(404).json({ error: 'package_not_found' });
    }

    // Get signer's public key
    let publicKey;
    if (signer_type === 'agent') {
      const agent = await db('agents').where({ name: signer_name }).first();
      if (!agent) {
        return res.status(404).json({ error: 'signer_not_found' });
      }
      publicKey = agent.public_key;
    } else {
      // For human signers, might need different lookup
      return res.status(400).json({ error: 'human_endorsements_not_yet_supported' });
    }

    // Verify the signature
    const message = `${name}:${comment}:${trust_level}`;
    const isValid = verifyPackageSignature(message, signature, publicKey);

    if (!isValid) {
      return res.status(400).json({ error: 'invalid_signature' });
    }

    // Insert verified endorsement
    await db('endorsements').insert({
      package_name: name,
      signer_name,
      signer_type,
      comment,
      signature,
      trust_level,
      created_at: db.fn.now()
    });

    // Log activity
    await logActivity('endorse', signer_name, name, 'package', { trust_level, comment });

    res.status(201).json({ status: 'endorsed' });
  } catch (error) {
    res.status(500).json({ error: 'endorsement_failed', message: error.message });
  }
}

/**
 * POST /v1/packages/:name/star - Star/favorite a package
 * Public endpoint - no authentication required (social feature for humans)
 */
async function starPackage(req, res) {
  try {
    const { name } = req.params;
    const { user_id } = req.body; // Browser-generated unique ID for anonymous users

    // Check if package exists
    const pkg = await db('packages').where({ name }).first();
    if (!pkg) {
      return res.status(404).json({ error: 'package_not_found' });
    }

    // Use authenticated agent name if available, otherwise use anonymous user_id
    const identifier = req.auth?.payload?.sub || user_id || 'anonymous';

    // Check if already starred
    const existing = await db('stars')
      .where({ agent_name: identifier, package_name: name })
      .first();

    if (existing) {
      return res.status(200).json({
        status: 'already_starred',
        starred_at: existing.starred_at,
        total_stars: pkg.stars || 0
      });
    }

    // Insert star record
    await db('stars').insert({
      agent_name: identifier,
      package_name: name,
      starred_at: db.fn.now()
    });

    // Increment star count on package
    await db('packages').where({ name }).increment('stars', 1);

    // Get updated count
    const updatedPkg = await db('packages').where({ name }).first();

    // Log activity
    await logActivity('star', identifier, name, 'package');

    res.status(201).json({
      status: 'starred',
      total_stars: updatedPkg.stars || 0
    });
  } catch (error) {
    res.status(500).json({ error: 'star_failed', message: error.message });
  }
}

/**
 * DELETE /v1/packages/:name/star - Unstar a package
 * Public endpoint - no authentication required
 */
async function unstarPackage(req, res) {
  try {
    const { name } = req.params;
    const { user_id } = req.body; // Browser-generated unique ID

    // Use authenticated agent name if available, otherwise use anonymous user_id
    const identifier = req.auth?.payload?.sub || user_id || 'anonymous';

    const deleted = await db('stars')
      .where({ agent_name: identifier, package_name: name })
      .delete();

    if (deleted === 0) {
      return res.status(404).json({ error: 'not_starred' });
    }

    // Decrement star count
    await db('packages').where({ name }).decrement('stars', 1);

    const pkg = await db('packages').where({ name }).first();

    // Log activity
    await logActivity('unstar', identifier, name, 'package');

    res.json({
      status: 'unstarred',
      total_stars: pkg.stars || 0
    });
  } catch (error) {
    res.status(500).json({ error: 'unstar_failed', message: error.message });
  }
}

/**
 * GET /v1/packages/:name/star - Check if current user starred this package
 * Accepts user_id query parameter for anonymous users
 */
async function checkStarred(req, res) {
  try {
    const { name } = req.params;
    const { user_id } = req.query;

    // Use authenticated agent name if available, otherwise use anonymous user_id
    const identifier = req.auth?.payload?.sub || user_id;

    if (!identifier) {
      return res.json({ starred: false });
    }

    const star = await db('stars')
      .where({ agent_name: identifier, package_name: name })
      .first();

    res.json({
      starred: !!star,
      starred_at: star?.starred_at || null
    });
  } catch (error) {
    res.status(500).json({ error: 'check_failed', message: error.message });
  }
}

/**
 * POST /v1/botkit/star - Agent-native star (cryptographically signed endorsement)
 * Requires authentication and Ed25519 signature verification
 * Creates a lightweight endorsement (endorsement_type='star', trust_level=1)
 */
async function botkitStar(req, res) {
  try {
    const { package_name, signature } = req.body;

    // Require authentication
    if (!req.auth?.payload?.sub) {
      return res.status(401).json({ error: 'authentication_required' });
    }

    const agentName = req.auth.payload.sub;

    // Check if package exists
    const pkg = await db('packages').where({ name: package_name }).first();
    if (!pkg) {
      return res.status(404).json({ error: 'package_not_found' });
    }

    // Get agent's public key
    const agent = await db('agents').where({ name: agentName }).first();
    if (!agent || !agent.public_key) {
      return res.status(404).json({ error: 'agent_not_found_or_no_public_key' });
    }

    // Verify signature
    const message = `star:${package_name}`;
    const isValid = verifyPackageSignature(message, signature, agent.public_key);

    if (!isValid) {
      return res.status(400).json({ error: 'invalid_signature' });
    }

    // Check if already starred by this agent
    const existingEndorsement = await db('endorsements')
      .where({
        package_name,
        signer_name: agentName,
        endorsement_type: 'star'
      })
      .first();

    if (existingEndorsement) {
      return res.status(200).json({
        status: 'already_starred',
        message: 'You already starred this package via botkit'
      });
    }

    // Create endorsement record with type='star'
    await db('endorsements').insert({
      package_name,
      signer_name: agentName,
      signer_type: 'agent',
      comment: 'Agent-verified star via botkit',
      signature,
      trust_level: 1, // Stars are lightweight trust signals
      endorsement_type: 'star',
      created_at: db.fn.now()
    });

    // Increment both counters: agent_stars (verified) and stars (total)
    await db('packages').where({ name: package_name }).increment({
      agent_stars: 1,
      stars: 1
    });

    // Get updated counts
    const updatedPkg = await db('packages').where({ name: package_name }).first();

    // Log activity
    await logActivity('star', agentName, package_name, 'package', { via: 'botkit' });

    res.status(201).json({
      status: 'starred',
      total_stars: updatedPkg.stars || 0,
      agent_stars: updatedPkg.agent_stars || 0,
      message: 'Package starred and cryptographically verified'
    });

  } catch (error) {
    console.error('Botkit star error:', error);
    res.status(500).json({ error: 'botkit_star_failed', message: error.message });
  }
}

/**
 * DELETE /v1/botkit/star - Unstar via botkit (removes endorsement)
 * Requires authentication
 */
async function botkitUnstar(req, res) {
  try {
    const { package_name } = req.body;

    if (!req.auth?.payload?.sub) {
      return res.status(401).json({ error: 'authentication_required' });
    }

    const agentName = req.auth.payload.sub;

    // Delete the endorsement
    const deleted = await db('endorsements')
      .where({
        package_name,
        signer_name: agentName,
        endorsement_type: 'star'
      })
      .delete();

    if (deleted === 0) {
      return res.status(404).json({ error: 'not_starred' });
    }

    // Decrement counters
    await db('packages').where({ name: package_name }).decrement({
      agent_stars: 1,
      stars: 1
    });

    const pkg = await db('packages').where({ name: package_name }).first();

    // Log activity
    await logActivity('unstar', agentName, package_name, 'package', { via: 'botkit' });

    res.json({
      status: 'unstarred',
      total_stars: pkg.stars || 0,
      agent_stars: pkg.agent_stars || 0
    });

  } catch (error) {
    res.status(500).json({ error: 'botkit_unstar_failed', message: error.message });
  }
}

/**
 * Inject forked_from lineage metadata into gitlobster.json in a bare Git repo.
 * Works by creating a new commit in the bare repo with the updated file.
 * Non-fatal: logs warnings on failure but doesn't abort the fork operation.
 *
 * @param {string} forkedGitPath - Absolute path to the forked bare repo
 * @param {string} parentPackage - Parent package name
 * @param {string} parentUUID - Parent package UUID (permanent lineage anchor)
 * @param {string} forkCommit - Commit hash at fork point
 * @param {string} latestVersion - Version at fork point
 * @param {string} forkedAt - ISO timestamp of fork
 * @returns {string|null} New commit hash or null on failure
 */
async function injectForkLineage(forkedGitPath, parentPackage, parentUUID, forkCommit, latestVersion, forkedAt) {
  const { execFileSync, spawnSync } = require('child_process');

  try {
    // Read current gitlobster.json from HEAD
    // Use execFileSync to avoid shell
    const currentContent = execFileSync('git', ['show', 'HEAD:gitlobster.json'], {
      cwd: forkedGitPath, encoding: 'utf-8'
    });
    const manifest = JSON.parse(currentContent);

    // Inject forked_from block (permanent lineage anchor)
    manifest.forked_from = {
      name: parentPackage,
      uuid: parentUUID,
      commit: forkCommit,
      version: latestVersion,
      forked_at: forkedAt
    };

    const newContent = JSON.stringify(manifest, null, 2) + '\n';

    // Write new blob object into the object store
    // Use spawnSync with input option to write to stdin, avoiding pipe and shell
    const hashObjectResult = spawnSync('git', ['hash-object', '-w', '--stdin'], {
      cwd: forkedGitPath,
      input: newContent,
      encoding: 'utf-8'
    });

    if (hashObjectResult.error) throw hashObjectResult.error;
    if (hashObjectResult.status !== 0) throw new Error(`git hash-object failed: ${hashObjectResult.stderr}`);

    const blobHash = hashObjectResult.stdout.trim();

    // Stage the updated file in the index
    execFileSync('git', ['read-tree', 'HEAD'], { cwd: forkedGitPath, stdio: 'ignore' });
    execFileSync('git', ['update-index', '--cacheinfo', `100644,${blobHash},gitlobster.json`], { cwd: forkedGitPath, stdio: 'ignore' });

    // Write new tree from the updated index
    const newTree = execFileSync('git', ['write-tree'], { cwd: forkedGitPath, encoding: 'utf-8' }).trim();

    // Create a new commit on top of HEAD with the updated tree
    const env = {
      ...process.env,
      GIT_AUTHOR_NAME: 'GitLobster Registry',
      GIT_AUTHOR_EMAIL: 'registry@gitlobster',
      GIT_COMMITTER_NAME: 'GitLobster Registry',
      GIT_COMMITTER_EMAIL: 'registry@gitlobster',
      GIT_DIR: forkedGitPath
    };

    // SECURITY: Use execFileSync with array args to prevent command injection via parentPackage
    const newCommit = execFileSync(
      'git',
      ['commit-tree', newTree, '-p', 'HEAD', '-m', `fork: inject lineage metadata from ${parentPackage}`],
      { cwd: forkedGitPath, encoding: 'utf-8', env }
    ).trim();

    // Update HEAD to the new commit
    execFileSync('git', ['update-ref', 'HEAD', newCommit], { cwd: forkedGitPath, stdio: 'ignore' });

    console.log(`[Fork] Injected forked_from lineage into gitlobster.json, new commit: ${newCommit}`);
    return newCommit;

  } catch (err) {
    console.warn(`[Fork] Warning: Could not inject lineage into gitlobster.json: ${err.message}`);
    return null;
  }
}

/**
 * POST /v1/botkit/fork - Fork a package (agent-native with signature)
 * Requires authentication and Ed25519 signature verification
 * Performs git clone --bare + injects forked_from lineage into gitlobster.json
 */
async function botkitFork(req, res) {
  const { execFile } = require('child_process');
  const util = require('util');
  const execFilePromise = util.promisify(execFile);

  // Import git-middleware helpers
  const { scopedToDirName, GIT_PROJECT_ROOT: GIT_DIR } = require('./git-middleware');

  try {
    const { parent_package, forked_package, fork_reason, signature } = req.body;

    // Require authentication
    if (!req.auth?.payload?.sub) {
      return res.status(401).json({ error: 'authentication_required' });
    }

    const agentName = req.auth.payload.sub;

    // Validate inputs
    if (!parent_package || !forked_package || !fork_reason || !signature) {
      return res.status(400).json({
        error: 'invalid_request',
        message: 'Missing required fields: parent_package, forked_package, fork_reason, signature'
      });
    }

    // Verify parent package exists
    const parentPkg = await db('packages').where({ name: parent_package }).first();
    if (!parentPkg) {
      return res.status(404).json({ error: 'parent_package_not_found' });
    }

    // Get latest version of parent
    const latestVersionRecord = await db('versions')
      .where({ package_name: parent_package })
      .orderBy('published_at', 'desc')
      .first();
    const latestVersion = latestVersionRecord?.version || '0.0.0';

    // Verify forked package doesn't already exist
    const existingForked = await db('packages').where({ name: forked_package }).first();
    if (existingForked) {
      return res.status(409).json({
        error: 'package_exists',
        message: `Package ${forked_package} already exists. Choose a different name.`
      });
    }

    // Scope validation: ensure agent can only create packages under their own scope
    const expectedScope = agentName.startsWith('@') ? agentName : `@${agentName}`;
    if (!forked_package.startsWith(expectedScope + '/')) {
      return res.status(403).json({
        error: 'scope_violation',
        message: `You can only create packages under your scope: ${expectedScope}/...`
      });
    }

    // Get agent's public key
    const agent = await db('agents').where({ name: agentName }).first();
    if (!agent || !agent.public_key) {
      return res.status(404).json({ error: 'agent_not_found_or_no_public_key' });
    }

    // Determine fork commit hash - attempt real git clone if parent repo exists
    let forkCommit = 'no_git_repo';
    const parentDirName = scopedToDirName(parent_package);
    const parentGitPath = path.join(GIT_DIR, parentDirName);
    const forkedDirName = scopedToDirName(forked_package);
    const forkedGitPath = path.join(GIT_DIR, forkedDirName);

    try {
      // Check if parent bare repo exists
      const parentExists = await fs.access(parentGitPath).then(() => true).catch(() => false);

      if (parentExists) {
        console.log(`[Fork] Parent git repo exists at ${parentGitPath}, cloning to ${forkedGitPath}`);

        // Clone parent bare repo to fork bare repo
        // SECURITY: Use execFile with array args to prevent command injection
        await execFilePromise('git', ['clone', '--bare', parentGitPath, forkedGitPath]);

        // Get the commit hash of the HEAD after clone
        const { stdout: headHash } = await execFilePromise(
          'git',
          ['rev-parse', 'HEAD'],
          { cwd: forkedGitPath }
        );
        forkCommit = headHash.trim();
        console.log(`[Fork] Cloned successfully, fork commit: ${forkCommit}`);

        // Inject forked_from lineage metadata into gitlobster.json in the cloned repo
        const parentUUID = parentPkg.uuid || parentPkg.name;
        const forkedAt = new Date().toISOString();
        await injectForkLineage(forkedGitPath, parent_package, parentUUID, forkCommit, latestVersion, forkedAt);
      } else {
        console.log(`[Fork] Parent git repo not found at ${parentGitPath}, using fallback`);
      }
    } catch (gitError) {
      // Git clone failed - fall back to no_git_repo
      console.error(`[Fork] Git clone failed: ${gitError.message}`);
      forkCommit = 'no_git_repo';
    }

    // Verify signature with the fork commit (real or placeholder)
    const message = `fork:${parent_package}:${forked_package}:${fork_reason}:${latestVersion}:${forkCommit}`;
    const isValid = verifyPackageSignature(message, signature, agent.public_key);

    if (!isValid) {
      // If clone failed and we have a real commit, try verification with placeholder
      if (forkCommit !== 'no_git_repo') {
        const fallbackMessage = `fork:${parent_package}:${forked_package}:${fork_reason}:${latestVersion}:no_git_repo`;
        const fallbackValid = verifyPackageSignature(fallbackMessage, signature, agent.public_key);
        if (!fallbackValid) {
          return res.status(400).json({ error: 'invalid_signature' });
        }
      } else {
        return res.status(400).json({ error: 'invalid_signature' });
      }
    }

    // Check for duplicate fork record
    const existingFork = await db('forks')
      .where({ parent_package, forked_package })
      .first();

    if (existingFork) {
      return res.status(409).json({
        error: 'fork_already_exists',
        message: 'This fork relationship already exists'
      });
    }

    // Insert fork record with real commit hash and parent UUID if available
    const forkUUID = crypto.randomUUID();
    await db('forks').insert({
      parent_package,
      forked_package,
      fork_reason,
      fork_point_version: latestVersion,
      fork_point_commit: forkCommit,
      forker_agent: agentName,
      signature,
      parent_uuid: parentPkg.uuid || null,
      forked_at: db.fn.now()
    });

    // Generate Git URL for the fork
    const gitUrl = `${req.protocol}://${req.get('host')}/git/${forkedDirName}`;

    res.status(201).json({
      status: 'forked',
      fork_uuid: forkUUID,
      parent_package,
      forked_package,
      fork_reason,
      fork_point_version: latestVersion,
      fork_point_commit: forkCommit,
      parent_uuid: parentPkg.uuid || null,
      forked_at: new Date().toISOString(),
      git_url: gitUrl,
      message: 'Package forked and cryptographically verified'
    });

    // Log activity
    await logActivity('fork', agentName, parent_package, 'package', { forked_package, fork_reason });

  } catch (error) {
    console.error('Botkit fork error:', error);
    res.status(500).json({ error: 'botkit_fork_failed', message: error.message });
  }
}



/**
 * GET /v1/packages/:name/:version/readme - Get README.md content
 * For transparency: Humans can view skill documentation
 */
async function getReadme(req, res) {
  try {
    let { name, version } = req.params;

    // Handle "latest" as a special case
    if (version === 'latest') {
      const latestVersion = await db('versions')
        .where({ package_name: name })
        .orderBy('published_at', 'desc')
        .first();

      if (!latestVersion) {
        return res.status(404).json({
          error: 'package_not_found',
          message: `Package ${name} has no published versions`
        });
      }

      version = latestVersion.version;
    }

    const versionData = await db('versions')
      .where({ package_name: name, version })
      .first();

    if (!versionData) {
      return res.status(404).json({
        error: 'version_not_found',
        message: `Version ${version} of ${name} not found`
      });
    }

    const manifest = JSON.parse(versionData.manifest);

    // README is optional in manifest
    if (!manifest.readme) {
      return res.status(404).json({
        error: 'readme_not_found',
        message: 'This package does not include a README'
      });
    }

    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.send(manifest.readme);

  } catch (error) {
    console.error('README error:', error);
    res.status(500).json({ error: 'readme_failed', message: error.message });
  }
}

/**
 * GET /v1/packages/:name/:version/skill-doc - Get SKILL.md content
 * For transparency: Humans can view skill specifications
 */
async function getSkillDoc(req, res) {
  try {
    let { name, version } = req.params;

    // Handle "latest" as a special case
    if (version === 'latest') {
      const latestVersion = await db('versions')
        .where({ package_name: name })
        .orderBy('published_at', 'desc')
        .first();

      if (!latestVersion) {
        return res.status(404).json({
          error: 'package_not_found',
          message: `Package ${name} has no published versions`
        });
      }

      version = latestVersion.version;
    }

    const versionData = await db('versions')
      .where({ package_name: name, version })
      .first();

    if (!versionData) {
      return res.status(404).json({
        error: 'version_not_found',
        message: `Version ${version} of ${name} not found`
      });
    }

    const manifest = JSON.parse(versionData.manifest);

    // SKILL.md is required per SSF spec
    if (!manifest.skillDoc && !manifest.skill_doc) {
      return res.status(404).json({
        error: 'skill_doc_not_found',
        message: 'This package does not include a SKILL.md'
      });
    }

    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.send(manifest.skillDoc || manifest.skill_doc);

  } catch (error) {
    console.error('SKILL.md error:', error);
    res.status(500).json({ error: 'skill_doc_failed', message: error.message });
  }
}

/**
 * POST /v1/packages/:name/observations - Create an observation
 * For transparency: Humans and agents can leave notes about skills
 */
async function createObservation(req, res) {
  try {
    const { name } = req.params;
    const { observer_name, observer_type, content, category, sentiment, signature } = req.body;

    // Validate package exists
    const pkg = await db('packages').where({ name }).first();
    if (!pkg) {
      return res.status(404).json({
        error: 'package_not_found',
        message: `Package ${name} not found`
      });
    }

    // Validate input
    if (!observer_name || !observer_type || !content) {
      return res.status(400).json({
        error: 'invalid_input',
        message: 'observer_name, observer_type, and content are required'
      });
    }

    if (!['human', 'agent'].includes(observer_type)) {
      return res.status(400).json({
        error: 'invalid_observer_type',
        message: 'observer_type must be "human" or "agent"'
      });
    }

    // Insert observation
    const [id] = await db('observations').insert({
      package_name: name,
      observer_name,
      observer_type,
      content,
      category: category || 'general',
      sentiment: sentiment || 'neutral',
      signature
    });

    // Log activity
    await logActivity('observe', observer_name, name, 'package', { category, sentiment, observer_type });

    res.status(201).json({
      id,
      message: 'Observation created successfully'
    });

  } catch (error) {
    console.error('Create observation error:', error);
    res.status(500).json({ error: 'observation_failed', message: error.message });
  }
}

/**
 * GET /v1/packages/:name/observations - List observations for a package
 */
async function listObservations(req, res) {
  try {
    const { name } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    // Validate package exists
    const pkg = await db('packages').where({ name }).first();
    if (!pkg) {
      return res.status(404).json({
        error: 'package_not_found',
        message: `Package ${name} not found`
      });
    }

    const observations = await db('observations')
      .where({ package_name: name })
      .orderBy('created_at', 'desc')
      .limit(parseInt(limit))
      .offset(parseInt(offset));

    const total = await db('observations')
      .where({ package_name: name })
      .count('* as count')
      .first();

    res.json({
      observations,
      total: total.count,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    console.error('List observations error:', error);
    res.status(500).json({ error: 'list_observations_failed', message: error.message });
  }
}


/**
 * GET /v1/packages/:name/:version/file-manifest - Get signed file manifest
 * Allows downloaders to inspect declared files BEFORE downloading the tarball
 */
async function getFileManifest(req, res) {
  try {
    let { name, version } = req.params;

    // Handle "latest"
    if (version === 'latest') {
      const latestVersion = await db('versions')
        .where({ package_name: name })
        .orderBy('published_at', 'desc')
        .first();

      if (!latestVersion) {
        return res.status(404).json({
          error: 'package_not_found',
          message: `Package ${name} has no published versions`
        });
      }

      version = latestVersion.version;
    }

    const versionData = await db('versions')
      .where({ package_name: name, version })
      .first();

    if (!versionData) {
      return res.status(404).json({
        error: 'version_not_found',
        message: `Version ${version} of ${name} not found`
      });
    }

    const fileManifest = versionData.file_manifest ? JSON.parse(versionData.file_manifest) : null;

    if (!fileManifest) {
      return res.status(404).json({
        error: 'no_file_manifest',
        message: 'This version was published before file manifests were required'
      });
    }

    res.json({
      package_name: name,
      version,
      file_manifest: fileManifest,
      manifest_signature: versionData.manifest_signature,
      tarball_hash: versionData.hash,
      publisher_public_key: (await db('packages').where({ name }).first())?.author_public_key
    });

  } catch (error) {
    console.error('File manifest error:', error);
    res.status(500).json({ error: 'file_manifest_failed', message: error.message });
  }
}

/**
 * POST /v1/packages/:name/flag - Flag a package for integrity issues
 * When a downloader finds a mismatch between file_manifest and actual tarball contents,
 * they can report it here. This impacts the publisher's trust score.
 */
async function flagPackage(req, res) {
  try {
    const { name } = req.params;
    const { reason, evidence, reporter_name, reporter_type, signature } = req.body;

    // Validate required fields
    if (!reason || !reporter_name || !reporter_type) {
      return res.status(400).json({
        error: 'invalid_request',
        message: 'Missing required fields: reason, reporter_name, reporter_type'
      });
    }

    if (!['human', 'agent'].includes(reporter_type)) {
      return res.status(400).json({
        error: 'invalid_reporter_type',
        message: 'reporter_type must be "human" or "agent"'
      });
    }

    // Check package exists
    const pkg = await db('packages').where({ name }).first();
    if (!pkg) {
      return res.status(404).json({ error: 'package_not_found' });
    }

    // Insert flag record
    await db('flags').insert({
      package_name: name,
      reporter_name,
      reporter_type,
      reason,
      evidence: JSON.stringify(evidence || {}),
      signature: signature || null,
      status: 'open',
      created_at: db.fn.now()
    });

    // Impact trust score: increment flag count on the publisher agent
    const authorHandle = pkg.author_name.startsWith('@') ? pkg.author_name : `@${pkg.author_name}`;
    const trustScore = await db('trust_score_components').where({ agent_name: authorHandle }).first();
    if (trustScore) {
      // Reduce flag_history_score (starts at 1.0, decreases with each flag)
      const newFlagScore = Math.max(0, (trustScore.flag_history_score || 1.0) - 0.1);
      await db('trust_score_components').where({ agent_name: authorHandle }).update({
        flag_history_score: newFlagScore,
        last_computed: db.fn.now()
      });
    }

    // Log activity
    // Log activity (replaces old direct insert)
    await logActivity('flag', reporter_name, name, 'package', { reason, reporter_type });

    res.status(201).json({
      status: 'flagged',
      message: `Package ${name} has been flagged. Publisher trust score has been impacted.`,
      package_name: name,
      reason
    });

  } catch (error) {
    console.error('Flag error:', error);
    res.status(500).json({ error: 'flag_failed', message: error.message });
  }
}

/**
 * GET /v1/activity - Live Activity Feed
 * Paginated, filterable, searchable feed of all registry actions.
 */
async function getActivityFeed(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));
    const offset = (page - 1) * limit;
    const { agent, type, q } = req.query;

    // Build query
    let query = db('agent_activity_log').orderBy('timestamp', 'desc');
    let countQuery = db('agent_activity_log');

    // Filter by agent
    if (agent) {
      const agentFilter = agent.startsWith('@') ? agent : `@${agent}`;
      query = query.where('agent_name', agentFilter);
      countQuery = countQuery.where('agent_name', agentFilter);
    }

    // Filter by event type
    if (type) {
      query = query.where('activity_type', type);
      countQuery = countQuery.where('activity_type', type);
    }

    // Search target field
    if (q) {
      query = query.where('target', 'like', `%${q}%`);
      countQuery = countQuery.where('target', 'like', `%${q}%`);
    }

    // Get total count
    const [{ count: total }] = await countQuery.count('* as count');

    // Get paginated results
    const results = await query.limit(limit).offset(offset);

    // Enrich results with event type metadata
    const enriched = results.map(row => ({
      id: row.id,
      agent_name: row.agent_name,
      activity_type: row.activity_type,
      target: row.target,
      target_type: row.target_type || 'package',
      details: row.details ? JSON.parse(row.details) : {},
      timestamp: row.timestamp,
      meta: EVENT_TYPES[row.activity_type] || { icon: '📋', verb: row.activity_type, color: 'zinc' }
    }));

    const pages = Math.ceil(total / limit);

    res.json({
      results: enriched,
      total,
      page,
      pages,
      limit,
      event_types: EVENT_TYPES
    });

  } catch (error) {
    console.error('Activity feed error:', error);
    res.status(500).json({ error: 'activity_feed_failed', message: error.message });
  }
}

/**
 * GET /v1/packages/:name/diff - Compare two versions of a package
 * Query params: base (version or "latest"), head (version or "latest")
 * Returns detailed structural, metadata, and permission differences.
 */
async function getVersionDiff(req, res) {
  try {
    const { name } = req.params;
    const { base, head } = req.query;

    // Validate required parameters
    if (!base || !head) {
      return res.status(400).json({
        error: 'missing_parameters',
        message: 'Both "base" and "head" query parameters are required',
        example: '/v1/packages/@scope/name/diff?base=1.0.0&head=1.1.0'
      });
    }

    // Check package exists
    const pkg = await db('packages').where({ name }).first();
    if (!pkg) {
      return res.status(404).json({
        error: 'package_not_found',
        message: `Package ${name} not found`
      });
    }

    // Resolve version names (support "latest")
    const allVersions = await db('versions')
      .where({ package_name: name })
      .orderBy('published_at', 'desc');

    if (allVersions.length === 0) {
      return res.status(404).json({
        error: 'no_versions',
        message: `Package ${name} has no published versions`
      });
    }

    // Helper to resolve version identifier
    const resolveVersion = (identifier) => {
      if (identifier === 'latest') {
        return allVersions[0];
      }
      return allVersions.find(v => v.version === identifier);
    };

    const baseVersion = resolveVersion(base);
    const headVersion = resolveVersion(head);

    // Validate both versions exist
    if (!baseVersion) {
      return res.status(404).json({
        error: 'version_not_found',
        message: `Base version "${base}" not found for package ${name}`
      });
    }

    if (!headVersion) {
      return res.status(404).json({
        error: 'version_not_found',
        message: `Head version "${head}" not found for package ${name}`
      });
    }

    // Calculate diff
    const diff = calculateVersionDiff(baseVersion, headVersion);

    // Check for errors from diff calculation
    if (diff.error) {
      return res.status(400).json(diff);
    }

    // Log the diff request as activity
    await logActivity(
      'diff_viewed',
      'system',
      name,
      'package',
      {
        base_version: baseVersion.version,
        head_version: headVersion.version
      }
    );

    res.json({
      package: name,
      author: pkg.author_name,
      diff,
      timestamps: {
        base_published: baseVersion.published_at,
        head_published: headVersion.published_at
      }
    });

  } catch (error) {
    console.error('Version diff error:', error);
    res.status(500).json({
      error: 'diff_calculation_failed',
      message: error.message
    });
  }
}

module.exports = {
  searchPackages,
  getPackageMetadata,
  getManifest,
  downloadTarball,
  getReadme,
  getSkillDoc,
  createObservation,
  listObservations,
  requireAuth,
  getAgentProfile,
  getAgentManifest,
  listAgents,
  addEndorsement,
  starPackage,
  unstarPackage,
  checkStarred,
  getFileManifest,
  flagPackage,
  getActivityFeed,
  getVersionDiff,
  getPackageLineage,
  getTrustRoot
};

/**
 * GET /v1/trust/root - Get node's public identity
 */
async function getTrustRoot(req, res) {
  try {
    const KeyManager = require('./trust/KeyManager');
    const identity = KeyManager.getNodeIdentity();
    res.json({
      public_key: identity.publicKey,
      fingerprint: identity.fingerprint,
      created: identity.created,
      node_type: 'self_verified'
    });
  } catch (error) {
    console.error('Trust root error:', error);
    res.status(500).json({ error: 'trust_root_failed', message: error.message });
  }
}

// Get package lineage (forks and ancestry)
// Get package lineage (forks and ancestry)
async function getPackageLineage(req, res) {
  const { name } = req.params;
  const { direction = 'both', depth = 5 } = req.query;

  try {
    // Get current package info - use direct Knex query
    const pkg = await db('packages').where({ name }).first();
    if (!pkg) {
      return res.status(404).json({ error: 'package_not_found' });
    }

    // Get ancestors (parent packages - packages this was forked from)
    let ancestors = [];

    // Query forks table to find if this package was forked from something
    const forkRecord = await db('forks').where({ forked_package: name }).first();
    if (forkRecord) {
      // Get parent package info
      const parentPkg = await db('packages').where({ name: forkRecord.parent_package }).first();
      ancestors = [{
        package: forkRecord.parent_package,
        forkPointVersion: forkRecord.fork_point_version || '1.0.0',
        signatureValid: !!forkRecord.signature,
        author: parentPkg ? {
          fingerprint: parentPkg.author_public_key ? parentPkg.author_public_key.slice(0, 12) : null
        } : null
      }];
    }

    // Get descendants (forks - packages forked from this)
    // Use direct Knex query with limit
    const forks = await db('forks')
      .where({ parent_package: name })
      .limit(parseInt(depth));

    // Get package details for each fork
    const descendants = await Promise.all(forks.map(async (fork) => {
      const forkedPkg = await db('packages').where({ name: fork.forked_package }).first();
      return {
        package: fork.forked_package,
        forkReason: fork.fork_reason,
        forkerAgent: fork.forker_agent,
        signatureValid: !!fork.signature,
        signatureStatus: fork.signature ? 'verified' : 'unverified',
        author: forkedPkg?.author_public_key ? {
          fingerprint: forkedPkg.author_public_key.slice(0, 12)
        } : null
      };
    }));

    res.json({
      package: {
        name: pkg.name,
        uuid: pkg.uuid || null,
        is_fork: !!forkRecord
      },
      fork_badge: forkRecord ? {
        forked_from_name: forkRecord.parent_package,
        forked_from_uuid: forkRecord.parent_uuid || null,
        fork_point_version: forkRecord.fork_point_version,
        fork_point_commit: forkRecord.fork_point_commit,
        forked_at: forkRecord.forked_at,
        display: `🍴 Forked from ${forkRecord.parent_package} (v${forkRecord.fork_point_version})`
      } : null,
      author: {
        name: pkg.author_name,
        publicKey: pkg.author_public_key,
        fingerprint: pkg.author_public_key ? pkg.author_public_key.slice(0, 12) : null
      },
      ancestors,
      descendants,
      trust: {
        totalForks: descendants.length,
        verifiedSignatures: descendants.filter(d => d.signatureValid).length
      }
    });
  } catch (error) {
    console.error('Lineage error:', error);
    res.status(500).json({ error: 'lineage_failed', message: error.message });
  }
}

