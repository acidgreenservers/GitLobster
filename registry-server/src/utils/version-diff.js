/**
 * GitLobster Version Diff Engine
 * Calculates semantic differences between two package versions.
 * Used for trust visualization and change tracking.
 */

const { calculatePermissionDiff } = require('./trust-diff');

/**
 * Compare SHA-256 hashes of two file manifests
 * @param {Object} baseFileManifest - Base version's file manifest
 * @param {Object} headFileManifest - Head version's file manifest
 * @returns {Object} { changed, unchanged, added, removed, summary }
 */
function calculateFileDiff(baseFileManifest, headFileManifest) {
  if (!baseFileManifest || !headFileManifest) {
    return {
      changed: [],
      unchanged: [],
      added: [],
      removed: [],
      summary: 'incomplete_manifest'
    };
  }

  const diff = {
    changed: [],
    unchanged: [],
    added: [],
    removed: [],
    summary: 'no_changes'
  };

  const baseFiles = baseFileManifest.files || {};
  const headFiles = headFileManifest.files || {};

  // Track which files we've compared
  const compared = new Set();

  // Check for changed and unchanged files
  for (const [filePath, baseEntry] of Object.entries(baseFiles)) {
    compared.add(filePath);
    const headEntry = headFiles[filePath];

    if (!headEntry) {
      // File was removed
      diff.removed.push({
        path: filePath,
        base_hash: baseEntry.hash,
        reason: 'deleted'
      });
    } else if (baseEntry.hash === headEntry.hash) {
      // File unchanged
      diff.unchanged.push(filePath);
    } else {
      // File changed
      diff.changed.push({
        path: filePath,
        base_hash: baseEntry.hash,
        head_hash: headEntry.hash,
        reason: 'modified'
      });
    }
  }

  // Check for added files (in head but not in base)
  for (const [filePath, headEntry] of Object.entries(headFiles)) {
    if (!compared.has(filePath)) {
      diff.added.push({
        path: filePath,
        head_hash: headEntry.hash,
        reason: 'added'
      });
    }
  }

  // Determine summary
  if (diff.changed.length > 0 || diff.added.length > 0 || diff.removed.length > 0) {
    if (diff.changed.length > 0 && diff.added.length === 0 && diff.removed.length === 0) {
      diff.summary = 'files_modified';
    } else if (diff.added.length > 0 && diff.changed.length === 0 && diff.removed.length === 0) {
      diff.summary = 'files_added';
    } else if (diff.removed.length > 0 && diff.changed.length === 0 && diff.added.length === 0) {
      diff.summary = 'files_removed';
    } else {
      diff.summary = 'mixed_changes';
    }
  }

  return diff;
}

/**
 * Compare metadata between two versions
 * @param {Object} baseMeta - Base version metadata
 * @param {Object} headMeta - Head version metadata
 * @returns {Object} { description_changed, tags_changed, changelog, summary }
 */
function calculateMetadataDiff(baseMeta, headMeta) {
  if (!baseMeta || !headMeta) {
    return {
      description_changed: null,
      tags_changed: { added: [], removed: [] },
      changelog: headMeta?.changelog || null,
      summary: 'incomplete_metadata'
    };
  }

  const diff = {
    description_changed: false,
    description_old: baseMeta.description,
    description_new: headMeta.description,
    tags_changed: { added: [], removed: [] },
    changelog: headMeta.changelog || null,
    summary: 'no_metadata_changes'
  };

  // Check description change
  if (baseMeta.description !== headMeta.description) {
    diff.description_changed = true;
  }

  // Check tag changes
  const baseTags = new Set(baseMeta.tags || []);
  const headTags = new Set(headMeta.tags || []);

  for (const tag of headTags) {
    if (!baseTags.has(tag)) {
      diff.tags_changed.added.push(tag);
    }
  }

  for (const tag of baseTags) {
    if (!headTags.has(tag)) {
      diff.tags_changed.removed.push(tag);
    }
  }

  // Determine summary
  if (diff.description_changed || diff.tags_changed.added.length > 0 || diff.tags_changed.removed.length > 0) {
    if (diff.description_changed && diff.tags_changed.added.length === 0 && diff.tags_changed.removed.length === 0) {
      diff.summary = 'description_updated';
    } else if (!diff.description_changed && (diff.tags_changed.added.length > 0 || diff.tags_changed.removed.length > 0)) {
      diff.summary = 'tags_updated';
    } else {
      diff.summary = 'metadata_updated';
    }
  }

  return diff;
}

/**
 * Calculate comprehensive version diff
 * Main orchestrator that combines file, metadata, and permission diffs
 * @param {Object} baseVersion - Base version record from DB
 * @param {Object} headVersion - Head version record from DB
 * @returns {Object} { file_diff, metadata_diff, permission_diff, summary, risk_level }
 */
function calculateVersionDiff(baseVersion, headVersion) {
  if (!baseVersion || !headVersion) {
    return {
      error: 'missing_version',
      message: 'Both base and head versions are required'
    };
  }

  // Prevent comparing same version to itself
  if (baseVersion.version === headVersion.version) {
    return {
      error: 'same_version',
      message: 'Cannot compare a version to itself',
      version: baseVersion.version
    };
  }

  // Extract manifest data from JSON
  const baseManifest = typeof baseVersion.manifest === 'string'
    ? JSON.parse(baseVersion.manifest)
    : baseVersion.manifest || {};

  const headManifest = typeof headVersion.manifest === 'string'
    ? JSON.parse(headVersion.manifest)
    : headVersion.manifest || {};

  // Calculate file differences
  const fileDiff = calculateFileDiff(
    baseManifest.file_manifest,
    headManifest.file_manifest
  );

  // Calculate metadata differences
  const metadataDiff = calculateMetadataDiff(
    {
      description: baseManifest.description,
      tags: baseManifest.tags,
      changelog: baseManifest.changelog
    },
    {
      description: headManifest.description,
      tags: headManifest.tags,
      changelog: headManifest.changelog
    }
  );

  // Calculate permission differences (reuse trust-diff function)
  const permissionDiff = calculatePermissionDiff(
    baseManifest.permissions,
    headManifest.permissions
  );

  // Determine overall risk level based on changes
  let riskLevel = 'LOW';
  let riskScore = 0;

  // Risk from permission changes
  if (permissionDiff.riskScore > 0) {
    riskScore += permissionDiff.riskScore;
  }

  // Risk from file changes (major = 2, minor = 1)
  if (fileDiff.changed.length > 0) {
    riskScore += fileDiff.changed.length * 2;
  }
  if (fileDiff.added.length > 0) {
    riskScore += fileDiff.added.length;
  }
  if (fileDiff.removed.length > 0) {
    riskScore += Math.max(1, fileDiff.removed.length / 2); // Removals lower risk
  }

  // Determine risk level thresholds
  if (riskScore >= 10) {
    riskLevel = 'CRITICAL';
  } else if (riskScore >= 6) {
    riskLevel = 'HIGH';
  } else if (riskScore >= 3) {
    riskLevel = 'MEDIUM';
  }

  // Build comprehensive summary
  const changes = [];
  if (fileDiff.summary && fileDiff.summary !== 'no_changes') {
    changes.push(`Files: ${fileDiff.summary}`);
  }
  if (metadataDiff.summary && metadataDiff.summary !== 'no_metadata_changes') {
    changes.push(`Metadata: ${metadataDiff.summary}`);
  }
  if (permissionDiff.impact && permissionDiff.impact !== 'NONE') {
    changes.push(`Permissions: ${permissionDiff.impact} impact`);
  }

  const overallSummary = changes.length > 0
    ? changes.join(' | ')
    : 'No significant changes detected';

  return {
    base_version: baseVersion.version,
    head_version: headVersion.version,
    file_diff: fileDiff,
    metadata_diff: metadataDiff,
    permission_diff: permissionDiff,
    risk_level: riskLevel,
    risk_score: riskScore,
    summary: overallSummary,
    has_breaking_changes: permissionDiff.added.length > 0 || fileDiff.removed.length > 0
  };
}

module.exports = {
  calculateFileDiff,
  calculateMetadataDiff,
  calculateVersionDiff
};
