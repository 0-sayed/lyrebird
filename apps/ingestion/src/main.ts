import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { IngestionModule } from './ingestion.module';
import { Logger } from '@nestjs/common';
import {
  RABBITMQ_CONSTANTS,
  buildRabbitMqUrl,
  getSanitizedRabbitMqUrl,
} from '@app/rabbitmq/rabbitmq.constants';

async function bootstrap() {
  const logger = new Logger('IngestionBootstrap');

  // Build RabbitMQ URL using shared utility (reads from process.env)
  const rabbitmqUrl = buildRabbitMqUrl();
  const queue = RABBITMQ_CONSTANTS.QUEUES.LYREBIRD_MAIN;

  logger.log(`Connecting to: ${getSanitizedRabbitMqUrl(rabbitmqUrl)}`);

  // Create microservice
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    IngestionModule,
    {
      transport: Transport.RMQ,
      options: {
        urls: [rabbitmqUrl],
        queue,
        queueOptions: {
          durable: RABBITMQ_CONSTANTS.DEFAULTS.QUEUE_DURABLE,
        },
        noAck: RABBITMQ_CONSTANTS.DEFAULTS.NO_ACK,
        prefetchCount: RABBITMQ_CONSTANTS.DEFAULTS.PREFETCH_COUNT,
        wildcards: true,
      },
    },
  );

  await app.listen();
  logger.log('Ingestion service is listening for messages');
}

bootstrap().catch((error) => {
  const logger = new Logger('IngestionBootstrap');
  logger.error(
    'Failed to start Ingestion service',
    error instanceof Error ? error.stack : String(error),
  );
  process.exit(1);
});
