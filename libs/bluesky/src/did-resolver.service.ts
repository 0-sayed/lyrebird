import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Cached DID resolution entry
 */
interface CacheEntry {
  /** Resolved handle */
  handle: string;
  /** When this entry was cached */
  cachedAt: number;
}

/**
 * Batch resolution result
 */
export interface DidResolutionResult {
  /** DID that was resolved */
  did: string;
  /** Resolved handle, or null if resolution failed */
  handle: string | null;
  /** Whether the result came from cache */
  fromCache: boolean;
}

/**
 * DID Resolver metrics
 */
export interface DidResolverMetrics {
  /** Total resolution requests */
  totalRequests: number;
  /** Cache hits */
  cacheHits: number;
  /** Cache misses (API calls made) */
  cacheMisses: number;
  /** Failed resolutions */
  failures: number;
  /** Current cache size */
  cacheSize: number;
  /** Cache hit rate (0-1) */
  hitRate: number;
}

/**
 * DidResolverService - Resolves Bluesky DIDs to human-readable handles
 *
 * The Jetstream API provides only DIDs (Decentralized Identifiers) like
 * "did:plc:abc123", but not the human-readable handles like "alice.bsky.social".
 * This service resolves DIDs to handles for display purposes.
 *
 * Features:
 * - LRU caching with configurable TTL and max size
 * - Batch resolution for efficiency
 * - Graceful degradation (returns DID if resolution fails)
 * - Rate limiting protection
 *
 * The AT Protocol provides a public API for DID resolution:
 * - GET https://bsky.social/xrpc/app.bsky.actor.getProfile?actor={did}
 * - GET https://public.api.bsky.app/xrpc/app.bsky.actor.getProfiles?actors[]={dids}
 *
 * Usage:
 * ```typescript
 * // Single resolution
 * const handle = await resolver.resolveHandle('did:plc:xyz123');
 *
 * // Batch resolution
 * const results = await resolver.resolveHandles([
 *   'did:plc:abc',
 *   'did:plc:xyz',
 * ]);
 * ```
 */
@Injectable()
export class DidResolverService implements OnModuleDestroy {
  private readonly logger = new Logger(DidResolverService.name);

  // LRU cache: Map maintains insertion order, we use it for LRU eviction
  private readonly cache = new Map<string, CacheEntry>();

  // Configuration
  private readonly maxCacheSize: number;
  private readonly cacheTtlMs: number;
  private readonly batchSize: number;
  private readonly apiBaseUrl: string;
  private readonly requestTimeoutMs: number;

  // Metrics
  private totalRequests = 0;
  private cacheHits = 0;
  private cacheMisses = 0;
  private failures = 0;

  // Pending batch requests (for deduplication)
  private pendingResolutions = new Map<string, Promise<string | null>>();

  // Cache cleanup interval
  private cleanupInterval: NodeJS.Timeout | null = null;

  // Constants
  private static readonly DEFAULT_MAX_CACHE_SIZE = 10000;
  private static readonly DEFAULT_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
  private static readonly DEFAULT_BATCH_SIZE = 25; // Max allowed by API
  private static readonly DEFAULT_API_BASE_URL = 'https://public.api.bsky.app';
  private static readonly DEFAULT_REQUEST_TIMEOUT_MS = 5000;
  private static readonly CLEANUP_INTERVAL_MS = 60000; // 1 minute

  constructor(private readonly configService: ConfigService) {
    this.maxCacheSize = this.configService.get<number>(
      'DID_RESOLVER_MAX_CACHE_SIZE',
      DidResolverService.DEFAULT_MAX_CACHE_SIZE,
    );
    this.cacheTtlMs = this.configService.get<number>(
      'DID_RESOLVER_CACHE_TTL_MS',
      DidResolverService.DEFAULT_CACHE_TTL_MS,
    );
    this.batchSize = this.configService.get<number>(
      'DID_RESOLVER_BATCH_SIZE',
      DidResolverService.DEFAULT_BATCH_SIZE,
    );
    this.apiBaseUrl = this.configService.get<string>(
      'DID_RESOLVER_API_BASE_URL',
      DidResolverService.DEFAULT_API_BASE_URL,
    );
    this.requestTimeoutMs = this.configService.get<number>(
      'DID_RESOLVER_REQUEST_TIMEOUT_MS',
      DidResolverService.DEFAULT_REQUEST_TIMEOUT_MS,
    );

    // Start periodic cache cleanup
    this.startCacheCleanup();

    this.logger.log(
      `DidResolver initialized: maxCache=${this.maxCacheSize}, ttl=${this.cacheTtlMs}ms`,
    );
  }

  /**
   * Module cleanup
   */
  onModuleDestroy(): void {
    this.stopCacheCleanup();
    this.cache.clear();
    this.pendingResolutions.clear();
  }

  /**
   * Resolve a single DID to a handle
   *
   * @param did - The DID to resolve (e.g., "did:plc:xyz123")
   * @returns The handle if resolved, or the original DID on failure
   */
  async resolveHandle(did: string): Promise<string> {
    const result = await this.resolveHandleOrNull(did);
    return result ?? did;
  }

  /**
   * Resolve a single DID to a handle, returning null on failure
   *
   * @param did - The DID to resolve
   * @returns The handle if resolved, or null on failure
   */
  async resolveHandleOrNull(did: string): Promise<string | null> {
    this.totalRequests++;

    // Validate DID format
    if (!did || !did.startsWith('did:')) {
      this.logger.warn(`Invalid DID format: ${did}`);
      return null;
    }

    // Check cache first
    const cached = this.getFromCache(did);
    if (cached !== undefined) {
      this.cacheHits++;
      return cached;
    }

    this.cacheMisses++;

    // Check if there's already a pending resolution for this DID
    const pending = this.pendingResolutions.get(did);
    if (pending) {
      return pending;
    }

    // Create new resolution promise
    const resolutionPromise = this.fetchHandle(did);
    this.pendingResolutions.set(did, resolutionPromise);

    try {
      const handle = await resolutionPromise;
      return handle;
    } finally {
      this.pendingResolutions.delete(did);
    }
  }

  /**
   * Resolve multiple DIDs to handles in batch
   *
   * More efficient than individual resolutions as it uses the batch API endpoint.
   *
   * @param dids - Array of DIDs to resolve
   * @returns Array of resolution results
   */
  async resolveHandles(dids: string[]): Promise<DidResolutionResult[]> {
    if (dids.length === 0) {
      return [];
    }

    // Deduplicate input
    const uniqueDids = [...new Set(dids)];
    const results: Map<string, DidResolutionResult> = new Map();

    // Separate cached and uncached DIDs
    const uncached: string[] = [];

    for (const did of uniqueDids) {
      this.totalRequests++;

      // Validate DID format
      if (!did || !did.startsWith('did:')) {
        results.set(did, { did, handle: null, fromCache: false });
        continue;
      }

      const cached = this.getFromCache(did);
      if (cached !== undefined) {
        this.cacheHits++;
        results.set(did, { did, handle: cached, fromCache: true });
      } else {
        uncached.push(did);
        this.cacheMisses++;
      }
    }

    // Fetch uncached DIDs in batches
    if (uncached.length > 0) {
      const batches = this.chunkArray(uncached, this.batchSize);

      for (const batch of batches) {
        const batchResults = await this.fetchHandlesBatch(batch);
        for (const [did, handle] of batchResults) {
          results.set(did, { did, handle, fromCache: false });
        }
      }
    }

    // Return results in original order
    return dids.map(
      (did) => results.get(did) ?? { did, handle: null, fromCache: false },
    );
  }

  /**
   * Pre-warm the cache with known DIDs
   *
   * @param dids - DIDs to resolve and cache
   */
  async warmCache(dids: string[]): Promise<void> {
    await this.resolveHandles(dids);
    this.logger.debug(`Cache warmed with ${dids.length} DIDs`);
  }

  /**
   * Get current metrics
   */
  getMetrics(): DidResolverMetrics {
    const hitRate =
      this.totalRequests > 0 ? this.cacheHits / this.totalRequests : 0;

    return {
      totalRequests: this.totalRequests,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      failures: this.failures,
      cacheSize: this.cache.size,
      hitRate: Math.round(hitRate * 1000) / 1000, // 3 decimal places
    };
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
    this.logger.log('DID cache cleared');
  }

  /**
   * Reset metrics counters
   */
  resetMetrics(): void {
    this.totalRequests = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.failures = 0;
  }

  /**
   * Manually set a cached handle (useful for testing or known values)
   *
   * @param did - The DID
   * @param handle - The handle to cache
   */
  setCachedHandle(did: string, handle: string): void {
    this.setInCache(did, handle);
  }

  /**
   * Get from cache if not expired
   */
  private getFromCache(did: string): string | undefined {
    const entry = this.cache.get(did);
    if (!entry) {
      return undefined;
    }

    // Check if expired
    if (Date.now() - entry.cachedAt > this.cacheTtlMs) {
      this.cache.delete(did);
      return undefined;
    }

    // Move to end for LRU (delete and re-add maintains order)
    this.cache.delete(did);
    this.cache.set(did, entry);

    return entry.handle;
  }

  /**
   * Add to cache with LRU eviction
   */
  private setInCache(did: string, handle: string): void {
    // Evict oldest entries if cache is full
    while (this.cache.size >= this.maxCacheSize) {
      const oldestKey = this.cache.keys().next().value as string | undefined;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(did, {
      handle,
      cachedAt: Date.now(),
    });
  }

  /**
   * Fetch a single handle from the API
   */
  private async fetchHandle(did: string): Promise<string | null> {
    try {
      const url = `${this.apiBaseUrl}/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(did)}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.requestTimeoutMs,
      );

      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          // Handle specific error codes
          if (response.status === 400) {
            // Invalid DID or not found
            this.logger.debug(`DID not found or invalid: ${did}`);
            return null;
          }
          if (response.status === 429) {
            // Rate limited
            this.logger.warn('DID resolver rate limited');
            this.failures++;
            return null;
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = (await response.json()) as { handle?: string };
        const handle = data.handle;

        if (handle) {
          this.setInCache(did, handle);
          return handle;
        }

        return null;
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        this.logger.warn(`DID resolution timed out: ${did}`);
      } else {
        this.logger.warn(
          `Failed to resolve DID ${did}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      this.failures++;
      return null;
    }
  }

  /**
   * Fetch handles for a batch of DIDs using the batch API
   */
  private async fetchHandlesBatch(
    dids: string[],
  ): Promise<Map<string, string | null>> {
    const results = new Map<string, string | null>();

    // Initialize all DIDs as unresolved
    for (const did of dids) {
      results.set(did, null);
    }

    if (dids.length === 0) {
      return results;
    }

    try {
      // Build URL with multiple actors params
      const url = new URL(`${this.apiBaseUrl}/xrpc/app.bsky.actor.getProfiles`);
      for (const did of dids) {
        url.searchParams.append('actors', did);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.requestTimeoutMs * 2, // Longer timeout for batch
      );

      try {
        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          if (response.status === 429) {
            this.logger.warn('DID resolver batch rate limited');
            this.failures += dids.length;
            return results;
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = (await response.json()) as {
          profiles?: Array<{ did: string; handle: string }>;
        };

        if (data.profiles) {
          for (const profile of data.profiles) {
            if (profile.did && profile.handle) {
              results.set(profile.did, profile.handle);
              this.setInCache(profile.did, profile.handle);
            }
          }
        }

        // Count failures for DIDs not in response
        for (const [did, handle] of results) {
          if (handle === null) {
            this.failures++;
            this.logger.debug(`DID not found in batch response: ${did}`);
          }
        }

        return results;
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        this.logger.warn(`DID batch resolution timed out`);
      } else {
        this.logger.warn(
          `Failed to resolve DID batch: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      this.failures += dids.length;
      return results;
    }
  }

  /**
   * Start periodic cache cleanup to remove expired entries
   */
  private startCacheCleanup(): void {
    if (this.cleanupInterval) {
      return;
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, DidResolverService.CLEANUP_INTERVAL_MS);

    // Prevent interval from blocking process exit
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Stop periodic cache cleanup
   */
  private stopCacheCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Remove expired entries from cache
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [did, entry] of this.cache) {
      if (now - entry.cachedAt > this.cacheTtlMs) {
        this.cache.delete(did);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug(`Cleaned ${cleaned} expired cache entries`);
    }
  }

  /**
   * Split an array into chunks of specified size
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
