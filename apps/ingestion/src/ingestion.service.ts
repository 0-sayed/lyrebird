import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RabbitmqService } from '@app/rabbitmq';
import { JobsRepository } from '@app/database/repositories/jobs.repository';
import {
  MESSAGE_PATTERNS,
  StartJobMessage,
  InitialBatchCompleteMessage,
  IngestionCompleteMessage,
  JobStatus,
  JobFailedMessage,
} from '@app/shared-types';
import { JetstreamManagerService } from './jetstream/jetstream-manager.service';

/**
 * IngestionService handles fetching data from Bluesky via Jetstream.
 *
 * Architecture (Jan 2026 - Jetstream Only):
 * - Real-time streaming via Bluesky Jetstream WebSocket API
 * - Sub-second latency (no indexing delay)
 * - Single WebSocket connection shared across all jobs
 * - Keyword-based filtering of incoming posts
 *
 * Output: RawDataMessage via RabbitMQ
 */
@Injectable()
export class IngestionService implements OnModuleInit {
  private readonly logger = new Logger(IngestionService.name);

  /** Default max duration - how long the job runs */
  private readonly defaultMaxDurationMs: number;

  constructor(
    private rabbitmqService: RabbitmqService,
    private jetstreamManager: JetstreamManagerService,
    private configService: ConfigService,
    private jobsRepository: JobsRepository,
  ) {
    this.defaultMaxDurationMs = this.configService.get<number>(
      'JETSTREAM_MAX_DURATION_MS',
      120000, // Default: 2 minutes
    );
  }

  /**
   * Log ingestion mode on startup
   */
  onModuleInit(): void {
    this.logger.log('Ingestion mode: JETSTREAM (real-time streaming)');
  }

  /**
   * Process incoming job using Jetstream real-time streaming
   */
  async processJob(
    message: StartJobMessage,
    correlationId: string,
  ): Promise<void> {
    // Check if job still exists in database before processing
    const job = await this.jobsRepository.findById(message.jobId);
    if (!job) {
      this.logger.warn(
        `[${correlationId}] Job ${message.jobId} not found in database, skipping processing (job may have been deleted)`,
      );
      return;
    }

    // Start job processing - await to ensure errors are caught by controller
    await this.processJobWithJetstream(message, correlationId);
  }

  /**
   * Process job using Jetstream real-time streaming
   */
  private async processJobWithJetstream(
    message: StartJobMessage,
    correlationId: string,
  ): Promise<void> {
    const startTime = Date.now();

    this.logger.log(
      `[${correlationId}] Processing job with Jetstream: ${message.jobId}`,
    );
    this.logger.log(`[${correlationId}] Search prompt: "${message.prompt}"`);

    const maxDurationMs =
      message.options?.job?.maxDurationMs ?? this.defaultMaxDurationMs;

    this.logger.log(
      `[${correlationId}] Jetstream mode: duration=${maxDurationMs}ms (${maxDurationMs / 1000}s)`,
    );

    // Signal Gateway to transition job to IN_PROGRESS immediately
    const initialBatchMsg: InitialBatchCompleteMessage = {
      jobId: message.jobId,
      initialBatchCount: 0,
      completedAt: new Date(),
      streamingActive: true, // Jetstream is now streaming
    };
    try {
      this.rabbitmqService.emit(
        MESSAGE_PATTERNS.JOB_INITIAL_BATCH_COMPLETE,
        initialBatchMsg,
      );
      this.logger.log(
        `[${correlationId}] Published JOB_INITIAL_BATCH_COMPLETE (Jetstream mode)`,
      );
    } catch (error) {
      this.logger.error(
        `[${correlationId}] Failed to emit JOB_INITIAL_BATCH_COMPLETE`,
        error instanceof Error ? error.stack : String(error),
      );
    }

    // Register job with Jetstream manager
    try {
      await this.jetstreamManager.registerJob({
        jobId: message.jobId,
        prompt: message.prompt,
        correlationId,
        maxDurationMs,
        onData: (rawData) => {
          try {
            this.rabbitmqService.emit(MESSAGE_PATTERNS.JOB_RAW_DATA, rawData);
            this.logger.debug(
              `[${correlationId}] Jetstream raw data: ${rawData.textContent.substring(0, 50)}...`,
            );
          } catch (error) {
            this.logger.error(
              `[${correlationId}] Failed to emit raw data`,
              error instanceof Error ? error.stack : String(error),
            );
          }
          return Promise.resolve();
        },
        onComplete: (totalCount) => {
          const duration = Date.now() - startTime;
          this.logger.log(
            `[${correlationId}] Jetstream ingestion completed in ${duration}ms: ${totalCount} posts matched`,
          );

          // Signal Analysis service that all data has been sent
          const ingestionComplete: IngestionCompleteMessage = {
            jobId: message.jobId,
            totalItems: totalCount,
            completedAt: new Date(),
          };
          try {
            this.rabbitmqService.emit(
              MESSAGE_PATTERNS.JOB_INGESTION_COMPLETE,
              ingestionComplete,
            );
            this.logger.log(
              `[${correlationId}] Published JOB_INGESTION_COMPLETE: ${totalCount} items`,
            );
          } catch (error) {
            this.logger.error(
              `[${correlationId}] Failed to emit JOB_INGESTION_COMPLETE`,
              error instanceof Error ? error.stack : String(error),
            );
          }
        },
      });
    } catch (error) {
      this.logger.error(
        `[${correlationId}] Failed to register job with Jetstream`,
        error instanceof Error ? error.stack : String(error),
      );
      this.rabbitmqService.emit(MESSAGE_PATTERNS.JOB_FAILED, {
        jobId: message.jobId,
        status: JobStatus.FAILED,
        errorMessage:
          error instanceof Error ? error.message : 'Job registration failed',
        failedAt: new Date(),
      } satisfies JobFailedMessage);
      throw error; // Re-throw to propagate to controller
    }
  }

  /**
   * Check if a job is currently running
   */
  isJobActive(jobId: string): boolean {
    return this.jetstreamManager.isJobRegistered(jobId);
  }

  /**
   * Get count of active jobs
   */
  getActiveJobCount(): number {
    return this.jetstreamManager.getStatus().activeJobCount;
  }

  /**
   * Cancel a running job
   * Called when a job is deleted via the Gateway API
   */
  cancelJob(jobId: string, correlationId?: string): void {
    const corrId = correlationId ?? `cancel-${jobId}-${Date.now()}`;
    this.logger.log(`[${corrId}] Cancelling job: ${jobId}`);
    this.jetstreamManager.cancelJob(jobId);
  }
}
