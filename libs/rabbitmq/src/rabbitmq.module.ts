import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RabbitmqService } from './rabbitmq.service';

@Global() // Make available to all modules without explicit import
@Module({
  imports: [ConfigModule],
  providers: [RabbitmqService],
  exports: [RabbitmqService],
})
export class RabbitmqModule {}
