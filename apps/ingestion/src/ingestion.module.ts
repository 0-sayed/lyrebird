import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';
import { DatabaseModule } from '@app/database/database.module';
import { RabbitmqModule } from '@app/rabbitmq';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    RabbitmqModule,
  ],
  controllers: [IngestionController],
  providers: [IngestionService],
})
export class IngestionModule {}
