import { Module } from '@nestjs/common';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';

@Module({
  imports: [],
  controllers: [IngestionController],
  providers: [IngestionService],
})
export class IngestionModule {}
