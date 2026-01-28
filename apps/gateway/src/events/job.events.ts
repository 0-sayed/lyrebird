/**
 * Internal events for job lifecycle notifications
 *
 * These events are emitted by the RabbitMQ consumer and
 * consumed by the SSE controller to notify clients.
 */

import { JobStatus, SentimentLabel } from '@app/shared-types';

/**
 * Base interface for all job events
 */
export interface JobEventPayload {
  jobId: string;
  timestamp: Date;
  correlationId?: string;
}

/**
 * Emitted when a job is completed successfully
 */
export interface JobCompletedEvent extends JobEventPayload {
  status: JobStatus.COMPLETED;
  averageSentiment: number;
  dataPointsCount: number;
}

/**
 * Emitted when a job fails
 */
export interface JobFailedEvent extends JobEventPayload {
  status: JobStatus.FAILED;
  errorMessage: string;
}

/**
 * Emitted when a new data point is processed (for real-time chart updates)
 */
export interface JobDataUpdateEvent extends JobEventPayload {
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
  totalProcessed: number;
}

/**
 * Emitted when job status changes (e.g., PENDING -> IN_PROGRESS)
 */
export interface JobStatusChangedEvent extends JobEventPayload {
  status: JobStatus;
  /** Number of posts in initial batch (for IN_PROGRESS transition) */
  initialBatchCount?: number;
  /** Whether real-time streaming is active */
  streamingActive?: boolean;
}

/**
 * Event pattern constants for internal event emitter
 */
export const JOB_EVENTS = {
  STATUS_CHANGED: 'job.status.changed',
  COMPLETED: 'job.completed',
  FAILED: 'job.failed',
  PROGRESS: 'job.progress',
  DATA_UPDATE: 'job.data_update',
} as const;

/**
 * SSE message type constants for client communication
 */
export const SSE_MESSAGE_TYPES = {
  ERROR: 'job.error',
  STATUS: 'job.status',
  SUBSCRIBED: 'job.subscribed',
  COMPLETED: 'job.completed',
  FAILED: 'job.failed',
  HEARTBEAT: 'heartbeat',
  DATA_UPDATE: 'job.data_update',
} as const;
