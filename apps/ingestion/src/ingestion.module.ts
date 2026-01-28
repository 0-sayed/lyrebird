import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';
import { DatabaseModule } from '@app/database/database.module';
import { RabbitmqModule } from '@app/rabbitmq';
import { HealthModule } from './health/health.module';
import { JetstreamModule } from './jetstream/jetstream.module';

/**
 * IngestionModule - Main module for the ingestion microservice
 *
 * Architecture (Jan 2026 - Jetstream Only):
 * - Real-time streaming via Bluesky Jetstream WebSocket API
 * - Sub-second latency (no indexing delay)
 * - Single WebSocket connection shared across all jobs
 *
 * Output: RawDataMessage via RabbitMQ
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    RabbitmqModule,
    HealthModule,
    JetstreamModule,
  ],
  controllers: [IngestionController],
  providers: [IngestionService],
})
export class IngestionModule {}
