import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RabbitmqService } from '@app/rabbitmq';
import { SentimentDataRepository } from '@app/database/repositories/sentiment-data.repository';
import { JobsRepository } from '@app/database/repositories/jobs.repository';
import {
  MESSAGE_PATTERNS,
  RawDataMessage,
  JobCompleteMessage,
  IngestionCompleteMessage,
  DataUpdateMessage,
  JobStatus,
  SentimentLabel,
} from '@app/shared-types';
import { NewSentimentData } from '@app/database';
import { Mutex } from 'async-mutex';
import { BertSentimentService } from './services/bert-sentiment.service';

// TTL for job tracking entries (1 hour) - cleanup stale entries to prevent memory leak
const JOB_TRACKER_TTL_MS = 60 * 60 * 1000;

// Absolute maximum TTL for any tracker (24 hours) - prevents indefinite memory growth
// for jobs that receive ingestionComplete but never finish processing
const JOB_TRACKER_MAX_TTL_MS = 24 * 60 * 60 * 1000;

// Cleanup interval (15 minutes)
const CLEANUP_INTERVAL_MS = 15 * 60 * 1000;

// Completion timeout: How long to wait after ingestion complete before forcing completion
const COMPLETION_TIMEOUT_MS = 30_000; // 30 seconds

// Minimum completion threshold: Complete job if we've processed at least this percentage
// of expected items and no new messages arrive within COMPLETION_TIMEOUT_MS
const COMPLETION_THRESHOLD_PERCENT = 0.95; // 95%

/**
 * Job tracking state
 * - processed: number of items we've analyzed
 * - expected: total items to expect (set by JOB_INGESTION_COMPLETE)
 * - ingestionComplete: whether we've received the ingestion complete signal
 * - ingestionCompleteAt: timestamp when ingestion complete was received
 * - createdAt: timestamp when tracker was created (for absolute TTL)
 * - lastUpdated: timestamp of last activity (for staleness check)
 */
interface JobTracker {
  processed: number;
  expected: number | null; // null until JOB_INGESTION_COMPLETE is received
  ingestionComplete: boolean;
  ingestionCompleteAt: number | null; // timestamp when JOB_INGESTION_COMPLETE was received
  createdAt: number;
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

  // Track completion timeout handles for cleanup
  private readonly completionTimeouts = new Map<string, NodeJS.Timeout>();

  // Cleanup interval handle - stored for proper cleanup on module destroy
  private cleanupIntervalId: NodeJS.Timeout | null = null;

  // Default far-future date threshold (10 years) - can be overridden via environment
  private static readonly DEFAULT_FAR_FUTURE_YEARS = 10;

  constructor(
    private readonly configService: ConfigService,
    private readonly rabbitmqService: RabbitmqService,
    private readonly sentimentDataRepository: SentimentDataRepository,
    private readonly jobsRepository: JobsRepository,
    private readonly bertSentimentService: BertSentimentService,
  ) {}

  /**
   * Start cleanup interval when module initializes
   */
  onModuleInit(): void {
    this.cleanupIntervalId = setInterval(() => {
      this.cleanupStaleTrackers();
    }, CLEANUP_INTERVAL_MS);
    // Prevent the interval from keeping the process alive during testing/graceful shutdown
    // Use try-catch to handle environments where unref() may not be available
    try {
      this.cleanupIntervalId.unref();
    } catch {
      // Silently ignore if unref() is not available in this environment
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
    // Clear all completion timeouts
    for (const [jobId] of this.completionTimeouts) {
      this.clearCompletionTimeout(jobId);
    }
    // Ensure final cleanup of stale trackers before shutdown
    this.cleanupStaleTrackers();
  }

  /**
   * Clean up stale job tracking entries that haven't been updated recently
   * Prevents memory leak from jobs that never complete
   *
   * Cleanup criteria:
   * 1. Trackers without ingestionComplete that haven't been updated within TTL
   * 2. Any tracker that exceeds the absolute maximum TTL (prevents indefinite memory growth
   *    for jobs that receive ingestionComplete but never finish processing, e.g., due to
   *    consumer crash or poisoned messages)
   */
  private cleanupStaleTrackers(): void {
    const now = Date.now();
    for (const [jobId, tracker] of this.jobProcessingTracker.entries()) {
      const isStale = now - tracker.lastUpdated > JOB_TRACKER_TTL_MS;
      const exceedsMaxTtl = now - tracker.createdAt > JOB_TRACKER_MAX_TTL_MS;

      // Cleanup if:
      // - Stale AND ingestion hasn't completed yet (original behavior)
      // - OR exceeds absolute max TTL (prevents indefinite memory growth)
      if ((isStale && !tracker.ingestionComplete) || exceedsMaxTtl) {
        if (exceedsMaxTtl && tracker.ingestionComplete) {
          this.logger.warn(
            `Cleaning up abandoned tracker for job ${jobId}: ingestion complete but processing never finished (${tracker.processed}/${tracker.expected ?? '?'} items processed)`,
          );
        } else {
          this.logger.debug(`Cleaning up stale tracker for job ${jobId}`);
        }
        this.jobProcessingTracker.delete(jobId);
        this.jobMutexes.delete(jobId);
        this.clearCompletionTimeout(jobId);
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
      // Validate job exists before processing
      const job = await this.jobsRepository.findById(jobId);
      if (!job) {
        this.logger.warn(
          `[${correlationId}] Job ${jobId} not found, skipping processing (job may have been deleted)`,
        );
        return;
      }

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
      // Far-future threshold is configurable via FAR_FUTURE_YEARS_THRESHOLD environment variable
      // Default is 10 years to catch obvious data corruption while allowing legitimate future dates
      const farFutureYears = this.configService.get<number>(
        'FAR_FUTURE_YEARS_THRESHOLD',
        AnalysisService.DEFAULT_FAR_FUTURE_YEARS,
      );
      const farFutureThreshold = new Date(
        now.getTime() + farFutureYears * 365 * 24 * 60 * 60 * 1000,
      );

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

      // Step 3: Write to PostgreSQL (returns null for duplicates)
      const savedRecord =
        await this.sentimentDataRepository.create(sentimentRecord);

      // If duplicate, skip further processing but still track progress
      if (!savedRecord) {
        this.logger.debug(
          `[${correlationId}] Skipping duplicate post: ${message.sourceUrl}`,
        );
        // Still track progress for duplicates to ensure job completion
        await this.trackJobProgress(jobId, correlationId);
        return;
      }

      this.logger.log(
        `[${correlationId}] Saved sentiment data: ${savedRecord.id}`,
      );

      // Step 4: Track job progress and check for completion
      const totalProcessed = await this.trackJobProgress(jobId, correlationId);

      // Step 5: Emit real-time data update event for SSE
      const dataUpdateMessage: DataUpdateMessage = {
        jobId,
        dataPoint: {
          id: savedRecord.id,
          textContent: savedRecord.textContent,
          source: savedRecord.source,
          sourceUrl: savedRecord.sourceUrl ?? undefined,
          authorName: savedRecord.authorName ?? undefined,
          sentimentScore: savedRecord.sentimentScore,
          sentimentLabel: label,
          publishedAt: publishedAtDate,
        },
        totalProcessed,
        analyzedAt: new Date(),
      };

      this.rabbitmqService.emit(
        MESSAGE_PATTERNS.JOB_DATA_UPDATE,
        dataUpdateMessage,
      );

      this.logger.debug(
        `[${correlationId}] Emitted data update for job ${jobId} (${totalProcessed} processed)`,
      );

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
    const normalizedLabel = result.label.toLowerCase() as
      | 'positive'
      | 'negative'
      | 'neutral';

    // Map the string label to SentimentLabel enum
    // Note: BertSentimentService declares label as 'positive' | 'negative' | 'neutral',
    // so the default case should never be hit. We use exhaustive checking here to
    // ensure TypeScript catches any future additions to the label type.
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
      default: {
        // Exhaustive check: this should never be reached if all label cases are handled
        const _exhaustiveCheck: never = normalizedLabel;
        this.logger.error(
          `Unexpected sentiment label '${result.label}' - this indicates a type mismatch with BertSentimentService`,
          { unexpectedLabel: _exhaustiveCheck },
        );
        sentimentLabel = SentimentLabel.NEUTRAL;
      }
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
      const now = Date.now();
      tracker = {
        processed: 0,
        expected: null, // Unknown until JOB_INGESTION_COMPLETE is received
        ingestionComplete: false,
        ingestionCompleteAt: null,
        createdAt: now,
        lastUpdated: now,
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

    // Check if job still exists before processing completion
    // This handles the case where a job was deleted but messages remain in RabbitMQ queue
    const job = await this.jobsRepository.findById(jobId);
    if (!job) {
      this.logger.warn(
        `[${correlationId}] Job ${jobId} not found, skipping ingestion complete processing (job may have been deleted)`,
      );
      // Clean up any tracker state for this deleted job
      this.jobProcessingTracker.delete(jobId);
      this.jobMutexes.delete(jobId);
      this.clearCompletionTimeout(jobId);
      return;
    }

    const mutex = this.getJobMutex(jobId);

    this.logger.log(
      `[${correlationId}] Received JOB_INGESTION_COMPLETE: ${totalItems} items expected`,
    );

    let needsTimeoutSchedule = false;

    await mutex.runExclusive(async () => {
      const tracker = this.getOrCreateTracker(jobId);
      tracker.expected = totalItems;
      tracker.ingestionComplete = true;
      tracker.ingestionCompleteAt = Date.now();
      tracker.lastUpdated = Date.now();

      // Check if we've already processed all items (race condition: all items processed before this message)
      await this.checkAndCompleteJob(jobId, correlationId, tracker);

      // If job didn't complete, schedule a timeout for threshold-based completion
      if (this.jobProcessingTracker.has(jobId)) {
        needsTimeoutSchedule = true;
      }
    });

    // Schedule timeout outside mutex to avoid holding lock during async scheduling
    if (needsTimeoutSchedule) {
      this.scheduleCompletionTimeout(jobId, correlationId);
    }
  }

  /**
   * Schedule a completion timeout check for a job
   * This handles edge cases where a small number of messages are lost
   */
  private scheduleCompletionTimeout(
    jobId: string,
    correlationId: string,
  ): void {
    // Clear any existing timeout for this job
    this.clearCompletionTimeout(jobId);

    this.logger.debug(
      `[${correlationId}] Scheduling completion timeout in ${COMPLETION_TIMEOUT_MS}ms`,
    );

    const timeoutHandle = setTimeout(() => {
      void this.handleCompletionTimeout(jobId, correlationId);
    }, COMPLETION_TIMEOUT_MS);

    this.completionTimeouts.set(jobId, timeoutHandle);
  }

  /**
   * Clear a scheduled completion timeout
   */
  private clearCompletionTimeout(jobId: string): void {
    const existingTimeout = this.completionTimeouts.get(jobId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      this.completionTimeouts.delete(jobId);
    }
  }

  /**
   * Handle completion timeout - complete job if threshold is met
   */
  private async handleCompletionTimeout(
    jobId: string,
    correlationId: string,
  ): Promise<void> {
    this.completionTimeouts.delete(jobId);

    const mutex = this.getJobMutex(jobId);

    await mutex.runExclusive(async () => {
      const tracker = this.jobProcessingTracker.get(jobId);
      if (!tracker) {
        // Job already completed
        return;
      }

      if (!tracker.ingestionComplete || tracker.expected === null) {
        // Ingestion not complete yet, don't force completion
        return;
      }

      // Check if we've hit the threshold
      const completionRatio = tracker.processed / tracker.expected;
      const timeSinceLastUpdate = Date.now() - tracker.lastUpdated;

      this.logger.log(
        `[${correlationId}] Completion timeout check: ${tracker.processed}/${tracker.expected} (${(completionRatio * 100).toFixed(1)}%), ` +
          `last update ${timeSinceLastUpdate}ms ago`,
      );

      // Complete if we've processed enough items and no recent activity
      if (
        completionRatio >= COMPLETION_THRESHOLD_PERCENT &&
        timeSinceLastUpdate >= COMPLETION_TIMEOUT_MS / 2
      ) {
        this.logger.warn(
          `[${correlationId}] Completing job with threshold-based fallback: ` +
            `${tracker.processed}/${tracker.expected} items (${tracker.expected - tracker.processed} missing)`,
        );

        try {
          await this.completeJob(jobId, correlationId);
          this.jobProcessingTracker.delete(jobId);
          this.jobMutexes.delete(jobId);
        } catch (error) {
          this.logger.error(
            `[${correlationId}] Failed to complete job in timeout handler`,
            error instanceof Error ? error.stack : String(error),
          );
        }
      } else if (completionRatio < COMPLETION_THRESHOLD_PERCENT) {
        // Not enough items processed, reschedule timeout
        this.logger.debug(
          `[${correlationId}] Below threshold (${(completionRatio * 100).toFixed(1)}% < ${COMPLETION_THRESHOLD_PERCENT * 100}%), rescheduling timeout`,
        );
        this.scheduleCompletionTimeout(jobId, correlationId);
      }
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
   *
   * @returns The total number of items processed so far
   */
  private async trackJobProgress(
    jobId: string,
    correlationId: string,
  ): Promise<number> {
    const mutex = this.getJobMutex(jobId);
    let processedCount = 0;

    // Acquire lock for this job - ensures atomic read-modify-write
    await mutex.runExclusive(async () => {
      const tracker = this.getOrCreateTracker(jobId);
      tracker.processed++;
      tracker.lastUpdated = Date.now();
      processedCount = tracker.processed;

      const expectedStr =
        tracker.expected !== null ? String(tracker.expected) : '?';
      this.logger.log(
        `[${correlationId}] Job progress: ${tracker.processed}/${expectedStr}`,
      );

      // Check if job is complete (only if we know the expected count)
      await this.checkAndCompleteJob(jobId, correlationId, tracker);
    });

    return processedCount;
  }

  /**
   * Check if job is complete and trigger completion if so
   * Must be called within mutex lock
   *
   * Error Handling: Errors thrown from completeJob() are caught, logged, and re-thrown.
   * The mutex.runExclusive() in the caller will properly release the lock even on error.
   * The tracker is preserved on failure to allow retry on subsequent message processing.
   */
  private async checkAndCompleteJob(
    jobId: string,
    correlationId: string,
    tracker: JobTracker,
  ): Promise<void> {
    // Job is complete when:
    // 1. We've received JOB_INGESTION_COMPLETE (ingestionComplete = true)
    // 2. We've processed all expected items (processed >= expected)
    //
    // Note: Zero-item jobs (expected = 0) are handled correctly here:
    // - When expected = 0 and processed = 0, the condition 0 >= 0 evaluates to true
    // - This allows jobs with no items to complete immediately after receiving
    //   JOB_INGESTION_COMPLETE with totalItems = 0
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
        this.clearCompletionTimeout(jobId);
      } catch (error) {
        // Preserve tracker for potential retry - don't delete on failure
        // The mutex will be properly released by runExclusive() even though we re-throw
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
