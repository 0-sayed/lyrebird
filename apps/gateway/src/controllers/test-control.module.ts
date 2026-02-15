import { Module } from '@nestjs/common';
import { DatabaseModule } from '@app/database';
import { TestControlController } from './test-control.controller';

/**
 * Test-only module for controlling SSE events from Playwright
 * Only imported when NODE_ENV === 'test'
 */
@Module({
  imports: [DatabaseModule],
  controllers: [TestControlController],
})
export class TestControlModule {}
