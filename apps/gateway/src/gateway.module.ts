import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { GatewayController } from './gateway.controller';
import { GatewayService } from './gateway.service';
import { DatabaseModule } from '@app/database/database.module';
import { RabbitmqModule } from '@app/rabbitmq';
import { HealthModule } from './health/health.module';
import { HttpExceptionFilter } from './filters/http-exception.filter';
import { CorrelationIdInterceptor } from './interceptors/correlation-id.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    RabbitmqModule,
    HealthModule,
  ],
  controllers: [GatewayController],
  providers: [
    GatewayService,
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
