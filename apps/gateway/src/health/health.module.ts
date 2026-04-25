import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { DatabaseModule } from '@app/database';
import { RabbitmqModule } from '@app/rabbitmq';
import { HealthController } from './health.controller';

@Module({
  imports: [TerminusModule, RabbitmqModule, DatabaseModule],
  controllers: [HealthController],
})
export class HealthModule {}
