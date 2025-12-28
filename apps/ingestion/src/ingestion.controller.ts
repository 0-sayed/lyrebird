import { Controller, Logger } from '@nestjs/common';
import {
  MessagePattern,
  Payload,
  Ctx,
  RmqContext,
} from '@nestjs/microservices';
import type { Channel, Message } from 'amqplib';
import { IngestionService } from './ingestion.service';
import { MESSAGE_PATTERNS, sanitizeForLog } from '@app/shared-types';
import type { StartJobMessage } from '@app/shared-types';

@Controller()
export class IngestionController {
  private readonly logger = new Logger(IngestionController.name);

  constructor(private readonly ingestionService: IngestionService) {}

  /**
   * Listen for JOB_START messages from Gateway
   *
   * Message Flow:
   * Gateway -> RabbitMQ ('job.start') -> Ingestion (this handler)
   */
  @MessagePattern(MESSAGE_PATTERNS.JOB_START)
  async handleStartJob(
    @Payload() data: StartJobMessage,
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
      `[${correlationId}] Received ${MESSAGE_PATTERNS.JOB_START}`,
    );
    this.logger.debug(
      `[${correlationId}] Job: ${data.jobId} | Prompt: "${sanitizeForLog(data.prompt, 50)}..."`,
    );

    try {
      // Validate required fields
      if (!data.jobId || !data.prompt) {
        this.logger.error(
          `[${correlationId}] Invalid message: missing jobId or prompt`,
        );
        // Don't requeue invalid messages - they'll never succeed
        channel.nack(originalMsg, false, false);
        return;
      }

      // Process the job
      await this.ingestionService.processJob(data, correlationId);

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
        message.includes('econnrefused') ||
        message.includes('temporary')
      ) {
        return true;
      }

      // Permanent errors - don't retry
      if (
        message.includes('validation') ||
        message.includes('invalid') ||
        message.includes('not found')
      ) {
        return false;
      }
    }

    // Default: do not requeue unknown errors to avoid infinite retry loops
    return false;
  }
}
