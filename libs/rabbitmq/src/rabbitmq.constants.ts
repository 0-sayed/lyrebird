/**
 * RabbitMQ Application Constants
 *
 * These are application-level constants that define your messaging architecture.
 * They should NOT be in environment variables as they are part of your app design.
 */

import { ConfigService } from '@nestjs/config';

export const RABBITMQ_CONSTANTS = {
  // Queue names
  QUEUES: {
    LYREBIRD_MAIN: 'lyrebird_queue',
  },

  // Exchange names (for future use)
  EXCHANGES: {
    LYREBIRD_TOPIC: 'lyrebird.topic',
  },

  // Connection defaults
  DEFAULTS: {
    PREFETCH_COUNT: 1,
    QUEUE_DURABLE: true,
    NO_ACK: false,
  },
} as const;

/**
 * Build RabbitMQ URL from environment configuration
 * This ensures consistent URL construction across all services
 */
export function buildRabbitMqUrl(configService: ConfigService): string {
  const host = configService.get<string>('RABBITMQ_HOST', 'localhost');
  const port = configService.get<number>('RABBITMQ_PORT', 5672);
  const user = configService.get<string>('RABBITMQ_USER', 'guest');
  const password = configService.get<string>('RABBITMQ_PASSWORD', 'guest');
  const vhost = configService.get<string>('RABBITMQ_VHOST', '/');

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
