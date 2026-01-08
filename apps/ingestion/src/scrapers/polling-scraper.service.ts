import { Injectable, Logger } from '@nestjs/common';
import { BlueskyClientService, BlueskyPost } from '@app/bluesky';
import { RawDataMessage } from '@app/shared-types';
import { Mutex } from 'async-mutex';

export interface PollingConfig {
  jobId: string;
  prompt: string;
  correlationId: string;
  /** How often to poll (ms) - e.g., 5000 = 5s (recommended for live monitoring) */
  pollIntervalMs: number;
  /** Total job duration (ms) - e.g., 600000 = 10min */
  maxDurationMs: number;
  /** Callback for each new data item */
  onData: (data: RawDataMessage) => Promise<void>;
  /** Callback when polling completes */
  onComplete: () => void;
  /** Optional AbortSignal for cancellation */
  signal?: AbortSignal;
}

interface ActiveJob {
  pollInterval: NodeJS.Timeout;
  onComplete: () => void;
  seenPostUris: Set<string>;
  stopMutex: Mutex; // Prevent race condition when stopping
  isStopping: boolean; // Track if job is being stopped
}

@Injectable()
export class PollingScraperService {
  private readonly logger = new Logger(PollingScraperService.name);
  private activeJobs = new Map<string, ActiveJob>();

  constructor(private readonly blueskyClient: BlueskyClientService) {}

  /**
   * Start a polling job that continuously fetches new posts
   *
   * This implements the industry-standard "near-real-time" pattern used by
   * Brandwatch, Meltwater, and Sprout Social - polling at regular intervals
   * and pushing updates via SSE.
   */
  async startPollingJob(config: PollingConfig): Promise<void> {
    const {
      jobId,
      prompt,
      correlationId,
      pollIntervalMs,
      maxDurationMs,
      onData,
      onComplete,
      signal,
    } = config;

    // Prevent resource leak: stop any existing job with the same jobId before starting a new one
    if (this.activeJobs.has(jobId)) {
      this.logger.warn(
        `[${correlationId}] Job ${jobId} already exists, stopping existing job before starting new one`,
      );
      await this.stopPollingJob(jobId);
    }

    // Track seen posts to prevent duplicate processing
    const seenPostUris = new Set<string>();

    this.logger.log(
      `[${correlationId}] Starting polling job: ${jobId} for "${prompt}"`,
    );
    this.logger.log(
      `[${correlationId}] Poll interval: ${pollIntervalMs}ms, Max duration: ${maxDurationMs}ms`,
    );

    let lastFetchTime = new Date();
    let totalProcessed = 0;
    const startTime = Date.now();

    // Initial fetch - get recent posts immediately
    // isInitialFetch=true ensures errors are propagated to the caller
    await this.fetchAndProcess({
      jobId,
      prompt,
      correlationId,
      since: new Date(startTime - 60 * 60 * 1000), // Last hour
      seenPostUris,
      isInitialFetch: true,
      onData,
      onProcessed: (count) => {
        totalProcessed += count;
        this.logger.log(
          `[${correlationId}] Initial fetch: ${count} posts, total: ${totalProcessed}`,
        );
      },
    });

    lastFetchTime = new Date();

    // Set up polling interval with proper async handling
    const pollInterval = setInterval(() => {
      void (async () => {
        const job = this.activeJobs.get(jobId);
        if (!job || job.isStopping) {
          return; // Job is being stopped, skip this poll
        }

        // Use mutex to protect poll operation from race with stop
        await job.stopMutex.runExclusive(async () => {
          if (job.isStopping) {
            return; // Job stopped during lock acquisition
          }

          // Check if job should end
          if (Date.now() - startTime >= maxDurationMs) {
            this.logger.log(
              `[${correlationId}] Job duration reached, stopping polling`,
            );
            // Call internal stop method (we're already in the mutex)
            this.stopPollingJobInternal(jobId);
            return;
          }

          // Check if cancelled
          if (signal?.aborted) {
            this.logger.log(
              `[${correlationId}] Job cancelled, stopping polling`,
            );
            // Call internal stop method (we're already in the mutex)
            this.stopPollingJobInternal(jobId);
            return;
          }

          // Fetch new posts since last fetch
          try {
            await this.fetchAndProcess({
              jobId,
              prompt,
              correlationId,
              since: lastFetchTime,
              seenPostUris,
              isInitialFetch: false,
              onData,
              onProcessed: (count) => {
                if (count > 0) {
                  totalProcessed += count;
                  this.logger.log(
                    `[${correlationId}] Poll: ${count} new posts, total: ${totalProcessed}`,
                  );
                }
              },
            });
          } catch (error) {
            this.logger.error(
              `[${correlationId}] Unexpected poll error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );
          }
        });
      })();
    }, pollIntervalMs);

    this.activeJobs.set(jobId, {
      pollInterval,
      onComplete,
      seenPostUris,
      stopMutex: new Mutex(),
      isStopping: false,
    });
  }

  /**
   * Stop a polling job and notify completion
   * Uses mutex to prevent race condition with ongoing poll operations
   */
  async stopPollingJob(jobId: string): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (job) {
      // Use mutex to ensure poll operation completes before stopping
      await job.stopMutex.runExclusive(() => {
        this.stopPollingJobInternal(jobId);
      });
    }
  }

  /**
   * Internal stop method - does not acquire mutex
   * Should only be called from within mutex or from stopPollingJob
   */
  private stopPollingJobInternal(jobId: string): void {
    const job = this.activeJobs.get(jobId);
    if (job && !job.isStopping) {
      job.isStopping = true;
      clearInterval(job.pollInterval);
      this.activeJobs.delete(jobId);
      this.logger.log(`Stopped polling job: ${jobId}`);
      job.onComplete();
    }
  }

  /**
   * Check if a job is currently polling
   */
  isJobActive(jobId: string): boolean {
    return this.activeJobs.has(jobId);
  }

  /**
   * Get count of active polling jobs
   */
  getActiveJobCount(): number {
    return this.activeJobs.size;
  }

  /**
   * Fetch posts and process them
   * @param isInitialFetch - If true, errors are re-thrown to propagate to caller
   */
  private async fetchAndProcess(params: {
    jobId: string;
    prompt: string;
    correlationId: string;
    since: Date;
    seenPostUris: Set<string>;
    isInitialFetch: boolean;
    onData: (data: RawDataMessage) => Promise<void>;
    onProcessed: (count: number) => void;
  }): Promise<void> {
    const {
      jobId,
      prompt,
      correlationId,
      since,
      seenPostUris,
      isInitialFetch,
      onData,
      onProcessed,
    } = params;

    try {
      const result = await this.blueskyClient.searchPostsSince(prompt, since, {
        limit: 50,
        sort: 'latest',
      });

      // Filter out posts we've already seen to prevent duplicate processing
      const newPosts = result.posts.filter((post) => {
        if (seenPostUris.has(post.uri)) {
          return false;
        }
        seenPostUris.add(post.uri);
        return true;
      });

      // Process posts concurrently for better performance
      const results = await Promise.allSettled(
        newPosts.map((post) => {
          const rawData = this.mapToRawDataMessage(jobId, post);
          return onData(rawData);
        }),
      );

      const processed = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;

      if (failed > 0) {
        this.logger.warn(
          `[${correlationId}] ${failed} posts failed to process`,
        );
      }

      onProcessed(processed);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[${correlationId}] Polling fetch failed: ${message}`);

      // Re-throw for initial fetch so caller can handle job failure
      if (isInitialFetch) {
        throw error;
      }
      // Continue polling despite errors - don't throw
    }
  }

  /**
   * Map a Bluesky post to the internal RawDataMessage format
   */
  private mapToRawDataMessage(
    jobId: string,
    post: BlueskyPost,
  ): RawDataMessage {
    return {
      jobId,
      textContent: post.record.text,
      source: 'bluesky',
      sourceUrl: this.blueskyClient.buildPostUrl(post),
      authorName: post.author.displayName ?? post.author.handle,
      upvotes: post.likeCount,
      commentCount: post.replyCount,
      publishedAt: new Date(post.record.createdAt),
      collectedAt: new Date(),
    };
  }
}
