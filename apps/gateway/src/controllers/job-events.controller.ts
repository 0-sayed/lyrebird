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
import type { JobCompleteMessage, JobFailedMessage } from '@app/shared-types';
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

      // Requeue for retry on transient errors
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
      channel.nack(originalMsg, false, true);
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
    return true;
  }
}
