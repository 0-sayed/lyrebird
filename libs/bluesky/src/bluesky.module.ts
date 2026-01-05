import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BlueskyClientService } from './bluesky-client.service';

@Module({
  imports: [ConfigModule],
  providers: [BlueskyClientService],
  exports: [BlueskyClientService],
})
export class BlueskyModule {}
