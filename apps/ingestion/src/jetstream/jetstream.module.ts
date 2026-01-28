import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BlueskyModule } from '@app/bluesky';
import { JobRegistryService } from './job-registry.service';
import { KeywordFilterService } from './keyword-filter.service';
import { JetstreamManagerService } from './jetstream-manager.service';

/**
 * JetstreamModule - NestJS module for Jetstream integration
 *
 * This module provides services for real-time post streaming from Bluesky
 * via the Jetstream API. It includes:
 *
 * - JetstreamManagerService: Orchestrates Jetstream connection lifecycle and job management
 * - JobRegistryService: Manages active jobs and their keyword patterns
 * - KeywordFilterService: Matches incoming posts against active jobs
 *
 * The JetstreamClientService is imported from BlueskyModule.
 *
 * Usage:
 * Import this module in the IngestionModule to enable Jetstream-based
 * data ingestion.
 *
 * Example:
 * ```typescript
 * // In IngestionModule
 * @Module({
 *   imports: [JetstreamModule],
 *   // ...
 * })
 * export class IngestionModule {}
 *
 * // In IngestionService
 * await this.jetstreamManager.registerJob({
 *   jobId: 'job-123',
 *   prompt: 'search term',
 *   correlationId: 'req-abc',
 *   maxDurationMs: 120000,
 *   onData: (data) => this.rabbitmq.emit('raw-data', data),
 *   onComplete: (count) => console.log(`Done: ${count} posts`),
 * });
 * ```
 */
@Module({
  imports: [ConfigModule, BlueskyModule],
  providers: [
    JobRegistryService,
    KeywordFilterService,
    JetstreamManagerService,
  ],
  exports: [JobRegistryService, KeywordFilterService, JetstreamManagerService],
})
export class JetstreamModule {}
