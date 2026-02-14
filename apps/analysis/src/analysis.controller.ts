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

/** Max retry attempts before discarding a message */
const MAX_RETRY_COUNT = 3;

@Controller()
export class AnalysisController {
  private readonly logger = new Logger(AnalysisController.name);

  /** Track per-message retry counts (keyed by message content hash) */
  private readonly retryCountMap = new Map<string, number>();

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
      if (this.shouldRequeue(error, originalMsg)) {
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

      // Requeue on transient errors, respecting max retry count
      if (this.shouldRequeue(error, originalMsg)) {
        this.logger.warn(`[${correlationId}] Requeuing message for retry`);
        channel.nack(originalMsg, false, true);
      } else {
        this.logger.error(`[${correlationId}] Discarding message (no requeue)`);
        channel.nack(originalMsg, false, false);
      }
    }
  }

  /**
   * Get a stable key for tracking retries of a specific message.
   * Uses message content to identify unique messages across redeliveries.
   */
  private getMessageKey(originalMsg: Message): string {
    // Use the raw message content as identifier since RabbitMQ doesn't
    // provide a persistent delivery count for classic queues
    const content = originalMsg.content.toString();
    // Simple hash to avoid storing large message bodies as keys
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash + char) | 0;
    }
    return String(hash);
  }

  /**
   * Determine if a failed message should be requeued for retry.
   *
   * Checks: error type, retry count, and redelivery status.
   * Prevents infinite retry loops by enforcing MAX_RETRY_COUNT.
   */
  private shouldRequeue(error: unknown, originalMsg: Message): boolean {
    // Explicit permanent errors should never be retried
    if (error instanceof PermanentError) {
      return false;
    }

    // Check retry count to prevent infinite loops
    const msgKey = this.getMessageKey(originalMsg);
    const currentRetries = this.retryCountMap.get(msgKey) ?? 0;

    if (currentRetries >= MAX_RETRY_COUNT) {
      this.logger.error(
        `Message exceeded max retry count (${MAX_RETRY_COUNT}), discarding`,
      );
      this.retryCountMap.delete(msgKey);
      return false;
    }

    // Explicit transient errors or unknown errors: retry with count tracking
    this.retryCountMap.set(msgKey, currentRetries + 1);

    // Clean up old entries periodically to prevent memory leak
    if (this.retryCountMap.size > 10_000) {
      const entries = [...this.retryCountMap.entries()];
      // Remove oldest half
      for (let i = 0; i < entries.length / 2; i++) {
        this.retryCountMap.delete(entries[i][0]);
      }
    }

    return true;
  }
}
