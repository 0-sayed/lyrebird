import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AnalysisController } from './analysis.controller';
import { AnalysisService } from './analysis.service';
import { DatabaseModule } from '@app/database';
import { LoggerModule } from '@app/logger';
import { RabbitmqModule } from '@app/rabbitmq';
import { HealthModule } from './health/health.module';
import { SentimentModule } from './services/sentiment.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    LoggerModule,
    RabbitmqModule,
    HealthModule,
    SentimentModule,
  ],
  controllers: [AnalysisController],
  providers: [AnalysisService],
})
export class AnalysisModule {}
