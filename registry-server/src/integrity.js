/**
 * File Integrity Verification Module
 * 
 * Implements the "Declare, Don't Extract" security model:
 * - Agents declare all files with per-file SHA-256 hashes in a signed file_manifest
 * - Server validates the manifest format and signature (never extracts tarballs)
 * - Downloaders verify locally after extraction
 * - Mismatches trigger flags that hit agent trust scores
 */

const crypto = require('crypto');
const nacl = require('tweetnacl');

// Required files that MUST appear in every file manifest
const REQUIRED_FILES = ['README.md', 'SKILL.md', 'manifest.json'];

// Current manifest format version
const MANIFEST_FORMAT_VERSION = '1.0';

/**
 * Generate the canonical (deterministic) string representation of a file manifest.
 * Used for signing and verification — ensures consistent hashing regardless of key order.
 * 
 * @param {object} manifest - The file_manifest object
 * @returns {string} Deterministic JSON string
 */
function getCanonicalManifest(manifest) {
    // Sort files object by key for deterministic output
    const sortedFiles = {};
    Object.keys(manifest.files)
        .sort()
        .forEach(key => {
            sortedFiles[key] = manifest.files[key];
        });

    const canonical = {
        format_version: manifest.format_version,
        files: sortedFiles,
        total_files: manifest.total_files
    };

    return JSON.stringify(canonical);
}

/**
 * Validate the structure and content of a file manifest.
 * Does NOT verify signatures — that's a separate step.
 * 
 * @param {object} manifest - The file_manifest object to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateFileManifest(manifest) {
    const errors = [];

    // Check top-level structure
    if (!manifest || typeof manifest !== 'object') {
        return { valid: false, errors: ['file_manifest must be an object'] };
    }

    if (manifest.format_version !== MANIFEST_FORMAT_VERSION) {
        errors.push(`format_version must be "${MANIFEST_FORMAT_VERSION}", got "${manifest.format_version}"`);
    }

    if (!manifest.files || typeof manifest.files !== 'object') {
        errors.push('file_manifest.files must be an object mapping filenames to SHA-256 hashes');
        return { valid: false, errors };
    }

    // Check total_files matches actual count
    const actualFileCount = Object.keys(manifest.files).length;
    if (manifest.total_files !== actualFileCount) {
        errors.push(`total_files declares ${manifest.total_files} but manifest contains ${actualFileCount} entries`);
    }

    // Check required files are present
    const declaredFiles = Object.keys(manifest.files);
    for (const required of REQUIRED_FILES) {
        if (!declaredFiles.includes(required)) {
            errors.push(`Required file missing from manifest: ${required}`);
        }
    }

    // Validate hash format for each file
    for (const [filename, hash] of Object.entries(manifest.files)) {
        if (typeof hash !== 'string') {
            errors.push(`Hash for "${filename}" must be a string`);
            continue;
        }

        if (!hash.startsWith('sha256:')) {
            errors.push(`Hash for "${filename}" must start with "sha256:" prefix, got "${hash.substring(0, 20)}..."`);
            continue;
        }

        const hexPart = hash.replace('sha256:', '');
        if (!/^[a-f0-9]{64}$/.test(hexPart)) {
            errors.push(`Hash for "${filename}" is not a valid SHA-256 hex string (expected 64 hex chars)`);
        }

        // Security: block path traversal attempts
        if (filename.includes('..') || filename.startsWith('/') || filename.startsWith('\\')) {
            errors.push(`Invalid filename "${filename}" — path traversal not allowed`);
        }
    }

    // Build required_files_present list
    const requiredPresent = REQUIRED_FILES.filter(f => declaredFiles.includes(f));

    return {
        valid: errors.length === 0,
        errors,
        requiredPresent
    };
}

/**
 * Verify the Ed25519 signature on a file manifest.
 * The signature must be over the canonical (deterministic) JSON representation.
 * 
 * @param {object} manifest - The file_manifest object
 * @param {string} signature - Base64-encoded Ed25519 signature (with optional "ed25519:" prefix)
 * @param {string} publicKey - Base64-encoded Ed25519 public key
 * @returns {{ valid: boolean, error?: string }}
 */
function verifyManifestSignature(manifest, signature, publicKey) {
    try {
        // Get canonical string
        const canonical = getCanonicalManifest(manifest);

        // Remove ed25519: prefix if present
        const sigValue = signature.replace(/^ed25519:/, '');

        // Decode
        const messageBytes = Buffer.from(canonical, 'utf8');
        const sigBytes = Buffer.from(sigValue, 'base64');
        const pubKeyBytes = Buffer.from(publicKey, 'base64');

        // Verify
        const isValid = nacl.sign.detached.verify(messageBytes, sigBytes, pubKeyBytes);

        return { valid: isValid };
    } catch (error) {
        return { valid: false, error: error.message };
    }
}

module.exports = {
    REQUIRED_FILES,
    MANIFEST_FORMAT_VERSION,
    getCanonicalManifest,
    validateFileManifest,
    verifyManifestSignature
};
