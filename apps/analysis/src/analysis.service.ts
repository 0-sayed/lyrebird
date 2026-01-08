import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { RabbitmqService } from '@app/rabbitmq';
import { SentimentDataRepository } from '@app/database/repositories/sentiment-data.repository';
import { JobsRepository } from '@app/database/repositories/jobs.repository';
import {
  MESSAGE_PATTERNS,
  RawDataMessage,
  JobCompleteMessage,
  IngestionCompleteMessage,
  JobStatus,
  SentimentLabel,
} from '@app/shared-types';
import { NewSentimentData } from '@app/database';
import { Mutex } from 'async-mutex';
import { BertSentimentService } from './services/bert-sentiment.service';

// TTL for job tracking entries (1 hour) - cleanup stale entries to prevent memory leak
const JOB_TRACKER_TTL_MS = 60 * 60 * 1000;

// Cleanup interval (15 minutes)
const CLEANUP_INTERVAL_MS = 15 * 60 * 1000;

/**
 * Job tracking state
 * - processed: number of items we've analyzed
 * - expected: total items to expect (set by JOB_INGESTION_COMPLETE)
 * - ingestionComplete: whether we've received the ingestion complete signal
 */
interface JobTracker {
  processed: number;
  expected: number | null; // null until JOB_INGESTION_COMPLETE is received
  ingestionComplete: boolean;
  lastUpdated: number;
}

@Injectable()
export class AnalysisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AnalysisService.name);

  // Track job processing state
  // In production, this would be stored in Redis for distributed state
  private readonly jobProcessingTracker = new Map<string, JobTracker>();

  // Per-job mutex to prevent race conditions during concurrent message processing
  private readonly jobMutexes = new Map<string, Mutex>();

  // Cleanup interval handle - stored for proper cleanup on module destroy
  private cleanupIntervalId: NodeJS.Timeout | null = null;

  constructor(
    private readonly rabbitmqService: RabbitmqService,
    private readonly sentimentDataRepository: SentimentDataRepository,
    private readonly jobsRepository: JobsRepository,
    private readonly bertSentimentService: BertSentimentService,
  ) {}

  /**
   * Start cleanup interval when module initializes
   */
  onModuleInit(): void {
    this.cleanupIntervalId = setInterval(
      () => this.cleanupStaleTrackers(),
      CLEANUP_INTERVAL_MS,
    );
    // Prevent the interval from keeping the process alive during testing/graceful shutdown
    // Guard against environments where setInterval returns numeric IDs without unref()
    if (
      this.cleanupIntervalId &&
      typeof this.cleanupIntervalId === 'object' &&
      'unref' in this.cleanupIntervalId &&
      typeof this.cleanupIntervalId.unref === 'function'
    ) {
      this.cleanupIntervalId.unref();
    }
  }

  /**
   * Clean up interval when module is destroyed (prevents Jest from hanging)
   */
  onModuleDestroy(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }
    // Ensure final cleanup of stale trackers before shutdown
    this.cleanupStaleTrackers();
  }

  /**
   * Clean up stale job tracking entries that haven't been updated recently
   * Prevents memory leak from jobs that never complete
   *
   * Note: Only removes trackers that haven't received ingestion complete signal
   * to avoid losing state for long-running jobs that are still active
   */
  private cleanupStaleTrackers(): void {
    const now = Date.now();
    for (const [jobId, tracker] of this.jobProcessingTracker.entries()) {
      const isStale = now - tracker.lastUpdated > JOB_TRACKER_TTL_MS;
      // Only cleanup if stale AND ingestion hasn't completed yet
      // (completed ingestion means job is actively being processed)
      if (isStale && !tracker.ingestionComplete) {
        this.logger.debug(`Cleaning up stale tracker for job ${jobId}`);
        this.jobProcessingTracker.delete(jobId);
        this.jobMutexes.delete(jobId);
      }
    }
  }

  /**
   * Get or create a mutex for a specific job
   * Ensures serialized access to job state during concurrent processing
   */
  private getJobMutex(jobId: string): Mutex {
    let mutex = this.jobMutexes.get(jobId);
    if (!mutex) {
      mutex = new Mutex();
      this.jobMutexes.set(jobId, mutex);
    }
    return mutex;
  }

  /**
   * Process raw data from Ingestion service
   *
   * Walking Skeleton implementation:
   * 1. Apply hardcoded sentiment analysis
   * 2. Write to PostgreSQL
   * 3. Track job progress
   * 4. Publish completion when all items processed
   */
  async processRawData(
    message: RawDataMessage,
    correlationId: string,
  ): Promise<void> {
    const startTime = Date.now();
    const { jobId, textContent, source } = message;

    try {
      this.logger.log(`[${correlationId}] Analyzing text from ${source}`);

      // Step 1: Perform sentiment analysis using BERT
      const { score, label, confidence } =
        await this.analyzeSentiment(textContent);

      this.logger.log(
        `[${correlationId}] Sentiment: ${label} (score: ${score.toFixed(2)}, confidence: ${confidence.toFixed(2)})`,
      );

      // Step 2: Prepare data for database insert
      // Note: Dates come as ISO strings from JSON serialization over RabbitMQ
      const publishedAtDate = new Date(message.publishedAt);
      const collectedAtDate = new Date(message.collectedAt);
      const now = new Date();
      const farFutureThreshold = new Date(
        now.getTime() + 365 * 24 * 60 * 60 * 1000,
      ); // 1 year from now

      // Validate dates to prevent Invalid Date objects and far-future dates (data corruption)
      if (isNaN(publishedAtDate.getTime())) {
        throw new Error(
          `Invalid publishedAt date for job ${jobId}: ${String(message.publishedAt)}`,
        );
      }
      if (publishedAtDate > farFutureThreshold) {
        throw new Error(
          `publishedAt date is too far in the future for job ${jobId}: ${publishedAtDate.toISOString()} (possible data corruption or system time issue)`,
        );
      }
      if (isNaN(collectedAtDate.getTime())) {
        throw new Error(
          `Invalid collectedAt date for job ${jobId}: ${String(message.collectedAt)}`,
        );
      }
      if (collectedAtDate > farFutureThreshold) {
        throw new Error(
          `collectedAt date is too far in the future for job ${jobId}: ${collectedAtDate.toISOString()} (possible data corruption or system time issue)`,
        );
      }
      const sentimentRecord: NewSentimentData = {
        jobId,
        source,
        sourceUrl: message.sourceUrl ?? null,
        authorName: message.authorName ?? null,
        textContent,
        rawContent: textContent,
        sentimentScore: score,
        sentimentLabel: label,
        confidence,
        upvotes: message.upvotes ?? 0,
        commentCount: message.commentCount ?? 0,
        publishedAt: publishedAtDate,
        collectedAt: collectedAtDate,
        analyzedAt: new Date(),
      };

      // Step 3: Write to PostgreSQL
      const savedRecord =
        await this.sentimentDataRepository.create(sentimentRecord);
      this.logger.log(
        `[${correlationId}] Saved sentiment data: ${savedRecord.id}`,
      );

      // Step 4: Track job progress and check for completion
      await this.trackJobProgress(jobId, correlationId);

      const duration = Date.now() - startTime;
      this.logger.log(
        `[${correlationId}] Processing complete in ${duration}ms`,
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `[${correlationId}] Processing failed after ${duration}ms`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * Perform sentiment analysis using BERT model
   *
   * Uses @xenova/transformers for local BERT inference.
   * Model: distilbert-base-uncased-finetuned-sst-2-english
   */
  private async analyzeSentiment(text: string): Promise<{
    score: number;
    label: SentimentLabel;
    confidence: number;
  }> {
    const result = await this.bertSentimentService.analyze(text);

    // Normalize label to lowercase to handle case variations from different BERT implementations
    const normalizedLabel = result.label.toLowerCase();

    // Map the string label to SentimentLabel enum
    let sentimentLabel: SentimentLabel;
    switch (normalizedLabel) {
      case 'positive':
        sentimentLabel = SentimentLabel.POSITIVE;
        break;
      case 'negative':
        sentimentLabel = SentimentLabel.NEGATIVE;
        break;
      case 'neutral':
        sentimentLabel = SentimentLabel.NEUTRAL;
        break;
      default:
        this.logger.warn(
          `Unknown sentiment label '${result.label}', defaulting to NEUTRAL`,
        );
        sentimentLabel = SentimentLabel.NEUTRAL;
    }

    return {
      score: result.score,
      label: sentimentLabel,
      confidence: result.confidence,
    };
  }

  /**
   * Get or initialize the job tracker
   */
  private getOrCreateTracker(jobId: string): JobTracker {
    let tracker = this.jobProcessingTracker.get(jobId);
    if (!tracker) {
      tracker = {
        processed: 0,
        expected: null, // Unknown until JOB_INGESTION_COMPLETE is received
        ingestionComplete: false,
        lastUpdated: Date.now(),
      };
      this.jobProcessingTracker.set(jobId, tracker);
    }
    return tracker;
  }

  /**
   * Handle JOB_INGESTION_COMPLETE message from Ingestion service
   * This signals that all raw data has been sent and tells us the total count
   */
  async handleIngestionComplete(
    message: IngestionCompleteMessage,
    correlationId: string,
  ): Promise<void> {
    const { jobId, totalItems } = message;
    const mutex = this.getJobMutex(jobId);

    this.logger.log(
      `[${correlationId}] Received JOB_INGESTION_COMPLETE: ${totalItems} items expected`,
    );

    await mutex.runExclusive(async () => {
      const tracker = this.getOrCreateTracker(jobId);
      tracker.expected = totalItems;
      tracker.ingestionComplete = true;
      tracker.lastUpdated = Date.now();

      // Check if we've already processed all items (race condition: all items processed before this message)
      await this.checkAndCompleteJob(jobId, correlationId, tracker);
    });
  }

  /**
   * Track job processing progress
   *
   * Uses a per-job mutex to prevent race conditions when multiple messages
   * for the same job are processed concurrently.
   *
   * Note: In production, this state should be in Redis for distributed tracking.
   * For the Walking Skeleton, we use in-memory tracking with mutex protection.
   */
  private async trackJobProgress(
    jobId: string,
    correlationId: string,
  ): Promise<void> {
    const mutex = this.getJobMutex(jobId);

    // Acquire lock for this job - ensures atomic read-modify-write
    await mutex.runExclusive(async () => {
      const tracker = this.getOrCreateTracker(jobId);
      tracker.processed++;
      tracker.lastUpdated = Date.now();

      const expectedStr =
        tracker.expected !== null ? String(tracker.expected) : '?';
      this.logger.log(
        `[${correlationId}] Job progress: ${tracker.processed}/${expectedStr}`,
      );

      // Check if job is complete (only if we know the expected count)
      await this.checkAndCompleteJob(jobId, correlationId, tracker);
    });
  }

  /**
   * Check if job is complete and trigger completion if so
   * Must be called within mutex lock
   */
  private async checkAndCompleteJob(
    jobId: string,
    correlationId: string,
    tracker: JobTracker,
  ): Promise<void> {
    // Job is complete when:
    // 1. We've received JOB_INGESTION_COMPLETE (ingestionComplete = true)
    // 2. We've processed all expected items (processed >= expected)
    const isComplete =
      tracker.ingestionComplete &&
      tracker.expected !== null &&
      tracker.processed >= tracker.expected;

    if (isComplete) {
      try {
        await this.completeJob(jobId, correlationId);
        // Only clean up tracker after successful completion
        this.jobProcessingTracker.delete(jobId);
        this.jobMutexes.delete(jobId);
      } catch (error) {
        // Preserve tracker for potential retry - don't delete on failure
        this.logger.error(
          `[${correlationId}] Failed to complete job, tracker preserved for retry`,
          error instanceof Error ? error.stack : String(error),
        );
        throw error;
      }
    }
  }

  /**
   * Complete the job and publish completion event
   */
  private async completeJob(
    jobId: string,
    correlationId: string,
  ): Promise<void> {
    try {
      this.logger.log(`[${correlationId}] All items processed, completing job`);

      // Get final statistics from database
      const [avgSentimentStr, dataPointsCount] = await Promise.all([
        this.sentimentDataRepository.getAverageSentimentByJobId(jobId),
        this.sentimentDataRepository.countByJobId(jobId),
      ]);

      // Convert average sentiment from string to number (Drizzle returns string for precision)
      const averageSentiment = avgSentimentStr
        ? parseFloat(avgSentimentStr)
        : 0.5;

      // Update job status in database
      await this.jobsRepository.updateStatus(jobId, JobStatus.COMPLETED);

      // Publish completion event
      const completionMessage: JobCompleteMessage = {
        jobId,
        status: JobStatus.COMPLETED,
        averageSentiment,
        dataPointsCount,
        completedAt: new Date(),
      };

      this.rabbitmqService.emit(
        MESSAGE_PATTERNS.JOB_COMPLETE,
        completionMessage,
      );

      this.logger.log(
        `[${correlationId}] Job completed: avg sentiment ${averageSentiment.toFixed(2)}, ${dataPointsCount} data points`,
      );
    } catch (error) {
      this.logger.error(
        `[${correlationId}] Failed to complete job`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }
}
