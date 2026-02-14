import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { Logger } from 'nestjs-pino';
import { IngestionModule } from './ingestion.module';
import {
  RABBITMQ_CONSTANTS,
  buildRabbitMqUrl,
  getSanitizedRabbitMqUrl,
} from '@app/rabbitmq/rabbitmq.constants';

async function bootstrap() {
  // HTTP port for health checks
  const httpPort = process.env.INGESTION_PORT || 3001;

  // Build RabbitMQ URL
  const rabbitmqUrl = buildRabbitMqUrl();
  const queue = RABBITMQ_CONSTANTS.QUEUES.INGESTION;

  // Create hybrid application (HTTP + Microservice)
  // bufferLogs ensures logs during bootstrap are captured
  const app = await NestFactory.create(IngestionModule, { bufferLogs: true });

  // Use Pino logger for all NestJS logging
  const logger = app.get(Logger);
  app.useLogger(logger);

  logger.log(`RabbitMQ: ${getSanitizedRabbitMqUrl(rabbitmqUrl)}`);

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

bootstrap().catch((err) => {
  // Use console.error for bootstrap failures since the app may not be initialized
  console.error(
    'Failed to start Ingestion service:',
    err instanceof Error ? err.stack : String(err),
  );
  process.exit(1);
});
