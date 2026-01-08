import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { RabbitmqModule } from '@app/rabbitmq';
import { DatabaseModule } from '@app/database/database.module';
import { BertSentimentService } from '../services/bert-sentiment.service';

@Module({
  imports: [RabbitmqModule, DatabaseModule],
  controllers: [HealthController],
  providers: [BertSentimentService],
})
export class HealthModule {}
