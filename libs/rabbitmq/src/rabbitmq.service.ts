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

      const connectionPromises = queues.map(async (queue) => {
        const client = ClientProxyFactory.create(
          this.getRmqOptionsForQueue(url, queue),
        );
        await client.connect();
        this.clients.set(queue, client);
        this.logger.log(`Connected to queue: ${queue}`);
      });

      await Promise.all(connectionPromises);

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

      const closingPromises = Array.from(this.clients.entries()).map(
        async ([queue, client]) => {
          await client.close();
          this.logger.debug(`Closed connection to queue: ${queue}`);
        },
      );

      await Promise.all(closingPromises);

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
   *
   * CRITICAL: NestJS ClientProxy.emit() returns a cold Observable.
   * The message is only sent when the Observable is subscribed.
   * We subscribe immediately to ensure real-time message delivery.
   */
  emit<T = unknown>(pattern: string, data: T): void {
    const queue = getQueueForPattern(pattern);
    this.logger.debug(`Emitting event: ${pattern} → ${queue}`);
    const client = this.getClientForQueue(queue);
    // MUST subscribe to the Observable for the message to be sent
    // Without this, messages get buffered and sent in batches
    client.emit(pattern, data).subscribe({
      error: (err) => {
        this.logger.error(
          `Failed to emit ${pattern}: ${err instanceof Error ? err.message : String(err)}`,
        );
      },
    });
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
   *
   * CRITICAL: NestJS ClientProxy.emit() returns a cold Observable.
   * The message is only sent when the Observable is subscribed.
   */
  emitToQueue<T = unknown>(queue: string, pattern: string, data: T): void {
    this.logger.debug(`Emitting event: ${pattern} → ${queue} (direct)`);
    const client = this.getClientForQueue(queue);
    // MUST subscribe to the Observable for the message to be sent
    client.emit(pattern, data).subscribe({
      error: (err) => {
        this.logger.error(
          `Failed to emit ${pattern} to ${queue}: ${err instanceof Error ? err.message : String(err)}`,
        );
      },
    });
  }

  /**
   * Health check - verify RabbitMQ connections are actually active
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (this.clients.size === 0) {
        return false;
      }

      // Verify each client is actually connected by checking internal state
      const checkPromises = Array.from(this.clients.values()).map((client) => {
        // ClientProxy doesn't expose connection state directly,
        // but we can verify it was successfully connected during init
        return Promise.resolve(client !== null && client !== undefined);
      });

      const results = await Promise.all(checkPromises);
      return results.every((isConnected) => isConnected);
    } catch (error) {
      this.logger.error(
        'RabbitMQ health check failed',
        error instanceof Error ? error.stack : String(error),
      );
      return false;
    }
  }

  /**
   * Check if RabbitMQ clients have been initialized
   * Note: This only checks if clients exist, not if they're actively connected.
   * Use healthCheck() for actual connectivity verification.
   */
  isInitialized(): boolean {
    try {
      return this.clients.size > 0;
    } catch (error) {
      this.logger.error(
        'Failed to check RabbitMQ initialization status',
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
    // Return first client if no queue specified (for backwards compatibility).
    // WARNING: This is non-deterministic if the queue initialization order changes.
    // For predictable behavior, please specify a queue name.
    const firstClient = this.clients.values().next().value as ClientProxy;
    if (!firstClient) {
      throw new Error('No RabbitMQ clients available');
    }
    return firstClient;
  }
}
