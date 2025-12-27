import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseService } from './database.service';
import { JobsRepository } from './repositories/jobs.repository';
import { SentimentDataRepository } from './repositories/sentiment-data.repository';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [DatabaseService, JobsRepository, SentimentDataRepository],
  exports: [DatabaseService, JobsRepository, SentimentDataRepository],
})
export class DatabaseModule {}
