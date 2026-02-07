/**
 * API Routes
 * Implements the Agent Git Registry Protocol endpoints
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const db = require('./db');
const { requireAuth, verifyPackageSignature } = require('./auth');

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

    const versionList = versions.map(v => v.version);
    const latest = versionList[0] || '0.0.0';

    res.json({
      name: pkg.name,
      versions: versionList,
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
 */
async function publishPackage(req, res) {
  try {
    const packageData = req.body.package;

    if (!packageData || !packageData.name || !packageData.version) {
      return res.status(400).json({
        error: 'invalid_request',
        message: 'Missing required fields: name, version'
      });
    }

    const { name, version, tarball, manifest, signature, hash } = packageData;

    // Verify signature against hash
    const publicKey = manifest.author.publicKey || manifest.author.signature?.replace(/^ed25519:/, '');

    if (!verifyPackageSignature(hash, signature, publicKey)) {
      return res.status(400).json({
        error: 'signature_invalid',
        message: 'Package signature verification failed'
      });
    }

    // Decode and verify tarball hash
    const tarballBuffer = Buffer.from(tarball, 'base64');
    const computedHash = `sha256:${crypto.createHash('sha256').update(tarballBuffer).digest('hex')}`;

    if (computedHash !== hash) {
      return res.status(400).json({
        error: 'hash_mismatch',
        message: `Hash mismatch. Expected ${hash}, got ${computedHash}`
      });
    }

    // Check if version already exists
    const existing = await db('versions')
      .where({ package_name: name, version })
      .first();

    if (existing) {
      return res.status(409).json({
        error: 'version_exists',
        message: `Version ${version} already published. Versions are immutable.`
      });
    }

    // Save tarball to storage
    const packageDir = path.join(PACKAGES_DIR, name);
    await fs.mkdir(packageDir, { recursive: true });

    const tarballFilename = `${version}.tgz`;
    const tarballPath = path.join(packageDir, tarballFilename);
    const relativePath = path.relative(STORAGE_DIR, tarballPath);

    await fs.writeFile(tarballPath, tarballBuffer);

    // Insert or update package metadata
    const packageExists = await db('packages').where({ name }).first();
    const authorHandle = manifest.author.name.startsWith('@') ? manifest.author.name : `@${manifest.author.name}`;

    if (!packageExists) {
      await db('packages').insert({
        name,
        description: manifest.description,
        author_name: manifest.author.name.replace('@', ''),
        author_url: manifest.author.url,
        author_public_key: publicKey,
        license: manifest.license,
        category: manifest.category,
        tags: JSON.stringify(manifest.tags || []),
        downloads: 0
      });
    } else {
      await db('packages').where({ name }).update({
        description: manifest.description,
        updated_at: db.fn.now()
      });
    }

    // Ensure agent exists
    const agentExists = await db('agents').where({ name: authorHandle }).first();
    if (!agentExists) {
      await db('agents').insert({
        name: authorHandle,
        public_key: publicKey,
        bio: `Autonomous agent publishing ${name}`,
        joined_at: db.fn.now()
      });
    }

    // Track Identity Key
    const { trackIdentityKey } = require('./identity');
    await trackIdentityKey(authorHandle, publicKey);

    // Insert version
    await db('versions').insert({
      package_name: name,
      version,
      storage_path: relativePath,
      hash,
      signature,
      manifest: JSON.stringify(manifest)
    });

    res.status(201).json({
      status: 'published',
      name,
      version,
      url: `${req.protocol}://${req.get('host')}/v1/packages/${name}/${version}`
    });

  } catch (error) {
    console.error('Publish error:', error);
    res.status(500).json({ error: 'publish_failed', message: error.message });
  }
}

/**
 * GET /v1/agents - List all agents
 */
async function listAgents(req, res) {
  try {
    const agents = await db('agents').select('*').orderBy('name', 'asc');

    const { getTrustScoreBreakdown } = require('./trust-score');

    const enhancedAgents = await Promise.all(agents.map(async (agent) => {
      const skillCount = await db('packages')
        .where({ author_name: agent.name.replace('@', '') })
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

    const skills = await db('packages').where({ author_name: name.replace('@', '') });

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
      .where({ author_name: name.replace('@', '') })
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

    // TODO: Verify signature before inserting
    await db('endorsements').insert({
      package_name: name,
      signer_name,
      signer_type,
      comment,
      signature,
      trust_level,
      created_at: db.fn.now()
    });

    res.status(201).json({ status: 'endorsed' });
  } catch (error) {
    res.status(500).json({ error: 'endorsement_failed', message: error.message });
  }
}

module.exports = {
  searchPackages,
  getPackageMetadata,
  getManifest,
  downloadTarball,
  publishPackage,
  requireAuth,
  getAgentProfile,
  getAgentManifest,
  listAgents,
  addEndorsement
};
