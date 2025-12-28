import { Injectable, Logger } from '@nestjs/common';
import { RabbitmqService } from '@app/rabbitmq';
import { SentimentDataRepository } from '@app/database/repositories/sentiment-data.repository';
import { JobsRepository } from '@app/database/repositories/jobs.repository';
import {
  MESSAGE_PATTERNS,
  RawDataMessage,
  JobCompleteMessage,
  JobStatus,
  SentimentLabel,
} from '@app/shared-types';
import { NewSentimentData } from '@app/database';
import { Mutex } from 'async-mutex';

// Track how many items we've processed per job
// In production, this would be stored in Redis for distributed state
const jobProcessingTracker = new Map<
  string,
  { processed: number; expected: number }
>();

// Per-job mutex to prevent race conditions during concurrent message processing
const jobMutexes = new Map<string, Mutex>();

// Expected items per job (from Ingestion service - 3 hardcoded items)
const EXPECTED_ITEMS_PER_JOB = 3;

/**
 * Get or create a mutex for a specific job
 * Ensures serialized access to job state during concurrent processing
 */
function getJobMutex(jobId: string): Mutex {
  let mutex = jobMutexes.get(jobId);
  if (!mutex) {
    mutex = new Mutex();
    jobMutexes.set(jobId, mutex);
  }
  return mutex;
}

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  constructor(
    private readonly rabbitmqService: RabbitmqService,
    private readonly sentimentDataRepository: SentimentDataRepository,
    private readonly jobsRepository: JobsRepository,
  ) {}

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

      // Step 1: Perform sentiment analysis (hardcoded for Walking Skeleton)
      const { score, label, confidence } = this.analyzeSentiment(textContent);

      this.logger.log(
        `[${correlationId}] Sentiment: ${label} (score: ${score.toFixed(2)}, confidence: ${confidence.toFixed(2)})`,
      );

      // Step 2: Prepare data for database insert
      // Note: Dates come as ISO strings from JSON serialization over RabbitMQ
      const publishedAtDate = new Date(message.publishedAt);
      const collectedAtDate = new Date(message.collectedAt);
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
   * Hardcoded sentiment analysis for Walking Skeleton
   *
   * In Phase 2, this will be replaced with real BERT inference:
   * - Use @xenova/transformers for local inference
   * - Model: distilbert-base-uncased-finetuned-sst-2-english
   */
  private analyzeSentiment(text: string): {
    score: number;
    label: SentimentLabel;
    confidence: number;
  } {
    const lowerText = text.toLowerCase();

    // Positive keywords
    if (
      lowerText.includes('love') ||
      lowerText.includes('amazing') ||
      lowerText.includes('great') ||
      lowerText.includes('excellent') ||
      lowerText.includes('wonderful') ||
      lowerText.includes('fantastic') ||
      lowerText.includes('highly recommend')
    ) {
      return {
        score: 0.85,
        label: SentimentLabel.POSITIVE,
        confidence: 0.92,
      };
    }

    // Negative keywords
    if (
      lowerText.includes('terrible') ||
      lowerText.includes('worst') ||
      lowerText.includes('hate') ||
      lowerText.includes('awful') ||
      lowerText.includes('horrible') ||
      lowerText.includes('disappointed') ||
      lowerText.includes('waste')
    ) {
      return {
        score: 0.15,
        label: SentimentLabel.NEGATIVE,
        confidence: 0.88,
      };
    }

    // Neutral keywords
    if (
      lowerText.includes('okay') ||
      lowerText.includes('average') ||
      lowerText.includes('fine') ||
      lowerText.includes('not great') ||
      lowerText.includes('not terrible')
    ) {
      return {
        score: 0.5,
        label: SentimentLabel.NEUTRAL,
        confidence: 0.75,
      };
    }

    // Default to neutral
    return {
      score: 0.5,
      label: SentimentLabel.NEUTRAL,
      confidence: 0.6,
    };
  }

  /**
   * Track job processing progress and publish completion when done
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
    const mutex = getJobMutex(jobId);

    // Acquire lock for this job - ensures atomic read-modify-write
    await mutex.runExclusive(async () => {
      // Initialize or update tracker
      let tracker = jobProcessingTracker.get(jobId);
      if (!tracker) {
        tracker = {
          processed: 0,
          expected: EXPECTED_ITEMS_PER_JOB,
        };
        jobProcessingTracker.set(jobId, tracker);
      }

      tracker.processed++;

      this.logger.log(
        `[${correlationId}] Job progress: ${tracker.processed}/${tracker.expected}`,
      );

      // Check if job is complete
      if (tracker.processed >= tracker.expected) {
        await this.completeJob(jobId, correlationId);
        jobProcessingTracker.delete(jobId); // Clean up tracker
        jobMutexes.delete(jobId); // Clean up mutex
      }
    });
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
