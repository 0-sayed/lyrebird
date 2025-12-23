import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseService } from './database.service';
import { JobsRepository } from './repositories/jobs.repository';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [DatabaseService, JobsRepository],
  exports: [DatabaseService, JobsRepository],
})
export class DatabaseModule {}
