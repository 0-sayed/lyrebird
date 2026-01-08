import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RabbitmqService } from '@app/rabbitmq';
import {
  MESSAGE_PATTERNS,
  StartJobMessage,
  IngestionCompleteMessage,
} from '@app/shared-types';
import { PollingScraperService } from './scrapers/polling-scraper.service';

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  private readonly defaultPollIntervalMs: number;
  private readonly defaultMaxDurationMs: number;

  constructor(
    private rabbitmqService: RabbitmqService,
    private pollingScraperService: PollingScraperService,
    private configService: ConfigService,
  ) {
    this.defaultPollIntervalMs = this.configService.get<number>(
      'BLUESKY_POLL_INTERVAL_MS',
      5000,
    );
    this.defaultMaxDurationMs = this.configService.get<number>(
      'BLUESKY_MAX_DURATION_MS',
      600000, // 10 minutes default
    );
  }

  /**
   * Process incoming job with real Bluesky data using polling mode
   *
   * Uses the PollingScraperService which does both:
   * 1. Initial one-shot fetch (last hour of posts)
   * 2. Continuous polling (every 5s) for new posts
   *
   * This implements the industry-standard "near-real-time" pattern used by
   * Brandwatch, Meltwater, and Sprout Social.
   */
  async processJob(
    message: StartJobMessage,
    correlationId: string,
  ): Promise<void> {
    const startTime = Date.now();
    let itemCount = 0;

    try {
      this.logger.log(`[${correlationId}] Processing job: ${message.jobId}`);
      this.logger.log(`[${correlationId}] Search prompt: "${message.prompt}"`);

      // Determine polling configuration from message options or defaults
      const pollIntervalMs =
        message.options?.polling?.pollIntervalMs ?? this.defaultPollIntervalMs;
      const maxDurationMs =
        message.options?.polling?.maxDurationMs ?? this.defaultMaxDurationMs;

      this.logger.log(
        `[${correlationId}] Starting polling: interval ${pollIntervalMs}ms, duration ${maxDurationMs}ms`,
      );

      // Use Promise wrapper to handle completion
      await new Promise<void>((resolve, reject) => {
        this.pollingScraperService
          .startPollingJob({
            jobId: message.jobId,
            prompt: message.prompt,
            correlationId,
            pollIntervalMs,
            maxDurationMs,
            onData: (rawData) => {
              this.rabbitmqService.emit(MESSAGE_PATTERNS.JOB_RAW_DATA, rawData);
              this.logger.debug(
                `[${correlationId}] Published raw data: ${rawData.textContent.substring(0, 50)}...`,
              );
              itemCount++;
              return Promise.resolve();
            },
            onComplete: () => {
              const duration = Date.now() - startTime;
              this.logger.log(
                `[${correlationId}] Ingestion completed in ${duration}ms, published ${itemCount} items`,
              );

              // Signal Analysis service that all data has been sent
              const ingestionComplete: IngestionCompleteMessage = {
                jobId: message.jobId,
                totalItems: itemCount,
                completedAt: new Date(),
              };
              this.rabbitmqService.emit(
                MESSAGE_PATTERNS.JOB_INGESTION_COMPLETE,
                ingestionComplete,
              );
              this.logger.log(
                `[${correlationId}] Published JOB_INGESTION_COMPLETE: ${itemCount} items`,
              );

              resolve();
            },
          })
          .catch(reject);
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `[${correlationId}] Job failed after ${duration}ms`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * Stop an active polling job
   */
  stopJob(jobId: string): void {
    this.pollingScraperService.stopPollingJob(jobId);
    this.logger.log(`Stopped job: ${jobId}`);
  }

  /**
   * Check if a job is currently running
   */
  isJobActive(jobId: string): boolean {
    return this.pollingScraperService.isJobActive(jobId);
  }

  /**
   * Get count of active jobs
   */
  getActiveJobCount(): number {
    return this.pollingScraperService.getActiveJobCount();
  }
}
