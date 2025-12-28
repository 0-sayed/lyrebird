import { Injectable, Logger } from '@nestjs/common';
import { RabbitmqService } from '@app/rabbitmq';
import {
  MESSAGE_PATTERNS,
  StartJobMessage,
  RawDataMessage,
} from '@app/shared-types';

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(private rabbitmqService: RabbitmqService) {}

  /**
   * Process incoming job (Walking Skeleton - hardcoded data)
   *
   * In the real implementation (Phase 3), this will:
   * 1. Call Reddit API to search for posts
   * 2. Extract relevant text content
   * 3. Normalize and clean data
   * 4. Publish each data point for analysis
   */
  async processJob(
    message: StartJobMessage,
    correlationId: string,
  ): Promise<void> {
    const startTime = Date.now();

    try {
      this.logger.log(`[${correlationId}] Processing job: ${message.jobId}`);
      this.logger.log(`[${correlationId}] Search prompt: "${message.prompt}"`);

      // Simulate API latency (Reddit API would take 1-3 seconds)
      await this.simulateApiLatency();

      // Generate hardcoded sample data
      // In Phase 3, this will be real Reddit data
      const rawDataItems = this.generateHardcodedData(message);

      this.logger.log(
        `[${correlationId}] Collected ${rawDataItems.length} data points`,
      );

      // Publish each raw data item to the Analysis service
      for (const rawData of rawDataItems) {
        this.rabbitmqService.emit(MESSAGE_PATTERNS.JOB_RAW_DATA, rawData);
        this.logger.debug(
          `[${correlationId}] Published raw data: ${rawData.textContent.substring(0, 50)}...`,
        );
      }

      const duration = Date.now() - startTime;
      this.logger.log(
        `[${correlationId}] Job processed in ${duration}ms, published ${rawDataItems.length} items`,
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `[${correlationId}] Job failed after ${duration}ms`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * Simulate API latency for realistic testing
   */
  private async simulateApiLatency(): Promise<void> {
    const delay = 500 + Math.random() * 1000; // 500-1500ms
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * Generate hardcoded sample data for the Walking Skeleton
   *
   * Returns 3 sample Reddit-like posts with varying sentiments
   */
  private generateHardcodedData(message: StartJobMessage): RawDataMessage[] {
    const collectedAt = new Date();

    // Simulate posts from different times in the past (as real Reddit posts would have)
    // This demonstrates proper time-series data with distinct publishedAt vs collectedAt
    return [
      {
        jobId: message.jobId,
        textContent: `I absolutely love ${message.prompt}! It's amazing and has changed my life for the better. Highly recommend to everyone!`,
        source: 'reddit',
        sourceUrl: `https://reddit.com/r/sample/post_positive_${message.jobId.slice(0, 8)}`,
        authorName: 'happy_user_123',
        upvotes: 156,
        commentCount: 23,
        publishedAt: new Date(collectedAt.getTime() - 2 * 60 * 60 * 1000), // 2 hours ago
        collectedAt,
      },
      {
        jobId: message.jobId,
        textContent: `${message.prompt} is okay I guess. Not great, not terrible. Average experience overall. Could be better.`,
        source: 'reddit',
        sourceUrl: `https://reddit.com/r/sample/post_neutral_${message.jobId.slice(0, 8)}`,
        authorName: 'neutral_observer',
        upvotes: 42,
        commentCount: 8,
        publishedAt: new Date(collectedAt.getTime() - 24 * 60 * 60 * 1000), // 1 day ago
        collectedAt,
      },
      {
        jobId: message.jobId,
        textContent: `Terrible experience with ${message.prompt}. Complete waste of time and money. Would not recommend at all. Very disappointed.`,
        source: 'reddit',
        sourceUrl: `https://reddit.com/r/sample/post_negative_${message.jobId.slice(0, 8)}`,
        authorName: 'disappointed_customer',
        upvotes: 89,
        commentCount: 45,
        publishedAt: new Date(collectedAt.getTime() - 7 * 24 * 60 * 60 * 1000), // 1 week ago
        collectedAt,
      },
    ];
  }
}
