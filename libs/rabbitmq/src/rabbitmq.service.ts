import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
  RmqOptions,
} from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import {
  RABBITMQ_CONSTANTS,
  buildRabbitMqUrl,
  getSanitizedRabbitMqUrl,
} from './rabbitmq.constants';

@Injectable()
export class RabbitmqService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitmqService.name);
  private client: ClientProxy;

  constructor(private configService: ConfigService) {}

  /**
   * Initialize RabbitMQ connection on module startup
   */
  async onModuleInit() {
    try {
      this.logger.log('Initializing RabbitMQ connection...');

      // Create RabbitMQ client
      this.client = ClientProxyFactory.create(this.getRmqOptions());

      // Connect to RabbitMQ
      await this.client.connect();

      this.logger.log('RabbitMQ connected successfully');
    } catch (error) {
      this.logger.error(
        'Failed to connect to RabbitMQ',
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**‹
   * Close RabbitMQ connection on module shutdown
   */
  async onModuleDestroy() {
    try {
      this.logger.log('Closing RabbitMQ connection...');
      await this.client.close();
      this.logger.log('RabbitMQ connection closed');
    } catch (error) {
      this.logger.error(
        'Error closing RabbitMQ connection',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Get RabbitMQ connection options
   */
  private getRmqOptions(): RmqOptions {
    const url = buildRabbitMqUrl(this.configService);
    const queue = RABBITMQ_CONSTANTS.QUEUES.LYREBIRD_MAIN;

    this.logger.log(`Connecting to: ${getSanitizedRabbitMqUrl(url)}`);

    return {
      transport: Transport.RMQ,
      options: {
        urls: [url],
        queue,
        queueOptions: {
          durable: RABBITMQ_CONSTANTS.DEFAULTS.QUEUE_DURABLE,
        },
        // Don't set noAck for ClientProxy - NestJS handles reply queue automatically
        prefetchCount: RABBITMQ_CONSTANTS.DEFAULTS.PREFETCH_COUNT,
      },
    };
  }

  /**
   * Emit an event (fire-and-forget)
   * Use this for events that don't need a response
   */
  emit<T = any>(pattern: string, data: T): void {
    this.logger.debug(`Emitting event: ${pattern}`, data);
    this.client.emit(pattern, data);
  }

  /**
   * Send a message and wait for response (request-response)
   * Use this when you need a reply
   */
  async send<TResult = any, TInput = any>(
    pattern: string,
    data: TInput,
  ): Promise<TResult> {
    this.logger.debug(`Sending message: ${pattern}`, data);
    return lastValueFrom(this.client.send<TResult>(pattern, data));
  }

  /**
   * Health check - verify RabbitMQ connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Simple ping-pong health check
      const result = await this.send<string>('health.check', {
        timestamp: new Date(),
      });
      return !!result;
    } catch (error) {
      this.logger.error(
        'RabbitMQ health check failed',
        error instanceof Error ? error.stack : String(error),
      );
      return false;
    }
  }

  /**
   * Get the underlying ClientProxy (for advanced usage)
   */
  getClient(): ClientProxy {
    return this.client;
  }
}
