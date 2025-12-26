import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';
import { DatabaseModule } from '@app/database/database.module';
import { RabbitmqModule } from '@app/rabbitmq';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    RabbitmqModule,
    HealthModule, // Add health check endpoints
  ],
  controllers: [IngestionController],
  providers: [IngestionService],
})
export class IngestionModule {}
