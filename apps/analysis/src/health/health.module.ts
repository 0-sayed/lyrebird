import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { RabbitmqModule } from '@app/rabbitmq';
import { DatabaseModule } from '@app/database/database.module';
import { SentimentModule } from '../services/sentiment.module';

@Module({
  imports: [RabbitmqModule, DatabaseModule, SentimentModule],
  controllers: [HealthController],
})
export class HealthModule {}
