import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Subscription } from 'rxjs';
import {
  JetstreamClientService,
  JetstreamConnectionStatus,
  JetstreamMetrics,
} from '@app/bluesky';
import { RawDataMessage } from '@app/shared-types';
import { JobRegistryService, RegisterJobConfig } from './job-registry.service';
import { KeywordFilterService } from './keyword-filter.service';
import { JETSTREAM_CONSTANTS } from './jetstream.constants';

/**
 * Configuration for registering a job with the JetstreamManager
 *
 * This is a subset of RegisterJobConfig that the manager exposes
 * to the IngestionService.
 */
export interface JetstreamJobConfig {
  /** Unique job identifier */
  jobId: string;
  /** Original user search prompt */
  prompt: string;
  /** Correlation ID for distributed tracing */
  correlationId: string;
  /** Maximum job duration in milliseconds */
  maxDurationMs: number;
  /** Callback for each matching data item */
  onData: (data: RawDataMessage) => Promise<void>;
  /** Callback when job completes */
  onComplete: (count: number) => void;
}

/**
 * Manager status for external monitoring
 */
export interface JetstreamManagerStatus {
  /** Whether currently listening to the stream */
  isListening: boolean;
  /** Current connection status */
  connectionStatus: JetstreamConnectionStatus;
  /** Number of active jobs */
  activeJobCount: number;
  /** Jetstream client metrics */
  metrics: JetstreamMetrics;
}

/**
 * JetstreamManagerService - Orchestrates Jetstream-based ingestion
 *
 * This service is the central coordinator for Jetstream integration.
 * It manages:
 *
 * 1. **Connection Lifecycle**: Connects to Jetstream when the first job
 *    is registered, disconnects when the last job completes
 *
 * 2. **Job Registration**: Wraps JobRegistryService to track active jobs
 *    and their keyword patterns
 *
 * 3. **Post Processing**: Subscribes to the Jetstream post stream and
 *    delegates filtering/dispatch to KeywordFilterService
 *
 * 4. **Metrics & Monitoring**: Logs processing statistics at intervals
 *
 * Usage:
 * ```typescript
 * // Register a job (auto-connects if first job)
 * await manager.registerJob({
 *   jobId: 'job-123',
 *   prompt: 'artificial intelligence',
 *   correlationId: 'req-abc',
 *   maxDurationMs: 120000,
 *   onData: (data) => rabbitmq.emit('raw-data', data),
 *   onComplete: (count) => console.log(`Done: ${count} posts`),
 * });
 *
 * // Complete a job (auto-disconnects if last job)
 * manager.completeJob('job-123');
 * ```
 *
 * The manager is designed to be a singleton that handles multiple
 * concurrent jobs efficiently with a single WebSocket connection.
 */
@Injectable()
export class JetstreamManagerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JetstreamManagerService.name);

  /** Whether we're actively listening to the stream */
  private isListening = false;

  /** Subscription to the post stream */
  private postSubscription: Subscription | null = null;

  /** Subscription to connection status changes */
  private statusSubscription: Subscription | null = null;

  /** Metrics logging interval handle */
  private metricsInterval: NodeJS.Timeout | null = null;

  /** Total posts processed across all sessions */
  private totalPostsProcessed = 0;

  /** Total posts matched to jobs */
  private totalPostsMatched = 0;

  constructor(
    private readonly jetstreamClient: JetstreamClientService,
    private readonly jobRegistry: JobRegistryService,
    private readonly keywordFilter: KeywordFilterService,
  ) {
    this.logger.log('JetstreamManager initialized');
  }

  /**
   * Module initialization - set up status monitoring
   */
  onModuleInit(): void {
    this.setupStatusMonitoring();
    this.logger.log('Jetstream status monitoring active');
  }

  /**
   * Module cleanup - disconnect and clear resources
   */
  onModuleDestroy(): void {
    this.stopListening();
    if (this.statusSubscription) {
      this.statusSubscription.unsubscribe();
      this.statusSubscription = null;
    }
    this.logger.log('JetstreamManager destroyed');
  }

  /**
   * Check if currently listening to the stream
   */
  isCurrentlyListening(): boolean {
    return this.isListening;
  }

  /**
   * Register a new job for Jetstream processing
   *
   * If this is the first active job, automatically connects to Jetstream.
   *
   * @param config - Job configuration
   */
  async registerJob(config: JetstreamJobConfig): Promise<void> {
    const { jobId, prompt, correlationId, maxDurationMs, onData, onComplete } =
      config;

    this.logger.log(
      `[${correlationId}] Registering job ${jobId} with Jetstream`,
    );

    // Wrap the onComplete callback to handle auto-disconnect
    const wrappedOnComplete = (count: number): void => {
      this.logger.log(
        `[${correlationId}] Job ${jobId} completed: ${count} posts matched`,
      );

      // Call original callback
      onComplete(count);

      // Check if we should disconnect (no more active jobs)
      if (!this.jobRegistry.hasActiveJobs()) {
        this.logger.log('No more active jobs, stopping Jetstream connection');
        this.stopListening();
      }
    };

    // Register with the job registry
    const registryConfig: RegisterJobConfig = {
      jobId,
      prompt,
      correlationId,
      maxDurationMs,
      onData,
      onComplete: wrappedOnComplete,
    };

    this.jobRegistry.registerJob(registryConfig);

    // Start listening if this is the first job
    if (!this.isListening) {
      await this.startListening();
    }

    this.logger.log(
      `[${correlationId}] Job ${jobId} registered, active jobs: ${this.jobRegistry.getActiveJobCount()}`,
    );
  }

  /**
   * Complete a job and trigger its completion callback
   *
   * If this is the last active job, automatically disconnects from Jetstream.
   *
   * @param jobId - ID of the job to complete
   */
  completeJob(jobId: string): void {
    const job = this.jobRegistry.getJob(jobId);
    if (!job) {
      this.logger.warn(`Cannot complete job ${jobId}: not found in registry`);
      return;
    }

    this.logger.log(
      `[${job.correlationId}] Completing job ${jobId} via manager`,
    );

    // This will trigger the wrapped onComplete callback
    this.jobRegistry.completeJob(jobId);
  }

  /**
   * Cancel a job without triggering completion callback
   *
   * @param jobId - ID of the job to cancel
   */
  cancelJob(jobId: string): void {
    const job = this.jobRegistry.getJob(jobId);
    if (!job) {
      this.logger.warn(`Cannot cancel job ${jobId}: not found in registry`);
      return;
    }

    this.logger.log(`[${job.correlationId}] Cancelling job ${jobId}`);

    // Unregister without triggering onComplete
    this.jobRegistry.unregisterJob(jobId);

    // Check if we should disconnect
    if (!this.jobRegistry.hasActiveJobs() && this.isListening) {
      this.logger.log('No more active jobs after cancellation, stopping');
      this.stopListening();
    }
  }

  /**
   * Get current manager status for monitoring
   */
  getStatus(): JetstreamManagerStatus {
    return {
      isListening: this.isListening,
      connectionStatus: this.jetstreamClient.getConnectionStatus(),
      activeJobCount: this.jobRegistry.getActiveJobCount(),
      metrics: this.jetstreamClient.getMetrics(),
    };
  }

  /**
   * Check if a specific job is registered
   */
  isJobRegistered(jobId: string): boolean {
    return this.jobRegistry.hasJob(jobId);
  }

  /**
   * Get processing statistics
   */
  getStats(): {
    totalPostsProcessed: number;
    totalPostsMatched: number;
    activeJobs: number;
    matchStats: ReturnType<KeywordFilterService['getMatchStats']>;
  } {
    return {
      totalPostsProcessed: this.totalPostsProcessed,
      totalPostsMatched: this.totalPostsMatched,
      activeJobs: this.jobRegistry.getActiveJobCount(),
      matchStats: this.keywordFilter.getMatchStats(),
    };
  }

  /**
   * Start listening to the Jetstream post stream
   */
  private async startListening(): Promise<void> {
    if (this.isListening) {
      this.logger.warn('Already listening to Jetstream');
      return;
    }

    this.logger.log('Starting Jetstream listener');
    this.isListening = true;

    // Subscribe to post events
    this.postSubscription = this.jetstreamClient.posts$.subscribe({
      next: (post): void => {
        this.totalPostsProcessed++;

        this.keywordFilter
          .processPost(post)
          .then((matchCount) => {
            if (matchCount > 0) {
              this.totalPostsMatched += matchCount;
            }
          })
          .catch((error: unknown) => {
            this.logger.error(
              `Error processing post: ` +
                (error instanceof Error ? error.message : String(error)),
            );
          });
      },
      error: (error) => {
        this.logger.error(
          `Post stream error: ` +
            (error instanceof Error ? error.message : String(error)),
        );
      },
    });
    // Start metrics logging
    this.startMetricsLogging();

    // Connect to Jetstream
    try {
      await this.jetstreamClient.connect();
      this.logger.log('Connected to Jetstream, listening for posts');
    } catch (error) {
      this.logger.error(
        `Failed to connect to Jetstream: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Clean up on connection failure
      this.stopListening();
      throw error;
    }
  }

  /**
   * Stop listening to the Jetstream post stream
   */
  stopListening(): void {
    if (!this.isListening) {
      return;
    }

    this.logger.log('Stopping Jetstream listener');
    this.isListening = false;

    // Stop metrics logging
    this.stopMetricsLogging();

    // Unsubscribe from post stream
    if (this.postSubscription) {
      this.postSubscription.unsubscribe();
      this.postSubscription = null;
    }

    // Disconnect from Jetstream
    this.jetstreamClient.disconnect();

    this.logger.log(
      `Jetstream listener stopped. Total processed: ${this.totalPostsProcessed}, matched: ${this.totalPostsMatched}`,
    );
  }

  /**
   * Set up monitoring for connection status changes
   */
  private setupStatusMonitoring(): void {
    this.statusSubscription = this.jetstreamClient.status$.subscribe({
      next: (status) => {
        this.logger.log(`Jetstream connection status: ${status}`);

        // Log additional context for specific states
        if (status === 'error') {
          this.logger.warn(
            `Jetstream connection error. Active jobs: ${this.jobRegistry.getActiveJobCount()}`,
          );
        } else if (status === 'reconnecting') {
          const metrics = this.jetstreamClient.getMetrics();
          this.logger.log(
            `Reconnecting to Jetstream (attempt ${metrics.reconnectAttempts})`,
          );
        }
      },
    });
  }

  /**
   * Start periodic metrics logging
   */
  private startMetricsLogging(): void {
    if (this.metricsInterval) {
      return;
    }

    this.metricsInterval = setInterval(() => {
      this.logMetrics();
    }, JETSTREAM_CONSTANTS.METRICS_LOG_INTERVAL_MS);
  }

  /**
   * Stop periodic metrics logging
   */
  private stopMetricsLogging(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
  }

  /**
   * Log current processing metrics
   */
  private logMetrics(): void {
    const clientMetrics = this.jetstreamClient.getMetrics();
    const matchStats = this.keywordFilter.getMatchStats();

    this.logger.log(
      `[Metrics] Status: ${clientMetrics.connectionStatus}, ` +
        `Rate: ${clientMetrics.messagesPerSecond} msg/s, ` +
        `Processed: ${this.totalPostsProcessed}, ` +
        `Matched: ${this.totalPostsMatched}, ` +
        `Jobs: ${matchStats.totalJobs}`,
    );

    // Log per-job stats if there are active jobs
    if (matchStats.jobStats.length > 0) {
      const jobSummary = matchStats.jobStats
        .map((j) => `${j.jobId}:${j.matchedCount}`)
        .join(', ');
      this.logger.debug(`[Job Matches] ${jobSummary}`);
    }
  }

  /**
   * Force reconnection to Jetstream
   *
   * Useful for recovery scenarios or when connection becomes stale.
   */
  async reconnect(): Promise<void> {
    this.logger.log('Forcing Jetstream reconnection');

    // Disconnect first
    this.jetstreamClient.disconnect();

    // Wait a moment before reconnecting
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Reconnect if we have active jobs
    if (this.jobRegistry.hasActiveJobs()) {
      await this.jetstreamClient.connect();
      this.logger.log('Reconnected to Jetstream');
    } else {
      this.logger.log('No active jobs, skipping reconnection');
    }
  }

  /**
   * Reset processing statistics
   */
  resetStats(): void {
    this.totalPostsProcessed = 0;
    this.totalPostsMatched = 0;
    this.jetstreamClient.resetMetrics();
    this.logger.log('Statistics reset');
  }
}
