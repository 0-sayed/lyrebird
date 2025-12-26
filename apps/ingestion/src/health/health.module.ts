import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { RabbitmqModule } from '@app/rabbitmq';

@Module({
  imports: [RabbitmqModule],
  controllers: [HealthController],
})
export class HealthModule {}
