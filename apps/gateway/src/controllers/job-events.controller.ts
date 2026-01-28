import { Controller, Logger } from '@nestjs/common';
import {
  MessagePattern,
  Payload,
  Ctx,
  RmqContext,
} from '@nestjs/microservices';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Channel, Message } from 'amqplib';
import { MESSAGE_PATTERNS, JobStatus } from '@app/shared-types';
import type {
  JobCompleteMessage,
  JobFailedMessage,
  DataUpdateMessage,
  InitialBatchCompleteMessage,
} from '@app/shared-types';
import { JobEventsService } from '../services/job-events.service';
import { JOB_EVENTS } from '../events';

@Controller()
export class JobEventsController {
  private readonly logger = new Logger(JobEventsController.name);

  constructor(
    private readonly jobEventsService: JobEventsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Listen for JOB_COMPLETE messages from Analysis Service
   *
   * Message Flow:
   * Analysis -> RabbitMQ ('job.complete') -> Gateway (this handler)
   */
  @MessagePattern(MESSAGE_PATTERNS.JOB_COMPLETE)
  async handleJobComplete(
    @Payload() data: JobCompleteMessage,
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef() as Channel;
    const originalMsg = context.getMessage() as Message;
    const correlationId = String(
      originalMsg.properties?.correlationId || data.jobId || 'unknown',
    );

    this.logger.log(
      `[${correlationId}] Received ${MESSAGE_PATTERNS.JOB_COMPLETE}`,
    );
    this.logger.debug(`[${correlationId}] Payload: ${JSON.stringify(data)}`);

    try {
      // Process the completion
      await this.jobEventsService.handleJobCompleted(data, correlationId);

      // Emit internal event for SSE subscribers
      this.eventEmitter.emit(JOB_EVENTS.COMPLETED, {
        jobId: data.jobId,
        status: JobStatus.COMPLETED,
        averageSentiment: data.averageSentiment,
        dataPointsCount: data.dataPointsCount,
        timestamp: new Date(),
        correlationId,
      });

      // Acknowledge successful processing
      channel.ack(originalMsg);
      this.logger.log(
        `[${correlationId}] Job completion processed successfully`,
      );
    } catch (error) {
      this.logger.error(
        `[${correlationId}] Error processing job completion`,
        error instanceof Error ? error.stack : String(error),
      );

      // TODO Phase 3 (Day 23): Replace with DLQ after N retries
      // See: .local/agents/specify/roadmap/03-PHASE3-OVERVIEW.md Step 3.2
      const shouldRequeue = this.isTransientError(error);
      channel.nack(originalMsg, false, shouldRequeue);
    }
  }

  /**
   * Listen for JOB_FAILED messages from any service
   *
   * Message Flow:
   * Any Service -> RabbitMQ ('job.failed') -> Gateway (this handler)
   */
  @MessagePattern(MESSAGE_PATTERNS.JOB_FAILED)
  async handleJobFailed(
    @Payload() data: JobFailedMessage,
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef() as Channel;
    const originalMsg = context.getMessage() as Message;
    const correlationId = String(
      originalMsg.properties?.correlationId || data.jobId || 'unknown',
    );

    this.logger.log(
      `[${correlationId}] Received ${MESSAGE_PATTERNS.JOB_FAILED}`,
    );
    this.logger.warn(`[${correlationId}] Job failed: ${data.errorMessage}`);

    try {
      // Process the failure
      await this.jobEventsService.handleJobFailed(data, correlationId);

      // Emit internal event for SSE subscribers
      this.eventEmitter.emit(JOB_EVENTS.FAILED, {
        jobId: data.jobId,
        status: JobStatus.FAILED,
        errorMessage: data.errorMessage,
        timestamp: new Date(),
        correlationId,
      });

      // Acknowledge successful processing
      channel.ack(originalMsg);
      this.logger.log(`[${correlationId}] Job failure processed`);
    } catch (error) {
      this.logger.error(
        `[${correlationId}] Error processing job failure`,
        error instanceof Error ? error.stack : String(error),
      );

      // TODO Phase 3: Replace with DLQ after N retries
      const shouldRequeue = this.isTransientError(error);
      channel.nack(originalMsg, false, shouldRequeue);
    }
  }

  /**
   * Listen for JOB_DATA_UPDATE messages from Analysis Service
   *
   * Message Flow:
   * Analysis -> RabbitMQ ('job.data_update') -> Gateway (this handler) -> SSE
   *
   * This enables real-time chart updates as data points are processed.
   */
  @MessagePattern(MESSAGE_PATTERNS.JOB_DATA_UPDATE)
  handleDataUpdate(
    @Payload() data: DataUpdateMessage,
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef() as Channel;
    const originalMsg = context.getMessage() as Message;
    const correlationId = String(
      originalMsg.properties?.correlationId || data.jobId || 'unknown',
    );

    this.logger.debug(
      `[${correlationId}] Received ${MESSAGE_PATTERNS.JOB_DATA_UPDATE}`,
    );

    try {
      // Emit internal event for SSE subscribers
      // No database update needed here - Analysis service already persisted the data
      this.eventEmitter.emit(JOB_EVENTS.DATA_UPDATE, {
        jobId: data.jobId,
        dataPoint: data.dataPoint,
        totalProcessed: data.totalProcessed,
        timestamp: new Date(data.analyzedAt),
        correlationId,
      });

      // Acknowledge successful processing
      channel.ack(originalMsg);
    } catch (error) {
      this.logger.error(
        `[${correlationId}] Error processing data update`,
        error instanceof Error ? error.stack : String(error),
      );

      // Data updates are not critical - don't requeue to prevent backlog
      channel.nack(originalMsg, false, false);
    }
  }

  /**
   * Listen for JOB_INITIAL_BATCH_COMPLETE messages from Ingestion Service
   *
   * Message Flow:
   * Ingestion -> RabbitMQ ('job.initial_batch_complete') -> Gateway (this handler) -> SSE
   *
   * This signals that the initial batch fetch is complete and continuous polling has begun.
   * The job should transition from PENDING to IN_PROGRESS.
   */
  @MessagePattern(MESSAGE_PATTERNS.JOB_INITIAL_BATCH_COMPLETE)
  async handleInitialBatchComplete(
    @Payload() data: InitialBatchCompleteMessage,
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef() as Channel;
    const originalMsg = context.getMessage() as Message;
    const correlationId = String(
      originalMsg.properties?.correlationId || data.jobId || 'unknown',
    );

    this.logger.log(
      `[${correlationId}] Received ${MESSAGE_PATTERNS.JOB_INITIAL_BATCH_COMPLETE}`,
    );
    this.logger.log(
      `[${correlationId}] Initial batch: ${data.initialBatchCount} posts, streaming active: ${data.streamingActive}`,
    );

    try {
      // Update job status to IN_PROGRESS and notify SSE subscribers
      await this.jobEventsService.handleInitialBatchComplete(
        data,
        correlationId,
      );

      // Emit internal event for SSE subscribers
      this.eventEmitter.emit(JOB_EVENTS.STATUS_CHANGED, {
        jobId: data.jobId,
        status: JobStatus.IN_PROGRESS,
        initialBatchCount: data.initialBatchCount,
        streamingActive: data.streamingActive,
        timestamp: new Date(),
        correlationId,
      });

      // Acknowledge successful processing
      channel.ack(originalMsg);
      this.logger.log(
        `[${correlationId}] Initial batch complete processed, job now IN_PROGRESS`,
      );
    } catch (error) {
      this.logger.error(
        `[${correlationId}] Error processing initial batch complete`,
        error instanceof Error ? error.stack : String(error),
      );

      const shouldRequeue = this.isTransientError(error);
      channel.nack(originalMsg, false, shouldRequeue);
    }
  }

  /**
   * Determine if an error is transient and should be retried
   */
  private isTransientError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('timeout') ||
        message.includes('connection') ||
        message.includes('econnrefused') ||
        message.includes('enotfound')
      );
    }
    // Default to false for unknown errors to prevent infinite retries
    return false;
  }
}
