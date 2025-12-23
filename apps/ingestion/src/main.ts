import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { IngestionModule } from './ingestion.module';
import { Logger } from '@nestjs/common';
import {
  RABBITMQ_CONSTANTS,
  buildRabbitMqUrl,
  getSanitizedRabbitMqUrl,
} from '@app/rabbitmq/rabbitmq.constants';

async function bootstrap() {
  const logger = new Logger('IngestionBootstrap');

  // Create application context to access ConfigService
  const appContext =
    await NestFactory.createApplicationContext(IngestionModule);
  const configService = appContext.get(ConfigService);

  // Build RabbitMQ URL using shared utility
  const rabbitmqUrl = buildRabbitMqUrl(configService);
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
  console.error('Failed to start Ingestion service:', error);
  process.exit(1);
});
