import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { GatewayModule } from './gateway.module';
import {
  RABBITMQ_CONSTANTS,
  buildRabbitMqUrl,
  getSanitizedRabbitMqUrl,
} from '@app/rabbitmq/rabbitmq.constants';

async function bootstrap() {
  const logger = new Logger('GatewayBootstrap');

  const HTTP_PORT = process.env.GATEWAY_PORT || 3000;

  // Build RabbitMQ URL
  const rabbitmqUrl = buildRabbitMqUrl();
  const queue = RABBITMQ_CONSTANTS.QUEUES.GATEWAY;

  logger.log(`RabbitMQ: ${getSanitizedRabbitMqUrl(rabbitmqUrl)}`);

  // Create hybrid application (HTTP + Microservice)
  const app = await NestFactory.create(GatewayModule);

  // Enable CORS for frontend development
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  });

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

  // Global middleware
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Lyrebird API Gateway')
    .setDescription('Real-time sentiment analysis API')
    .setVersion('1.0')
    .addTag('jobs', 'Sentiment analysis jobs')
    .addTag('health', 'Health check endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Start all microservices (RabbitMQ consumer)
  await app.startAllMicroservices();

  // Start HTTP server
  await app.listen(HTTP_PORT);

  logger.log(
    JSON.stringify({
      event: 'service_started',
      service: 'gateway',
      version: '1.0.0',
      port: Number(HTTP_PORT),
      environment: process.env.NODE_ENV || 'development',
      endpoints: {
        docs: '/api/docs',
        health: '/health',
      },
      timestamp: new Date().toISOString(),
      pid: process.pid,
    }),
  );
}

bootstrap().catch((err) => {
  const logger = new Logger('GatewayBootstrap');
  logger.error(
    'Failed to start application',
    err instanceof Error ? err.stack : String(err),
  );
  process.exit(1);
});
