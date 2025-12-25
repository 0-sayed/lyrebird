import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { GatewayModule } from './gateway.module';

async function bootstrap() {
  const app = await NestFactory.create(GatewayModule);

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

  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('Lyrebird API Gateway')
    .setDescription('Real-time sentiment analysis API')
    .setVersion('1.0')
    .addTag('jobs', 'Sentiment analysis jobs')
    .addTag('health', 'Health check endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.GATEWAY_PORT || 3000;
  await app.listen(port);

  new Logger('Bootstrap').log(
    JSON.stringify({
      event: 'service_started',
      service: 'gateway',
      version: '1.0.0',
      port: Number(port),
      environment: process.env.NODE_ENV || 'development',
      endpoints: {
        docs: '/api/docs',
        health: '/api/health',
      },
      timestamp: new Date().toISOString(),
      pid: process.pid,
    }),
  );
}

bootstrap().catch((err) => {
  const logger = new Logger('Bootstrap');
  logger.error(
    'Failed to start application',
    err instanceof Error ? err.stack : String(err),
  );
  process.exit(1);
});
