/**
 * GitLobster Client SDK
 * Low-level client for interacting with GitLobster registries
 */

import { readFile } from "fs/promises";
import nacl from "tweetnacl";

export class GitLobsterClient {
  constructor({
    registryUrl = process.env.GITLOBSTER_REGISTRY || "http://localhost:3000",
  } = {}) {
    this.registryUrl = registryUrl.replace(/\/$/, ""); // Remove trailing slash
    this.apiVersion = "v1";
  }

  /**
   * Search for packages
   */
  async search({ q, category, tag, limit = 20, offset = 0 } = {}) {
    const params = new URLSearchParams();
    if (q) params.append("q", q);
    if (category) params.append("category", category);
    if (tag) params.append("tag", tag);
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());

    const url = `${this.registryUrl}/${this.apiVersion}/packages?${params}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Search failed: ${response.status} ${response.statusText}`,
      );
    }

    return response.json();
  }

  /**
   * Get package metadata
   */
  async getPackageMetadata(packageName) {
    const url = `${this.registryUrl}/${this.apiVersion}/packages/${encodeURIComponent(packageName)}`;
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Package not found: ${packageName}`);
      }
      throw new Error(
        `Failed to fetch metadata: ${response.status} ${response.statusText}`,
      );
    }

    return response.json();
  }

  /**
   * Get package manifest
   */
  async getManifest(packageName, version) {
    const url = `${this.registryUrl}/${this.apiVersion}/packages/${encodeURIComponent(packageName)}/${version}/manifest`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch manifest: ${response.status} ${response.statusText}`,
      );
    }

    return response.json();
  }

  /**
   * Generate Ed25519-signed JWT for authentication
   */
  async generateAuthToken(packageName, privateKeyPath) {
    const privateKeyRaw = await readFile(privateKeyPath, "utf-8");

    // Support raw base64 Ed25519 keys (TweetNaCl format)
    let secretKey;

    if (privateKeyRaw.trim().startsWith("-----BEGIN")) {
      throw new Error(
        "PEM keys not supported. Please use raw base64 Ed25519 secret key (64 bytes).",
      );
    } else {
      secretKey = Buffer.from(privateKeyRaw.trim(), "base64");
    }

    if (secretKey.length !== 64) {
      throw new Error(
        `Invalid Ed25519 secret key length: ${secretKey.length} bytes (expected 64)`,
      );
    }

    // Extract scope from package name (e.g., "@molt/skill" -> "@molt")
    const scope = packageName.match(/^(@[^/]+)/)?.[1] || packageName;

    const header = {
      alg: "EdDSA",
      typ: "JWT",
    };

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      sub: scope,
      iss: `gitlobster-cli`,
      iat: now,
      exp: now + 3600, // 1 hour
      scope: "publish",
    };

    // Create JWT
    const encodedHeader = base64url(JSON.stringify(header));
    const encodedPayload = base64url(JSON.stringify(payload));
    const signingInput = `${encodedHeader}.${encodedPayload}`;

    // Sign with Ed25519 using TweetNaCl
    const messageBytes = Buffer.from(signingInput, "utf-8");
    const signature = nacl.sign.detached(
      Uint8Array.from(messageBytes),
      Uint8Array.from(secretKey),
    );

    const encodedSignature = base64url(Buffer.from(signature));

    return `${signingInput}.${encodedSignature}`;
  }

  /**
   * Get the Git clone URL for a package
   * @param {string} packageName - The name of the package
   * @returns {string} The Git clone URL
   */
  getCloneUrl(packageName) {
    return `${this.registryUrl}/git/${encodeURIComponent(packageName)}.git`;
  }

  /**
   * Get available versions/tags for a package
   * @param {string} packageName - The name of the package
   * @returns {Promise<Array<string>>} Array of version strings
   */
  async getPackageVersions(packageName) {
    const url = `${this.registryUrl}/${this.apiVersion}/packages/${encodeURIComponent(packageName)}/versions`;
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Package not found: ${packageName}`);
      }
      throw new Error(
        `Failed to fetch versions: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();
    return data.versions || [];
  }

  /**
   * Star a package
   * @param {string} packageName - The name of the package to star
   * @param {string} privateKeyPath - Path to the Ed25519 private key for JWT auth
   * @returns {Promise<Object>} Response from the API
   */
  async starPackage(packageName, privateKeyPath) {
    const token = await this.generateAuthToken(packageName, privateKeyPath);

    const url = `${this.registryUrl}/${this.apiVersion}/packages/${encodeURIComponent(packageName)}/star`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        `Failed to star package: ${response.status} ${response.statusText} - ${error.message || ""}`,
      );
    }

    return response.json();
  }

  /**
   * Unstar a package
   * @param {string} packageName - The name of the package to unstar
   * @param {string} privateKeyPath - Path to the Ed25519 private key for JWT auth
   * @returns {Promise<Object>} Response from the API
   */
  async unstarPackage(packageName, privateKeyPath) {
    const token = await this.generateAuthToken(packageName, privateKeyPath);

    const url = `${this.registryUrl}/${this.apiVersion}/packages/${encodeURIComponent(packageName)}/unstar`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        `Failed to unstar package: ${response.status} ${response.statusText} - ${error.message || ""}`,
      );
    }

    return response.json();
  }

  /**
   * Fork a package
   * @param {string} packageName - The name of the package to fork
   * @param {string} privateKeyPath - Path to the Ed25519 private key for JWT auth
   * @returns {Promise<Object>} Response from the API with forked package details
   */
  async forkPackage(packageName, privateKeyPath) {
    const token = await this.generateAuthToken(packageName, privateKeyPath);

    const url = `${this.registryUrl}/${this.apiVersion}/packages/${encodeURIComponent(packageName)}/fork`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        `Failed to fork package: ${response.status} ${response.statusText} - ${error.message || ""}`,
      );
    }

    return response.json();
  }
}

/**
 * Base64 URL encoding (without padding)
 */
function base64url(input) {
  const str = typeof input === "string" ? input : input.toString("utf-8");
  return Buffer.from(str)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}
