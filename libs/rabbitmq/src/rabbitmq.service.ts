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
  getQueueForPattern,
} from './rabbitmq.constants';

@Injectable()
export class RabbitmqService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitmqService.name);

  // Map of queue name -> ClientProxy
  private clients: Map<string, ClientProxy> = new Map();

  constructor(private configService: ConfigService) {}

  /**
   * Initialize RabbitMQ connections on module startup
   * Creates a client for each target queue
   */
  async onModuleInit() {
    try {
      this.logger.log('Initializing RabbitMQ connections...');

      const url = buildRabbitMqUrl(this.configService);
      this.logger.log(`Connecting to: ${getSanitizedRabbitMqUrl(url)}`);

      // Create a client for each queue
      const queues = Object.values(RABBITMQ_CONSTANTS.QUEUES);

      for (const queue of queues) {
        const client = ClientProxyFactory.create(
          this.getRmqOptionsForQueue(url, queue),
        );
        await client.connect();
        this.clients.set(queue, client);
        this.logger.log(`Connected to queue: ${queue}`);
      }

      this.logger.log(
        `RabbitMQ connected successfully (${queues.length} queues)`,
      );
    } catch (error) {
      this.logger.error(
        'Failed to connect to RabbitMQ',
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * Close all RabbitMQ connections on module shutdown
   */
  async onModuleDestroy() {
    try {
      this.logger.log('Closing RabbitMQ connections...');

      for (const [queue, client] of this.clients) {
        await client.close();
        this.logger.debug(`Closed connection to queue: ${queue}`);
      }

      this.clients.clear();
      this.logger.log('All RabbitMQ connections closed');
    } catch (error) {
      this.logger.error(
        'Error closing RabbitMQ connections',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Get RabbitMQ connection options for a specific queue
   */
  private getRmqOptionsForQueue(url: string, queue: string): RmqOptions {
    return {
      transport: Transport.RMQ,
      options: {
        urls: [url],
        queue,
        queueOptions: {
          durable: RABBITMQ_CONSTANTS.DEFAULTS.QUEUE_DURABLE,
        },
        prefetchCount: RABBITMQ_CONSTANTS.DEFAULTS.PREFETCH_COUNT,
      },
    };
  }

  /**
   * Get the client for a specific queue
   */
  private getClientForQueue(queue: string): ClientProxy {
    const client = this.clients.get(queue);
    if (!client) {
      throw new Error(`No client available for queue: ${queue}`);
    }
    return client;
  }

  /**
   * Get the client for a specific pattern (auto-routes to correct queue)
   */
  private getClientForPattern(pattern: string): ClientProxy {
    const queue = getQueueForPattern(pattern);
    return this.getClientForQueue(queue);
  }

  /**
   * Emit an event (fire-and-forget)
   * Automatically routes to the correct queue based on pattern
   */
  emit<T = unknown>(pattern: string, data: T): void {
    const queue = getQueueForPattern(pattern);
    this.logger.debug(`Emitting event: ${pattern} → ${queue}`, data);
    const client = this.getClientForQueue(queue);
    client.emit(pattern, data);
  }

  /**
   * Send a message and wait for response (request-response)
   * Automatically routes to the correct queue based on pattern
   */
  async send<TResult = unknown, TInput = unknown>(
    pattern: string,
    data: TInput,
  ): Promise<TResult> {
    const queue = getQueueForPattern(pattern);
    this.logger.debug(`Sending message: ${pattern} → ${queue}`, data);
    const client = this.getClientForQueue(queue);
    return lastValueFrom(client.send<TResult>(pattern, data));
  }

  /**
   * Emit directly to a specific queue (bypass pattern routing)
   * Use this when you need explicit control over the target queue
   */
  emitToQueue<T = unknown>(queue: string, pattern: string, data: T): void {
    this.logger.debug(`Emitting event: ${pattern} → ${queue} (direct)`, data);
    const client = this.getClientForQueue(queue);
    client.emit(pattern, data);
  }

  /**
   * Health check - verify RabbitMQ connections
   */
  healthCheck(): boolean {
    try {
      // Check if all clients are connected
      return this.clients.size > 0;
    } catch (error) {
      this.logger.error(
        'RabbitMQ health check failed',
        error instanceof Error ? error.stack : String(error),
      );
      return false;
    }
  }

  /**
   * Check if RabbitMQ clients are connected
   */
  isConnected(): boolean {
    try {
      return this.clients.size > 0;
    } catch (error) {
      this.logger.error(
        'Failed to check RabbitMQ connection status',
        error instanceof Error ? error.stack : String(error),
      );
      return false;
    }
  }

  /**
   * Get client for a specific queue (for advanced usage)
   */
  getClient(queue?: string): ClientProxy {
    if (queue) {
      return this.getClientForQueue(queue);
    }
    // Return first client if no queue specified (for backwards compatibility)
    const firstClient = this.clients.values().next().value as
      | ClientProxy
      | undefined;
    if (!firstClient) {
      throw new Error('No RabbitMQ clients available');
    }
    return firstClient;
  }
}
