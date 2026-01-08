import { Controller, Logger } from '@nestjs/common';
import {
  MessagePattern,
  Payload,
  Ctx,
  RmqContext,
} from '@nestjs/microservices';
import type { Channel, Message } from 'amqplib';
import { AnalysisService } from './analysis.service';
import {
  MESSAGE_PATTERNS,
  TransientError,
  PermanentError,
} from '@app/shared-types';
import type {
  RawDataMessage,
  IngestionCompleteMessage,
} from '@app/shared-types';

@Controller()
export class AnalysisController {
  private readonly logger = new Logger(AnalysisController.name);

  constructor(private readonly analysisService: AnalysisService) {}

  /**
   * Listen for JOB_RAW_DATA messages from Ingestion
   *
   * Message Flow:
   * Ingestion -> RabbitMQ ('job.raw_data') -> Analysis (this handler)
   */
  @MessagePattern(MESSAGE_PATTERNS.JOB_RAW_DATA)
  async handleRawData(
    @Payload() data: RawDataMessage,
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef() as Channel;
    const originalMsg = context.getMessage() as Message;

    // Extract correlation ID from message properties
    // Note: NestJS emit() doesn't set correlationId; send() sets it as string
    const correlationId: string =
      (originalMsg.properties?.correlationId as string | undefined) ||
      data.jobId ||
      'unknown';

    this.logger.log(
      `[${correlationId}] Received ${MESSAGE_PATTERNS.JOB_RAW_DATA}`,
    );
    this.logger.debug(
      `[${correlationId}] Payload: ${JSON.stringify({
        jobId: data.jobId,
        source: data.source,
        textPreview: data.textContent?.substring(0, 50) + '...',
      })}`,
    );

    try {
      // Validate required fields
      if (!data.jobId || !data.textContent) {
        this.logger.error(
          `[${correlationId}] Invalid message: missing jobId or textContent`,
        );
        // Acknowledge invalid messages to prevent requeue loop
        channel.ack(originalMsg);
        return;
      }

      // Process the raw data
      await this.analysisService.processRawData(data, correlationId);

      // Acknowledge successful processing
      channel.ack(originalMsg);
      this.logger.log(`[${correlationId}] Message acknowledged successfully`);
    } catch (error) {
      this.logger.error(
        `[${correlationId}] Error processing message`,
        error instanceof Error ? error.stack : String(error),
      );

      // Determine if we should requeue
      const shouldRequeue = this.shouldRequeue(error);

      if (shouldRequeue) {
        this.logger.warn(`[${correlationId}] Requeuing message for retry`);
        channel.nack(originalMsg, false, true);
      } else {
        this.logger.error(`[${correlationId}] Discarding message (no requeue)`);
        channel.nack(originalMsg, false, false);
      }
    }
  }

  /**
   * Listen for JOB_INGESTION_COMPLETE messages from Ingestion
   *
   * Message Flow:
   * Ingestion -> RabbitMQ ('job.ingestion_complete') -> Analysis (this handler)
   *
   * This message signals that all raw data has been sent and provides the total count.
   */
  @MessagePattern(MESSAGE_PATTERNS.JOB_INGESTION_COMPLETE)
  async handleIngestionComplete(
    @Payload() data: IngestionCompleteMessage,
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef() as Channel;
    const originalMsg = context.getMessage() as Message;

    const correlationId: string =
      (originalMsg.properties?.correlationId as string | undefined) ||
      data.jobId ||
      'unknown';

    this.logger.log(
      `[${correlationId}] Received ${MESSAGE_PATTERNS.JOB_INGESTION_COMPLETE}`,
    );
    this.logger.debug(
      `[${correlationId}] Payload: ${JSON.stringify({
        jobId: data.jobId,
        totalItems: data.totalItems,
      })}`,
    );

    try {
      // Validate required fields
      if (!data.jobId || data.totalItems === undefined) {
        this.logger.error(
          `[${correlationId}] Invalid message: missing jobId or totalItems`,
        );
        channel.ack(originalMsg);
        return;
      }

      // Process the ingestion complete message
      await this.analysisService.handleIngestionComplete(data, correlationId);

      channel.ack(originalMsg);
      this.logger.log(`[${correlationId}] Message acknowledged successfully`);
    } catch (error) {
      this.logger.error(
        `[${correlationId}] Error processing ingestion complete`,
        error instanceof Error ? error.stack : String(error),
      );

      // Requeue on transient errors
      const shouldRequeue = this.shouldRequeue(error);
      if (shouldRequeue) {
        this.logger.warn(`[${correlationId}] Requeuing message for retry`);
        channel.nack(originalMsg, false, true);
      } else {
        this.logger.error(`[${correlationId}] Discarding message (no requeue)`);
        channel.nack(originalMsg, false, false);
      }
    }
  }

  /**
   * Determine if an error is transient and should be retried
   *
   * Uses custom error classes (TransientError, PermanentError) for reliable
   * retry decisions instead of fragile string matching on error messages.
   */
  private shouldRequeue(error: unknown): boolean {
    // Explicit transient errors should always be retried
    if (error instanceof TransientError) {
      return true;
    }

    // Explicit permanent errors should never be retried
    if (error instanceof PermanentError) {
      return false;
    }

    // Default: requeue unknown errors (fail-safe approach)
    // This ensures we don't lose messages due to unexpected error types
    return true;
  }
}
