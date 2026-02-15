/**
 * Standalone E2E test server for Playwright tests
 *
 * This server runs Gateway with mocked dependencies:
 * - In-memory job and sentiment data repositories (no database)
 * - Mock RabbitMQ service (no message broker)
 * - Real EventEmitter2 (for SSE events)
 * - TestControlModule (for triggering SSE events from Playwright)
 *
 * Usage:
 *   NODE_ENV=test npx ts-node apps/gateway/test/e2e-server.ts
 *   NODE_ENV=test node dist/apps/gateway/e2e-server.js (after build)
 */

// Type augmentation for Express Request with correlationId
// This duplicates apps/gateway/src/types/express.d.ts for ts-node compatibility
declare module 'express' {
  interface Request {
    id?: string | number;
    correlationId?: string;
  }
}

import { NestFactory } from '@nestjs/core';
import { Module, ValidationPipe, Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';

// Gateway controllers and services
import { GatewayController } from '../src/gateway.controller';
import { GatewayService } from '../src/gateway.service';
import { JobEventsController } from '../src/controllers/job-events.controller';
import { JobSseController } from '../src/controllers/job-sse.controller';
import { JobEventsService } from '../src/services/job-events.service';
import { TestControlController } from '../src/controllers/test-control.controller';
import { HealthModule } from '../src/health/health.module';
import { HttpExceptionFilter } from '../src/filters/http-exception.filter';
import { CorrelationIdInterceptor } from '../src/interceptors/correlation-id.interceptor';

// Stubs
import { JobRepositoryStub } from './stubs/job-repository.stub';
import { SentimentDataRepositoryStub } from './stubs/sentiment-data-repository.stub';

// Real types for provider tokens
import { JobsRepository, SentimentDataRepository } from '@app/database';
import { RabbitmqService } from '@app/rabbitmq';
import { LoggerModule } from '@app/logger';

/**
 * Mock RabbitMQ service that does nothing
 * All message publishing is a no-op since we're testing via HTTP/SSE only
 */
class RabbitmqServiceMock {
  private readonly logger = new Logger(RabbitmqServiceMock.name);

  emit(pattern: string, data: unknown): void {
    this.logger.debug(`[MOCK] emit(${pattern}): ${JSON.stringify(data)}`);
  }

  send<TResult = unknown>(pattern: string, data: unknown): Promise<TResult> {
    this.logger.debug(`[MOCK] send(${pattern}): ${JSON.stringify(data)}`);
    return Promise.resolve({} as TResult);
  }

  healthCheck(): Promise<boolean> {
    return Promise.resolve(true);
  }

  isInitialized(): boolean {
    return true;
  }
}

/**
 * E2E Test Module
 *
 * This module mirrors GatewayModule but uses in-memory stubs
 * instead of real database and message broker connections.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      ignoreErrors: false,
    }),
    LoggerModule,
    HealthModule,
  ],
  controllers: [
    GatewayController,
    JobEventsController,
    JobSseController,
    TestControlController,
  ],
  providers: [
    GatewayService,
    JobEventsService,
    // Override database repositories with in-memory stubs
    {
      provide: JobsRepository,
      useClass: JobRepositoryStub,
    },
    {
      provide: SentimentDataRepository,
      useClass: SentimentDataRepositoryStub,
    },
    // Mock RabbitMQ service
    {
      provide: RabbitmqService,
      useClass: RabbitmqServiceMock,
    },
    // Global filters and interceptors
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: CorrelationIdInterceptor,
    },
  ],
})
class E2ETestModule {}

async function bootstrap() {
  const logger = new Logger('E2EServer');
  const port = process.env.GATEWAY_PORT || 3333;

  if (process.env.NODE_ENV !== 'test') {
    logger.error('E2E server must run with NODE_ENV=test');
    process.exit(1);
  }

  logger.log('Starting E2E test server with mocked dependencies...');

  const app = await NestFactory.create(E2ETestModule, {
    logger: ['log', 'error', 'warn', 'debug'],
  });

  // Enable CORS for frontend dev server
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5174',
    credentials: true,
  });

  // Global validation pipe (same as production)
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

  await app.listen(port);

  logger.log(`E2E test server running on http://localhost:${port}`);
  logger.log(`Health check: http://localhost:${port}/health/ready`);
  logger.log(`Test control API: http://localhost:${port}/__test/*`);
  logger.log('Press Ctrl+C to stop');
}

bootstrap().catch((err) => {
  console.error('Failed to start E2E server:', err);
  process.exit(1);
});
