import { Injectable, Logger } from '@nestjs/common';
import { BlueskyClientService, BlueskyPost } from '@app/bluesky';
import { RawDataMessage } from '@app/shared-types';

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

@Injectable()
export class PollingScraperService {
  private readonly logger = new Logger(PollingScraperService.name);
  private activeJobs = new Map<string, NodeJS.Timeout>();

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
    await this.fetchAndProcess({
      jobId,
      prompt,
      correlationId,
      since: new Date(startTime - 60 * 60 * 1000), // Last hour
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
        // Check if job should end
        if (Date.now() - startTime >= maxDurationMs) {
          this.logger.log(
            `[${correlationId}] Job duration reached, stopping polling`,
          );
          this.stopPollingJob(jobId);
          onComplete();
          return;
        }

        // Check if cancelled
        if (signal?.aborted) {
          this.logger.log(`[${correlationId}] Job cancelled, stopping polling`);
          this.stopPollingJob(jobId);
          return;
        }

        // Fetch new posts since last fetch
        await this.fetchAndProcess({
          jobId,
          prompt,
          correlationId,
          since: lastFetchTime,
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

        lastFetchTime = new Date();
      })();
    }, pollIntervalMs);

    this.activeJobs.set(jobId, pollInterval);
  }

  /**
   * Stop a polling job
   */
  stopPollingJob(jobId: string): void {
    const interval = this.activeJobs.get(jobId);
    if (interval) {
      clearInterval(interval);
      this.activeJobs.delete(jobId);
      this.logger.log(`Stopped polling job: ${jobId}`);
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
   */
  private async fetchAndProcess(params: {
    jobId: string;
    prompt: string;
    correlationId: string;
    since: Date;
    onData: (data: RawDataMessage) => Promise<void>;
    onProcessed: (count: number) => void;
  }): Promise<void> {
    const { jobId, prompt, correlationId, since, onData, onProcessed } = params;

    try {
      const result = await this.blueskyClient.searchPostsSince(prompt, since, {
        limit: 50,
        sort: 'latest',
      });

      let processed = 0;
      for (const post of result.posts) {
        const rawData = this.mapToRawDataMessage(jobId, post);
        await onData(rawData);
        processed++;
      }

      onProcessed(processed);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[${correlationId}] Polling fetch failed: ${message}`);
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
