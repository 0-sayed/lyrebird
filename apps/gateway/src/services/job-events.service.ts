import { Injectable, Logger } from '@nestjs/common';
import { JobsRepository } from '@app/database';
import {
  JobCompleteMessage,
  JobFailedMessage,
  InitialBatchCompleteMessage,
  JobStatus,
} from '@app/shared-types';

@Injectable()
export class JobEventsService {
  private readonly logger = new Logger(JobEventsService.name);

  constructor(private readonly jobsRepository: JobsRepository) {}

  /**
   * Handle job completion from Analysis service
   */
  async handleJobCompleted(
    message: JobCompleteMessage,
    correlationId: string,
  ): Promise<void> {
    const { jobId, averageSentiment, dataPointsCount, completedAt } = message;

    this.logger.log(`[${correlationId}] Processing job completion: ${jobId}`);
    this.logger.log(
      `[${correlationId}] Stats: avgSentiment=${averageSentiment?.toFixed(2) ?? 'N/A'}, dataPoints=${dataPointsCount}`,
    );

    // Verify job exists and is in correct state
    const job = await this.jobsRepository.findById(jobId);
    if (!job) {
      this.logger.warn(`[${correlationId}] Job not found: ${jobId}`);
      // Job might have been deleted - nothing to update
      return;
    }

    // Validate that Analysis service has updated the status
    // Analysis service owns the status update; Gateway only validates
    if (job.status !== JobStatus.COMPLETED) {
      this.logger.warn(
        `[${correlationId}] Job ${jobId} status is ${job.status}, expected ${JobStatus.COMPLETED}. Analysis service may not have updated status correctly.`,
      );
    }

    const completedAtStr =
      completedAt instanceof Date ? completedAt.toISOString() : completedAt;
    this.logger.log(
      `[${correlationId}] Job ${jobId} completed at ${completedAtStr}`,
    );
  }

  /**
   * Handle job failure from any service
   */
  async handleJobFailed(
    message: JobFailedMessage,
    correlationId: string,
  ): Promise<void> {
    const { jobId, errorMessage, failedAt } = message;

    this.logger.warn(`[${correlationId}] Processing job failure: ${jobId}`);
    this.logger.warn(`[${correlationId}] Error: ${errorMessage}`);

    // Verify job exists
    const job = await this.jobsRepository.findById(jobId);
    if (!job) {
      this.logger.warn(`[${correlationId}] Failed job not found: ${jobId}`);
      return;
    }

    // Update job status to failed
    await this.jobsRepository.updateStatus(jobId, JobStatus.FAILED);

    const failedAtStr =
      failedAt instanceof Date ? failedAt.toISOString() : failedAt;
    this.logger.warn(
      `[${correlationId}] Job ${jobId} marked as FAILED at ${failedAtStr}`,
    );
  }

  /**
   * Handle initial batch complete from Ingestion service
   * Transitions job from PENDING to IN_PROGRESS
   */
  async handleInitialBatchComplete(
    message: InitialBatchCompleteMessage,
    correlationId: string,
  ): Promise<void> {
    const { jobId, initialBatchCount, streamingActive, completedAt } = message;

    this.logger.log(
      `[${correlationId}] Processing initial batch complete: ${jobId}`,
    );
    this.logger.log(
      `[${correlationId}] Initial batch: ${initialBatchCount} posts, streaming active: ${streamingActive}`,
    );

    // Verify job exists
    const job = await this.jobsRepository.findById(jobId);
    if (!job) {
      this.logger.warn(
        `[${correlationId}] Job not found for initial batch complete: ${jobId}`,
      );
      return;
    }

    // Update job status to IN_PROGRESS
    await this.jobsRepository.updateStatus(jobId, JobStatus.IN_PROGRESS);

    const completedAtStr =
      completedAt instanceof Date ? completedAt.toISOString() : completedAt;
    this.logger.log(
      `[${correlationId}] Job ${jobId} transitioned to IN_PROGRESS at ${completedAtStr}`,
    );
  }
}
