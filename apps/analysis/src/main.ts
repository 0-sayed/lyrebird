import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { Logger } from '@nestjs/common';
import { AnalysisModule } from './analysis.module';
import {
  RABBITMQ_CONSTANTS,
  buildRabbitMqUrl,
  getSanitizedRabbitMqUrl,
} from '@app/rabbitmq/rabbitmq.constants';

async function bootstrap() {
  const logger = new Logger('AnalysisBootstrap');

  // HTTP port for health checks
  const httpPort = process.env.ANALYSIS_PORT || 3002;

  // Build RabbitMQ URL
  const rabbitmqUrl = buildRabbitMqUrl();
  const queue = RABBITMQ_CONSTANTS.QUEUES.ANALYSIS;

  logger.log(`RabbitMQ: ${getSanitizedRabbitMqUrl(rabbitmqUrl)}`);

  // Create hybrid application (HTTP + Microservice)
  const app = await NestFactory.create(AnalysisModule);

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

  logger.log(`Analysis HTTP server: http://localhost:${httpPort}`);
  logger.log(`Health Check: http://localhost:${httpPort}/health`);
  logger.log(`Listening for RabbitMQ messages on queue: ${queue}`);
}

bootstrap().catch((err) => {
  const logger = new Logger('AnalysisBootstrap');
  logger.error(
    'Failed to start Analysis service',
    err instanceof Error ? err.stack : String(err),
  );
  process.exit(1);
});
