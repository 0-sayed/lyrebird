import { Module } from '@nestjs/common';
import { BlueskyModule } from '@app/bluesky';
import { PollingScraperService } from './polling-scraper.service';

@Module({
  imports: [BlueskyModule],
  providers: [PollingScraperService],
  exports: [PollingScraperService],
})
export class ScrapersModule {}
