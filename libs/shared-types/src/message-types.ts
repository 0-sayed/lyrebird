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
 * Job options for Jetstream-based data ingestion
 *
 * The system uses real-time Jetstream streaming:
 * - Single WebSocket connection for all jobs
 * - Keyword-based filtering of incoming posts
 * - Sub-second latency
 */
export interface JobOptions {
  /** Total job duration (ms) - default: 120000 (2min) */
  maxDurationMs?: number;
}

export interface StartJobMessage {
  jobId: string;
  prompt: string;
  timestamp: Date;
  /** Optional job configuration */
  options?: {
    job?: JobOptions;
  };
}

/**
 * Message sent when a job is cancelled/deleted
 * Gateway → Ingestion
 */
export interface CancelJobMessage {
  jobId: string;
  timestamp: Date;
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

/**
 * Message sent when streaming begins and job transitions to IN_PROGRESS state.
 */
export interface InitialBatchCompleteMessage {
  jobId: string;
  /** Number of items fetched in the initial batch */
  initialBatchCount: number;
  /** Timestamp when initial batch completed */
  completedAt: Date;
  /** Whether real-time streaming is now active */
  streamingActive: boolean;
}

export interface IngestionCompleteMessage {
  jobId: string;
  /** Total number of items sent to analysis queue (initial + continuous) */
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

/**
 * Real-time data update message
 * Sent from Analysis → Gateway after each sentiment data point is processed
 */
export interface DataUpdateMessage {
  jobId: string;
  /** The newly processed sentiment data point */
  dataPoint: {
    id: string;
    textContent: string;
    source: string;
    sourceUrl?: string;
    authorName?: string;
    sentimentScore: number;
    sentimentLabel: SentimentLabel;
    publishedAt: Date;
  };
  /** Total number of items processed so far */
  totalProcessed: number;
  /** Timestamp when this data point was analyzed */
  analyzedAt: Date;
}
