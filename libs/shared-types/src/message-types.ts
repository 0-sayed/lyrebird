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

export interface StartJobMessage {
  jobId: string;
  prompt: string;
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
  collectedAt: Date;
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
