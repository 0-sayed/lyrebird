import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AnalysisController } from './analysis.controller';
import { AnalysisService } from './analysis.service';
import { DatabaseModule } from '@app/database/database.module';
import { RabbitmqModule } from '@app/rabbitmq';
import { HealthModule } from './health/health.module';
import { BertSentimentService } from './services/bert-sentiment.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    RabbitmqModule,
    HealthModule,
  ],
  controllers: [AnalysisController],
  providers: [AnalysisService, BertSentimentService],
  exports: [BertSentimentService],
})
export class AnalysisModule {}
