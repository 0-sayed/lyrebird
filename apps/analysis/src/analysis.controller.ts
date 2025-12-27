import { Controller, Logger } from '@nestjs/common';
import {
  MessagePattern,
  Payload,
  Ctx,
  RmqContext,
} from '@nestjs/microservices';
import type { Channel, Message } from 'amqplib';
import { AnalysisService } from './analysis.service';
import { MESSAGE_PATTERNS } from '@app/shared-types';
import type { RawDataMessage } from '@app/shared-types';

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

    // Extract correlation ID from message properties or jobId
    const correlationId: string =
      (
        originalMsg.properties?.correlationId as Buffer | undefined
      )?.toString() ||
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
   * Determine if an error is transient and should be retried
   */
  private shouldRequeue(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      // Transient errors - should retry
      if (
        message.includes('timeout') ||
        message.includes('connection') ||
        message.includes('unavailable') ||
        message.includes('temporary')
      ) {
        return true;
      }

      // Permanent errors - don't retry
      if (
        message.includes('validation') ||
        message.includes('invalid') ||
        message.includes('not found') ||
        message.includes('duplicate')
      ) {
        return false;
      }
    }

    // Default: requeue unknown errors
    return true;
  }
}
