/**
 * RabbitMQ Application Constants
 *
 * These are application-level constants that define your messaging architecture.
 * They should NOT be in environment variables as they are part of your app design.
 */

import { ConfigService } from '@nestjs/config';

export const RABBITMQ_CONSTANTS = {
  // Queue names - each service has its own queue
  QUEUES: {
    INGESTION: 'lyrebird.ingestion',
    ANALYSIS: 'lyrebird.analysis',
    GATEWAY: 'lyrebird.gateway',
  },

  // Exchange names (for future use with topic routing)
  EXCHANGES: {
    LYREBIRD_TOPIC: 'lyrebird.topic',
  },

  // Connection defaults
  DEFAULTS: {
    /**
     * Default prefetch count for message consumption.
     * A value of 1 ensures strict ordering but limits throughput.
     * For high-throughput scenarios (like the Analysis service processing
     * HuggingFace API calls at 200-400ms each), increase via environment variable.
     */
    PREFETCH_COUNT: 1,
    QUEUE_DURABLE: true,
    NO_ACK: false,
  },

  /**
   * Analysis service specific settings.
   * The analysis service benefits from higher prefetch counts because
   * each message involves a slow external API call (HuggingFace ~200-400ms).
   * Higher prefetch allows concurrent processing while waiting for API responses.
   */
  ANALYSIS: {
    /**
     * Default prefetch count for Analysis service.
     * Set to 10 to allow processing up to 10 posts concurrently.
     * This significantly improves throughput when using HuggingFace API.
     * Can be overridden via ANALYSIS_PREFETCH_COUNT environment variable.
     */
    DEFAULT_PREFETCH_COUNT: 10,
  },
} as const;

/**
 * Pattern to Queue routing map
 * Defines which queue should receive messages for each pattern
 */
export const PATTERN_TO_QUEUE: Record<string, string> = {
  'job.start': RABBITMQ_CONSTANTS.QUEUES.INGESTION,
  'job.cancel': RABBITMQ_CONSTANTS.QUEUES.INGESTION, // Gateway → Ingestion (stop processing)
  'job.raw_data': RABBITMQ_CONSTANTS.QUEUES.ANALYSIS,
  'job.initial_batch_complete': RABBITMQ_CONSTANTS.QUEUES.GATEWAY, // Initial fetch done, transition to IN_PROGRESS
  'job.ingestion_complete': RABBITMQ_CONSTANTS.QUEUES.ANALYSIS, // All polling ended
  'job.complete': RABBITMQ_CONSTANTS.QUEUES.GATEWAY,
  'job.failed': RABBITMQ_CONSTANTS.QUEUES.GATEWAY,
  'job.data_update': RABBITMQ_CONSTANTS.QUEUES.GATEWAY,
  'health.check': RABBITMQ_CONSTANTS.QUEUES.GATEWAY,
};

/**
 * Get the target queue for a given message pattern
 */
export function getQueueForPattern(pattern: string): string {
  const queue = PATTERN_TO_QUEUE[pattern];
  if (!queue) {
    throw new Error(`No queue configured for pattern: ${pattern}`);
  }
  return queue;
}

/**
 * Build RabbitMQ URL from environment variables directly.
 * Use this in bootstrap/main.ts before NestJS DI is available.
 */
export function buildRabbitMqUrl(): string;

/**
 * Build RabbitMQ URL using ConfigService.
 * Use this inside NestJS DI context (services, modules).
 */
export function buildRabbitMqUrl(configService: ConfigService): string;

/**
 * Implementation: Build RabbitMQ URL from environment configuration.
 * This ensures consistent URL construction across all services.
 */
export function buildRabbitMqUrl(configService?: ConfigService): string {
  const host =
    configService?.get<string>('RABBITMQ_HOST') ??
    process.env.RABBITMQ_HOST ??
    'localhost';
  const port =
    configService?.get<number>('RABBITMQ_PORT') ??
    process.env.RABBITMQ_PORT ??
    '5672';
  const user =
    configService?.get<string>('RABBITMQ_USER') ??
    process.env.RABBITMQ_USER ??
    'guest';
  const password =
    configService?.get<string>('RABBITMQ_PASSWORD') ??
    process.env.RABBITMQ_PASSWORD ??
    'guest';
  const vhost =
    configService?.get<string>('RABBITMQ_VHOST') ??
    process.env.RABBITMQ_VHOST ??
    '/';

  // Encode vhost if it's not the default '/'
  const encodedVhost = vhost === '/' ? '' : `/${encodeURIComponent(vhost)}`;

  return `amqp://${user}:${password}@${host}:${port}${encodedVhost}`;
}

/**
 * Get sanitized RabbitMQ URL for logging (hides password)
 */
export function getSanitizedRabbitMqUrl(url: string): string {
  return url.replace(/(:\/\/[^:]+:)[^@]+(@)/, '$1****$2');
}
