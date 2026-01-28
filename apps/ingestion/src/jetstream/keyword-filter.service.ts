import { Injectable, Logger } from '@nestjs/common';
import { JetstreamPostEvent, DidResolverService } from '@app/bluesky';
import { RawDataMessage } from '@app/shared-types';
import { JobRegistryService, RegisteredJob } from './job-registry.service';

/**
 * KeywordFilterService - Matches incoming posts against active jobs
 *
 * This service is the core filtering component for the Jetstream integration.
 * It efficiently matches each incoming post against all active jobs' keyword
 * patterns, then dispatches the post to matching jobs via their callbacks.
 *
 * Design considerations:
 * - Uses pre-compiled regex patterns for performance
 * - Processes posts synchronously to maintain ordering
 * - Tracks match counts per job for metrics
 * - Resolves DIDs to handles for better display (Phase 4)
 */
@Injectable()
export class KeywordFilterService {
  private readonly logger = new Logger(KeywordFilterService.name);

  constructor(
    private readonly jobRegistry: JobRegistryService,
    private readonly didResolver: DidResolverService,
  ) {}

  /**
   * Match a post against all active jobs
   *
   * @param post - The incoming Jetstream post event
   * @returns Array of jobs that match this post
   */
  matchPost(post: JetstreamPostEvent): RegisteredJob[] {
    const matchingJobs: RegisteredJob[] = [];
    const activeJobs = this.jobRegistry.getActiveJobs();

    for (const job of activeJobs) {
      if (this.jobRegistry.matchesJob(post.text, job)) {
        matchingJobs.push(job);
      }
    }

    return matchingJobs;
  }

  /**
   * Process a post for all matching jobs
   *
   * This method:
   * 1. Finds all jobs that match the post's text
   * 2. Resolves the author's DID to a handle (if not already present)
   * 3. Transforms the post to RawDataMessage format
   * 4. Dispatches to each job's onData callback
   * 5. Updates match counts
   *
   * @param post - The incoming Jetstream post event
   * @returns Number of jobs that matched this post
   */
  async processPost(post: JetstreamPostEvent): Promise<number> {
    const matchingJobs = this.matchPost(post);

    if (matchingJobs.length === 0) {
      return 0;
    }

    // Resolve handle if not already present
    // This provides a human-readable author name instead of the DID
    const resolvedPost = await this.resolveHandle(post);

    // Transform to base RawDataMessage (without jobId)
    const baseMessage = this.mapToRawDataMessage(resolvedPost);

    // Dispatch to all matching jobs
    const dispatchPromises = matchingJobs.map(async (job) => {
      try {
        // Create job-specific message
        const message: RawDataMessage = {
          ...baseMessage,
          jobId: job.jobId,
        };

        // Dispatch via callback
        await job.onData(message);

        // Update match count
        this.jobRegistry.incrementMatchedCount(job.jobId);

        this.logger.debug(
          `[${job.correlationId}] Post matched job ${job.jobId}: "${post.text.substring(0, 50)}..."`,
        );
      } catch (error) {
        this.logger.error(
          `[${job.correlationId}] Failed to dispatch post to job ${job.jobId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });

    await Promise.all(dispatchPromises);

    return matchingJobs.length;
  }

  /**
   * Resolve the author's DID to a handle
   *
   * If the post already has a handle, returns the post unchanged.
   * If resolution fails, returns the post with the DID as handle.
   *
   * @param post - The post event to resolve
   * @returns Post with handle resolved
   */
  private async resolveHandle(
    post: JetstreamPostEvent,
  ): Promise<JetstreamPostEvent> {
    // Skip if already has a handle
    if (post.handle) {
      return post;
    }

    // Resolve DID to handle
    const handle = await this.didResolver.resolveHandle(post.did);

    return {
      ...post,
      handle,
    };
  }

  /**
   * Transform a Jetstream post event to RawDataMessage format
   *
   * Note: jobId is not set here - it will be set per-job during dispatch
   */
  private mapToRawDataMessage(
    post: JetstreamPostEvent,
  ): Omit<RawDataMessage, 'jobId'> {
    // Build source URL from AT URI
    // Format: at://did/collection/rkey -> https://bsky.app/profile/handle/post/rkey
    const rkey = post.uri.split('/').pop() ?? post.rkey;
    const sourceUrl = post.handle
      ? `https://bsky.app/profile/${post.handle}/post/${rkey}`
      : `https://bsky.app/profile/${post.did}/post/${rkey}`;

    return {
      textContent: post.text,
      source: 'bluesky',
      sourceUrl,
      authorName: post.handle ?? post.did,
      // Jetstream doesn't provide engagement metrics
      upvotes: undefined,
      commentCount: undefined,
      publishedAt: post.createdAt,
      collectedAt: new Date(),
    };
  }

  /**
   * Get matching statistics for logging
   */
  getMatchStats(): {
    totalJobs: number;
    totalMatched: number;
    jobStats: Array<{ jobId: string; matchedCount: number }>;
  } {
    const jobs = this.jobRegistry.getActiveJobs();
    const totalMatched = jobs.reduce((sum, job) => sum + job.matchedCount, 0);

    return {
      totalJobs: jobs.length,
      totalMatched,
      jobStats: jobs.map((job) => ({
        jobId: job.jobId,
        matchedCount: job.matchedCount,
      })),
    };
  }

  /**
   * Get DID resolver metrics for monitoring
   */
  getResolverMetrics() {
    return this.didResolver.getMetrics();
  }
}
