import { Controller, Logger } from '@nestjs/common';
import {
  MessagePattern,
  Payload,
  Ctx,
  RmqContext,
} from '@nestjs/microservices';
import type { Channel, Message } from 'amqplib';
import { IngestionService } from './ingestion.service';
import { MESSAGE_PATTERNS } from '@app/shared-types';
import type { StartJobMessage } from '@app/shared-types';

@Controller()
export class IngestionController {
  private readonly logger = new Logger(IngestionController.name);

  constructor(private readonly ingestionService: IngestionService) {}

  /**
   * Listen for JOB_START messages
   * When Gateway publishes a job.start message, this handler is triggered
   */
  @MessagePattern(MESSAGE_PATTERNS.JOB_START)
  async handleStartJob(
    @Payload() data: StartJobMessage,
    @Ctx() context: RmqContext,
  ) {
    this.logger.log(`Received message: ${MESSAGE_PATTERNS.JOB_START}`);

    const channel = context.getChannelRef() as Channel;
    const originalMsg = context.getMessage() as Message;

    try {
      // Process the job
      await this.ingestionService.processJob(data);

      // Manually acknowledge the message (important!)
      channel.ack(originalMsg);

      this.logger.log(`Message acknowledged: ${MESSAGE_PATTERNS.JOB_START}`);
    } catch (error) {
      this.logger.error(
        'Error processing message',
        error instanceof Error ? error.stack : String(error),
      );

      // Reject and requeue the message on error
      channel.nack(originalMsg, false, true); // requeue = true
    }
  }
}
