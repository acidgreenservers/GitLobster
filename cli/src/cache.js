import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  unlinkSync,
  readdirSync,
  statSync,
} from "fs";
import { promises as fsPromises } from "fs";
import { join } from "path";
import { createHash } from "crypto";

/**
 * Caching System for GitLobster CLI
 *
 * Provides caching for:
 * - Package metadata
 * - Search results
 * - Registry API responses
 * - Package manifests
 */

export class CacheManager {
  constructor(options = {}) {
    this.cacheDir = options.cacheDir || this.getDefaultCacheDir();
    this.defaultTTL = options.defaultTTL || 3600000; // 1 hour in milliseconds
    this.maxCacheSize = options.maxCacheSize || 100; // Max 100 cached items

    this.ensureCacheDir();
  }

  getDefaultCacheDir() {
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    return join(homeDir, ".gitlobster", "cache");
  }

  ensureCacheDir() {
    if (!existsSync(this.cacheDir)) {
      mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /**
   * Generate cache key from data
   */
  generateKey(data) {
    const key = typeof data === "string" ? data : JSON.stringify(data);
    return createHash("sha256").update(key).digest("hex");
  }

  /**
   * Get cached data — returns null on miss or expiry
   */
  get(key) {
    const cacheKey = this.generateKey(key);
    const cacheFile = join(this.cacheDir, `${cacheKey}.json`);

    if (!existsSync(cacheFile)) {
      return null;
    }

    try {
      const data = JSON.parse(readFileSync(cacheFile, "utf-8"));

      // Check if expired
      if (Date.now() > data.expiresAt) {
        this.delete(key);
        return null;
      }

      return data.value;
    } catch (error) {
      console.warn(`Cache read error for key ${key}:`, error.message);
      return null;
    }
  }

  /**
   * Set cached data
   */
  set(key, value, ttl = this.defaultTTL) {
    const cacheKey = this.generateKey(key);
    const cacheFile = join(this.cacheDir, `${cacheKey}.json`);

    const data = {
      value,
      expiresAt: Date.now() + ttl,
      createdAt: Date.now(),
      key,
    };

    try {
      writeFileSync(cacheFile, JSON.stringify(data, null, 2));
      this.cleanup();
      return true;
    } catch (error) {
      console.warn(`Cache write error for key ${key}:`, error.message);
      return false;
    }
  }

  /**
   * Delete a cached entry
   */
  delete(key) {
    const cacheKey = this.generateKey(key);
    const cacheFile = join(this.cacheDir, `${cacheKey}.json`);

    if (existsSync(cacheFile)) {
      try {
        unlinkSync(cacheFile);
        return true;
      } catch (error) {
        console.warn(`Cache delete error for key ${key}:`, error.message);
        return false;
      }
    }

    return false;
  }

  /**
   * Clear all cached data (async)
   */
  async clear() {
    try {
      const files = await fsPromises.readdir(this.cacheDir);
      await Promise.all(
        files.map((file) =>
          fsPromises.unlink(join(this.cacheDir, file)).catch(() => {}),
        ),
      );
      return true;
    } catch (error) {
      console.warn("Cache clear error:", error.message);
      return false;
    }
  }

  /**
   * Cleanup expired cache entries and enforce size limits (sync, called on set)
   */
  cleanup() {
    try {
      const files = readdirSync(this.cacheDir);
      const cacheEntries = [];

      for (const file of files) {
        const filePath = join(this.cacheDir, file);
        try {
          const data = JSON.parse(readFileSync(filePath, "utf-8"));
          if (Date.now() > data.expiresAt) {
            // Delete expired entries
            unlinkSync(filePath);
          } else {
            cacheEntries.push({ file, createdAt: data.createdAt, filePath });
          }
        } catch {
          // Delete corrupted files
          try {
            unlinkSync(filePath);
          } catch {
            /* ignore */
          }
        }
      }

      // Enforce size limit — remove oldest entries first
      if (cacheEntries.length > this.maxCacheSize) {
        cacheEntries.sort((a, b) => a.createdAt - b.createdAt);
        const toDelete = cacheEntries.slice(
          0,
          cacheEntries.length - this.maxCacheSize,
        );
        for (const entry of toDelete) {
          try {
            unlinkSync(entry.filePath);
          } catch (error) {
            console.warn(
              `Failed to delete cache file ${entry.file}:`,
              error.message,
            );
          }
        }
      }
    } catch (error) {
      console.warn("Cache cleanup error:", error.message);
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    try {
      const files = readdirSync(this.cacheDir);
      let totalSize = 0;
      let expiredCount = 0;

      for (const file of files) {
        const filePath = join(this.cacheDir, file);
        try {
          const stats = statSync(filePath);
          totalSize += stats.size;

          const data = JSON.parse(readFileSync(filePath, "utf-8"));
          if (Date.now() > data.expiresAt) {
            expiredCount++;
          }
        } catch {
          // Count corrupted files as expired
          expiredCount++;
        }
      }

      return {
        totalFiles: files.length,
        totalSize,
        expiredCount,
        validCount: files.length - expiredCount,
        cacheDir: this.cacheDir,
      };
    } catch (error) {
      return {
        totalFiles: 0,
        totalSize: 0,
        expiredCount: 0,
        validCount: 0,
        cacheDir: this.cacheDir,
        error: error.message,
      };
    }
  }
}

/**
 * Cached Client SDK wrapper — caches common read operations transparently
 */
export class CachedGitLobsterClient {
  constructor(client, options = {}) {
    this.client = client;
    this.cache = new CacheManager(options);
  }

  /**
   * Cached search method (10 min TTL)
   */
  async search(params = {}) {
    const cacheKey = [
      "search",
      params.q,
      params.category,
      params.tag,
      params.limit,
      params.offset,
    ];
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const result = await this.client.search(params);
    this.cache.set(cacheKey, result, 600_000); // 10 min
    return result;
  }

  /**
   * Cached package metadata method (30 min TTL)
   */
  async getPackageMetadata(packageName) {
    const cacheKey = ["package-metadata", packageName];
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const result = await this.client.getPackageMetadata(packageName);
    this.cache.set(cacheKey, result, 1_800_000); // 30 min
    return result;
  }

  /**
   * Cached manifest method (30 min TTL)
   */
  async getManifest(packageName, version) {
    const cacheKey = ["manifest", packageName, version];
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const result = await this.client.getManifest(packageName, version);
    this.cache.set(cacheKey, result, 1_800_000); // 30 min
    return result;
  }

  /**
   * Cached versions method (30 min TTL)
   */
  async getPackageVersions(packageName) {
    const cacheKey = ["versions", packageName];
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const result = await this.client.getPackageVersions(packageName);
    this.cache.set(cacheKey, result, 1_800_000); // 30 min
    return result;
  }

  /** Get clone URL — no caching needed */
  getCloneUrl(packageName) {
    return this.client.getCloneUrl(packageName);
  }

  /** Star package — invalidates related cache */
  async starPackage(packageName, privateKeyPath) {
    const result = await this.client.starPackage(packageName, privateKeyPath);
    this.cache.delete(["package-metadata", packageName]);
    this.cache.delete(["versions", packageName]);
    return result;
  }

  /** Unstar package — invalidates related cache */
  async unstarPackage(packageName, privateKeyPath) {
    const result = await this.client.unstarPackage(packageName, privateKeyPath);
    this.cache.delete(["package-metadata", packageName]);
    this.cache.delete(["versions", packageName]);
    return result;
  }

  /** Fork package — invalidates related cache */
  async forkPackage(packageName, privateKeyPath) {
    const result = await this.client.forkPackage(packageName, privateKeyPath);
    this.cache.delete(["package-metadata", packageName]);
    this.cache.delete(["versions", packageName]);
    return result;
  }

  /** Cache management pass-throughs */
  getCacheStats() {
    return this.cache.getStats();
  }
  clearCache() {
    return this.cache.clear();
  }
  getCacheDir() {
    return this.cache.cacheDir;
  }
}
