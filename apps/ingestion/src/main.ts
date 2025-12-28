import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { Logger } from '@nestjs/common';
import { IngestionModule } from './ingestion.module';
import {
  RABBITMQ_CONSTANTS,
  buildRabbitMqUrl,
  getSanitizedRabbitMqUrl,
} from '@app/rabbitmq/rabbitmq.constants';

async function bootstrap() {
  const logger = new Logger('IngestionBootstrap');

  // HTTP port for health checks
  const httpPort = process.env.INGESTION_PORT || 3001;

  // Build RabbitMQ URL
  const rabbitmqUrl = buildRabbitMqUrl();
  const queue = RABBITMQ_CONSTANTS.QUEUES.INGESTION;

  logger.log(`RabbitMQ: ${getSanitizedRabbitMqUrl(rabbitmqUrl)}`);

  // Create hybrid application (HTTP + Microservice)
  const app = await NestFactory.create(IngestionModule);

  // Connect microservice transport (RabbitMQ)
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [rabbitmqUrl],
      queue,
      queueOptions: {
        durable: RABBITMQ_CONSTANTS.DEFAULTS.QUEUE_DURABLE,
      },
      noAck: RABBITMQ_CONSTANTS.DEFAULTS.NO_ACK, // false = manual ack
      prefetchCount: RABBITMQ_CONSTANTS.DEFAULTS.PREFETCH_COUNT,
    },
  });

  // Start all microservices
  await app.startAllMicroservices();

  // Start HTTP server for health checks
  await app.listen(httpPort);

  logger.log(`Ingestion HTTP server: http://localhost:${httpPort}`);
  logger.log(`Health Check: http://localhost:${httpPort}/health`);
  logger.log(`Listening for RabbitMQ messages on queue: ${queue}`);
}

bootstrap().catch((error) => {
  const logger = new Logger('IngestionBootstrap');
  logger.error(
    'Failed to start Ingestion service',
    error instanceof Error ? error.stack : String(error),
  );
  process.exit(1);
});
