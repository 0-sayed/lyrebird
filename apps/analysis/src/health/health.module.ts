import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { RabbitmqModule } from '@app/rabbitmq';
import { DatabaseModule } from '@app/database/database.module';

@Module({
  imports: [RabbitmqModule, DatabaseModule],
  controllers: [HealthController],
})
export class HealthModule {}
