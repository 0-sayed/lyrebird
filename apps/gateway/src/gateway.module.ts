import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { GatewayController } from './gateway.controller';
import { GatewayService } from './gateway.service';
import { JobEventsController } from './controllers/job-events.controller';
import { JobSseController } from './controllers/job-sse.controller';
import { JobEventsService } from './services/job-events.service';
import { DatabaseModule, DatabaseService } from '@app/database';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { createAuth } from './auth';
import { LoggerModule } from '@app/logger';
import { RabbitmqModule } from '@app/rabbitmq';
import { HealthModule } from './health/health.module';
import { HttpExceptionFilter } from './filters/http-exception.filter';
import { CorrelationIdInterceptor } from './interceptors/correlation-id.interceptor';
import { TestControlModule } from './controllers/test-control.module';

/**
 * Conditionally import TestControlModule only when explicitly enabled in test mode.
 * Requires both NODE_ENV=test AND ENABLE_TEST_ENDPOINTS=true as a defence-in-depth
 * measure against accidental exposure. The dedicated E2E server (e2e-server.ts)
 * registers TestControlController directly, so this flag does not affect E2E tests.
 */
const testModules =
  process.env.NODE_ENV === 'test' &&
  process.env.ENABLE_TEST_ENDPOINTS === 'true'
    ? [TestControlModule]
    : [];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot({
      // Enable wildcard support for patterns like 'job.*'
      wildcard: true,
      // Use '.' as namespace delimiter
      delimiter: '.',
      // Don't throw on unhandled events
      ignoreErrors: false,
    }),
    DatabaseModule,
    AuthModule.forRootAsync({
      inject: [DatabaseService],
      useFactory: (databaseService: DatabaseService) => ({
        auth: createAuth(databaseService),
        withGlobalGuard: true,
      }),
    }),
    LoggerModule,
    RabbitmqModule,
    HealthModule,
    ...testModules,
  ],
  controllers: [GatewayController, JobEventsController, JobSseController],
  providers: [
    GatewayService,
    JobEventsService,
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
export class GatewayModule {}
