/**
 * API Types - Mirrored from backend for type safety
 *
 * These types are copied from the backend to maintain consistency.
 * TODO: In the future, consider creating a shared package with Zod schemas
 * that can be used by both frontend and backend (Option B in the spec).
 *
 * @see libs/shared-types/src/message-types.ts
 * @see apps/gateway/src/dtos/job-response.dto.ts
 * @see apps/gateway/src/events/job.events.ts
 */

/**
 * Job Status enum - matches database schema
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
 * Job response from API
 * @see apps/gateway/src/dtos/job-response.dto.ts
 */
export interface JobResponse {
  jobId: string;
  status: JobStatus;
  prompt: string;
  createdAt: string;
  averageSentiment?: number;
  dataPointsCount?: number;
  completedAt?: string;
  /** Error message when job status is FAILED */
  errorMessage?: string;
}

/**
 * Individual sentiment data item
 */
export interface SentimentDataItem {
  id: string;
  textContent: string;
  source: string;
  sourceUrl?: string;
  authorName?: string;
  sentimentScore: number;
  sentimentLabel: SentimentLabel;
  publishedAt: string;
  analyzedAt?: string;
}

/**
 * Sentiment distribution for charts
 */
export interface SentimentDistribution {
  positive: number;
  neutral: number;
  negative: number;
}

/**
 * Full job results response
 */
export interface JobResultsResponse {
  job: JobResponse;
  sentimentDistribution: SentimentDistribution;
  data: SentimentDataItem[];
  totalItems: number;
  averageSentiment: number | null;
}

/**
 * Paginated jobs list response
 */
export interface JobsListResponse {
  jobs: JobResponse[];
  total: number;
  page: number;
  limit: number;
}

// =============================================================================
// SSE Event Types
// =============================================================================

/**
 * SSE message type constants
 * @see apps/gateway/src/events/job.events.ts
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

/**
 * SSE event: Job subscribed
 */
export interface SSESubscribedEvent {
  type: typeof SSE_MESSAGE_TYPES.SUBSCRIBED;
  data: {
    jobId: string;
    status: JobStatus;
  };
}

/**
 * SSE event: Job status changed
 */
export interface SSEStatusEvent {
  type: typeof SSE_MESSAGE_TYPES.STATUS;
  data: {
    jobId: string;
    status: JobStatus;
    /** Number of posts in initial batch (when transitioning to IN_PROGRESS) */
    initialBatchCount?: number;
    /** Whether real-time streaming is now active */
    streamingActive?: boolean;
  };
}

/**
 * SSE event: Job completed
 */
export interface SSECompletedEvent {
  type: typeof SSE_MESSAGE_TYPES.COMPLETED;
  data: {
    jobId: string;
    status: JobStatus.COMPLETED;
    averageSentiment: number;
    dataPointsCount: number;
  };
}

/**
 * SSE event: Job failed
 */
export interface SSEFailedEvent {
  type: typeof SSE_MESSAGE_TYPES.FAILED;
  data: {
    jobId: string;
    status: JobStatus.FAILED;
    errorMessage: string;
  };
}

/**
 * SSE event: Heartbeat
 */
export interface SSEHeartbeatEvent {
  type: typeof SSE_MESSAGE_TYPES.HEARTBEAT;
  data: {
    timestamp: string;
  };
}

/**
 * SSE event: Error
 */
export interface SSEErrorEvent {
  type: typeof SSE_MESSAGE_TYPES.ERROR;
  data: {
    message: string;
    code?: string;
  };
}

/**
 * SSE event: Data update (real-time sentiment data)
 */
export interface SSEDataUpdateEvent {
  type: typeof SSE_MESSAGE_TYPES.DATA_UPDATE;
  data: {
    jobId: string;
    dataPoint: SentimentDataItem;
    totalProcessed: number;
    timestamp: string;
  };
}

/**
 * Union type of all SSE events
 */
export type SSEEvent =
  | SSESubscribedEvent
  | SSEStatusEvent
  | SSECompletedEvent
  | SSEFailedEvent
  | SSEHeartbeatEvent
  | SSEErrorEvent
  | SSEDataUpdateEvent;
