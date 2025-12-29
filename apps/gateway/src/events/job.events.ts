/**
 * Internal events for job lifecycle notifications
 *
 * These events are emitted by the RabbitMQ consumer and
 * consumed by the SSE controller to notify clients.
 */

import { JobStatus } from '@app/shared-types';

/**
 * Base interface for all job events
 */
export interface JobEventPayload {
  jobId: string;
  timestamp: Date;
  correlationId?: string;
}

/**
 * Emitted when a job status changes
 */
export interface JobStatusChangedEvent extends JobEventPayload {
  status: JobStatus;
  previousStatus?: JobStatus;
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
 * Emitted during job progress updates
 */
export interface JobProgressEvent extends JobEventPayload {
  status: JobStatus.IN_PROGRESS;
  processedCount: number;
  totalCount?: number;
}

/**
 * Event pattern constants
 */
export const JOB_EVENTS = {
  STATUS_CHANGED: 'job.status.changed',
  COMPLETED: 'job.completed',
  FAILED: 'job.failed',
  PROGRESS: 'job.progress',
} as const;
