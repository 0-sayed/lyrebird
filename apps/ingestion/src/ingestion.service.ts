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
   */
  async processJob(message: StartJobMessage): Promise<void> {
    try {
      this.logger.log(`Processing job: ${message.jobId}`);
      this.logger.log(`Prompt: ${message.prompt}`);

      // Simulate data ingestion with hardcoded data
      const hardcodedData: RawDataMessage = {
        jobId: message.jobId,
        textContent:
          'Hello from Reddit! This is a hardcoded positive post about Egypt.',
        source: 'reddit',
        sourceUrl: 'https://reddit.com/r/egypt/fake-post',
        authorName: 'test_user_123',
        upvotes: 42,
        commentCount: 10,
        collectedAt: new Date(),
      };

      // Simulate processing delay (1 second)
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Publish raw data to analysis service
      this.rabbitmqService.emit(MESSAGE_PATTERNS.JOB_RAW_DATA, hardcodedData);

      this.logger.log(`Raw data published for job: ${message.jobId}`);
    } catch (error) {
      this.logger.error(`Failed to process job: ${message.jobId}`, error.stack);
      throw error;
    }
  }
}
