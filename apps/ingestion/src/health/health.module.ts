import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { RabbitmqModule } from '@app/rabbitmq';
import { DatabaseModule } from '@app/database';
import { JetstreamModule } from '../jetstream/jetstream.module';

@Module({
  imports: [RabbitmqModule, DatabaseModule, JetstreamModule],
  controllers: [HealthController],
})
export class HealthModule {}
