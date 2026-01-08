/**
 * Message Payload Types
 *
 * Type-safe definitions for message payloads
 */

/**
 * Job Status enum - shared across all services
 * Matches the database schema enum
 */
export enum JobStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * Sentiment Label enum
 */
export enum SentimentLabel {
  NEGATIVE = 'negative',
  NEUTRAL = 'neutral',
  POSITIVE = 'positive',
}

/**
 * Polling options for near-real-time data ingestion
 */
export interface PollingOptions {
  /** How often to poll for new posts (ms) - default: 5000 (5s) */
  pollIntervalMs?: number;
  /** Total job duration (ms) - default: 600000 (10min) */
  maxDurationMs?: number;
}

export interface StartJobMessage {
  jobId: string;
  prompt: string;
  timestamp: Date;
  /** Optional polling configuration for near-real-time updates */
  options?: {
    polling?: PollingOptions;
    /** Maximum posts to fetch in one-shot mode */
    maxPosts?: number;
  };
}

export interface RawDataMessage {
  jobId: string;
  textContent: string;
  source: string;
  sourceUrl?: string;
  authorName?: string;
  upvotes?: number;
  commentCount?: number;
  publishedAt: Date;
  collectedAt: Date;
}

export interface IngestionCompleteMessage {
  jobId: string;
  /** Total number of items sent to analysis queue */
  totalItems: number;
  /** Timestamp when ingestion completed */
  completedAt: Date;
}

export interface JobCompleteMessage {
  jobId: string;
  status: JobStatus.COMPLETED;
  averageSentiment: number;
  dataPointsCount: number;
  completedAt: Date;
}

export interface JobFailedMessage {
  jobId: string;
  status: JobStatus.FAILED;
  errorMessage: string;
  failedAt: Date;
}

export interface HealthCheckMessage {
  service: string;
  timestamp: Date;
}

export interface HealthCheckResponse {
  service: string;
  status: 'healthy' | 'unhealthy';
  uptime: number;
  timestamp: Date;
}
