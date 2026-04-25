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
import { connect } from 'amqplib';
import type { Channel, ChannelModel } from 'amqplib';
import { lastValueFrom } from 'rxjs';
import {
  RABBITMQ_CONSTANTS,
  buildRabbitMqUrl,
  getSanitizedRabbitMqUrl,
  getQueueForPattern,
} from './rabbitmq.constants';

export interface RabbitmqHealthStatus {
  healthy: boolean;
  connected: boolean;
  initializedQueues: string[];
  lastError?: string;
}

export interface RabbitmqBackpressureStatus {
  queue: string;
  messageCount: number;
  consumerCount: number;
  threshold: number;
  isBackpressured: boolean;
}

@Injectable()
export class RabbitmqService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitmqService.name);

  // Map of queue name -> ClientProxy
  private clients: Map<string, ClientProxy> = new Map();
  private monitorConnection?: ChannelModel;
  private monitorChannel?: Pick<Channel, 'checkQueue' | 'close'>;
  private monitorUrl?: string;
  private monitorReconnectPromise?: Promise<void>;
  private monitorConnected = false;
  private lastMonitorError?: string;

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
      this.monitorUrl = url;
      try {
        await this.initializeMonitor(url);
      } catch (error) {
        this.lastMonitorError =
          error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `RabbitMQ monitor connection unavailable: ${this.lastMonitorError}`,
        );
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

      const closeResults = await Promise.allSettled(
        Array.from(this.clients.entries()).map(async ([queue, client]) => {
          await client.close();
          this.logger.debug(`Closed connection to queue: ${queue}`);
        }),
      );
      await this.closeMonitor();

      this.clients.clear();
      this.logger.log('All RabbitMQ connections closed');

      const closeErrors = closeResults.filter(
        (result): result is PromiseRejectedResult =>
          result.status === 'rejected',
      );

      if (closeErrors.length > 0) {
        throw closeErrors[0].reason;
      }
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
      return (await this.getHealthStatus()).healthy;
    } catch (error) {
      this.logger.error(
        'RabbitMQ health check failed',
        error instanceof Error ? error.stack : String(error),
      );
      return false;
    }
  }

  async getHealthStatus(): Promise<RabbitmqHealthStatus> {
    await this.ensureMonitorConnected();

    const initializedQueues = Array.from(this.clients.keys());
    const expectedQueues = Object.values(RABBITMQ_CONSTANTS.QUEUES);
    const allExpectedQueuesInitialized = expectedQueues.every((queue) =>
      this.clients.has(queue),
    );
    const connected =
      this.monitorConnected &&
      this.monitorConnection !== undefined &&
      this.monitorChannel !== undefined;

    return {
      healthy: connected && allExpectedQueuesInitialized,
      connected,
      initializedQueues,
      ...(this.lastMonitorError
        ? { lastError: this.lastMonitorError }
        : undefined),
    };
  }

  async getBackpressureStatus(
    queue: string,
    threshold = 100,
  ): Promise<RabbitmqBackpressureStatus> {
    await this.ensureMonitorConnected();

    if (!this.monitorConnected || !this.monitorChannel) {
      return this.createUnavailableBackpressureStatus(queue, threshold);
    }

    try {
      const queueStatus = await this.monitorChannel.checkQueue(queue);

      return {
        queue,
        messageCount: queueStatus.messageCount,
        consumerCount: queueStatus.consumerCount,
        threshold,
        isBackpressured: queueStatus.messageCount >= threshold,
      };
    } catch (error) {
      this.lastMonitorError =
        error instanceof Error ? error.message : String(error);
      return this.createUnavailableBackpressureStatus(queue, threshold);
    }
  }

  private async initializeMonitor(url: string): Promise<void> {
    this.monitorConnection = await connect(url);
    this.monitorChannel = await this.monitorConnection.createChannel();
    this.monitorConnected = true;
    this.lastMonitorError = undefined;

    this.monitorConnection.on('close', () => {
      this.handleMonitorDisconnect();
    });
    this.monitorConnection.on('error', (error: unknown) => {
      this.handleMonitorDisconnect(error instanceof Error ? error : undefined);
    });
  }

  private async ensureMonitorConnected(): Promise<void> {
    if (
      this.monitorConnected &&
      this.monitorConnection !== undefined &&
      this.monitorChannel !== undefined
    ) {
      return;
    }

    if (!this.monitorUrl) {
      return;
    }

    if (!this.monitorReconnectPromise) {
      this.monitorReconnectPromise = this.initializeMonitor(this.monitorUrl)
        .catch((error) => {
          this.lastMonitorError =
            error instanceof Error ? error.message : String(error);
          this.logger.warn(
            `RabbitMQ monitor reconnect failed: ${this.lastMonitorError}`,
          );
        })
        .finally(() => {
          this.monitorReconnectPromise = undefined;
        });
    }

    await this.monitorReconnectPromise;
  }

  private handleMonitorDisconnect(error?: Error): void {
    this.monitorConnected = false;
    this.monitorChannel = undefined;
    this.monitorConnection = undefined;
    this.lastMonitorError =
      error?.message ?? 'RabbitMQ monitor connection closed';
  }

  private async closeMonitor(): Promise<void> {
    const channel = this.monitorChannel;
    const connection = this.monitorConnection;
    this.monitorChannel = undefined;
    this.monitorConnection = undefined;
    this.monitorUrl = undefined;
    this.monitorReconnectPromise = undefined;
    this.monitorConnected = false;
    this.lastMonitorError = undefined;

    try {
      await channel?.close();
    } finally {
      await connection?.close();
    }
  }

  private createUnavailableBackpressureStatus(
    queue: string,
    threshold: number,
  ): RabbitmqBackpressureStatus {
    return {
      queue,
      messageCount: -1,
      consumerCount: 0,
      threshold,
      isBackpressured: true,
    };
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
