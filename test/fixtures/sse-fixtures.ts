/**
 * SSE (Server-Sent Events) Test Fixtures
 *
 * Factory functions for creating SSE event payloads
 * for unit and integration testing of real-time streaming.
 *
 * @example
 * // Create a job status event
 * const event = createMockSseStatusEvent({
 *   jobId: 'job-123',
 *   status: JobStatus.IN_PROGRESS,
 * });
 *
 * @example
 * // Create a data update event
 * const update = createMockSseDataUpdateEvent({
 *   jobId: 'job-123',
 *   dataPoint: {
 *     textContent: 'Great product!',
 *     sentimentScore: 0.8,
 *   },
 * });
 */

import { JobStatus, SentimentLabel } from '@app/shared-types';
import {
  JOB_EVENTS,
  SSE_MESSAGE_TYPES,
  type JobCompletedEvent,
  type JobFailedEvent,
  type JobDataUpdateEvent,
  type JobStatusChangedEvent,
} from '../../apps/gateway/src/events/job.events';

/**
 * Counter for generating unique values across factory calls
 */
let sseCounter = 0;

/**
 * Generate a unique ID for testing (UUID format)
 */
function generateTestId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Formatted SSE message as sent over the wire
 */
export interface SseMessage {
  /** Event type (e.g., 'job.status', 'job.completed') */
  event: string;
  /** JSON-serialized data payload */
  data: string;
}

/**
 * Creates a formatted SSE message object.
 *
 * @example
 * const msg = createSseMessage('job.status', { jobId: '123', status: 'pending' });
 * // { event: 'job.status', data: '{"jobId":"123","status":"pending"}' }
 */
export function createSseMessage(event: string, data: unknown): SseMessage {
  return {
    event,
    data: JSON.stringify(data),
  };
}

/**
 * Parses an SSE message string into structured data.
 *
 * @example
 * const parsed = parseSseMessage('event: job.status\ndata: {"jobId":"123"}\n\n');
 * // { event: 'job.status', data: { jobId: '123' } }
 */
export function parseSseMessage(
  raw: string,
): { event: string; data: unknown } | null {
  const eventMatch = raw.match(/event:\s*(.+)/);
  const dataMatch = raw.match(/data:\s*(.+)/);

  if (!eventMatch || !dataMatch) {
    return null;
  }

  try {
    return {
      event: eventMatch[1].trim(),
      data: JSON.parse(dataMatch[1].trim()) as unknown,
    };
  } catch {
    return null;
  }
}

/**
 * Creates a mock JobStatusChangedEvent for SSE testing.
 *
 * @example
 * // Basic usage
 * const event = createMockSseStatusEvent();
 *
 * @example
 * // With specific status
 * const event = createMockSseStatusEvent({
 *   jobId: 'job-123',
 *   status: JobStatus.IN_PROGRESS,
 *   initialBatchCount: 50,
 * });
 */
export function createMockSseStatusEvent(
  overrides: Partial<JobStatusChangedEvent> = {},
): JobStatusChangedEvent {
  return {
    jobId: overrides.jobId ?? generateTestId(),
    timestamp: overrides.timestamp ?? new Date(),
    correlationId: overrides.correlationId,
    status: overrides.status ?? JobStatus.PENDING,
    initialBatchCount: overrides.initialBatchCount,
    streamingActive: overrides.streamingActive,
  };
}

/**
 * Creates a mock JobCompletedEvent for SSE testing.
 *
 * @example
 * const event = createMockSseCompletedEvent({
 *   jobId: 'job-123',
 *   averageSentiment: 0.75,
 *   dataPointsCount: 100,
 * });
 */
export function createMockSseCompletedEvent(
  overrides: Partial<Omit<JobCompletedEvent, 'status'>> = {},
): JobCompletedEvent {
  return {
    jobId: overrides.jobId ?? generateTestId(),
    timestamp: overrides.timestamp ?? new Date(),
    correlationId: overrides.correlationId,
    status: JobStatus.COMPLETED,
    averageSentiment: overrides.averageSentiment ?? 0.5,
    dataPointsCount: overrides.dataPointsCount ?? 25,
  };
}

/**
 * Creates a mock JobFailedEvent for SSE testing.
 *
 * @example
 * const event = createMockSseFailedEvent({
 *   jobId: 'job-123',
 *   errorMessage: 'Connection timeout',
 * });
 */
export function createMockSseFailedEvent(
  overrides: Partial<Omit<JobFailedEvent, 'status'>> = {},
): JobFailedEvent {
  return {
    jobId: overrides.jobId ?? generateTestId(),
    timestamp: overrides.timestamp ?? new Date(),
    correlationId: overrides.correlationId,
    status: JobStatus.FAILED,
    errorMessage: overrides.errorMessage ?? 'Test error message',
  };
}

/**
 * Creates a mock JobDataUpdateEvent for SSE testing.
 *
 * @example
 * // Basic usage
 * const event = createMockSseDataUpdateEvent();
 *
 * @example
 * // With specific data
 * const event = createMockSseDataUpdateEvent({
 *   jobId: 'job-123',
 *   dataPoint: {
 *     textContent: 'I love this product!',
 *     sentimentScore: 0.85,
 *     sentimentLabel: SentimentLabel.POSITIVE,
 *   },
 *   totalProcessed: 42,
 * });
 */
export function createMockSseDataUpdateEvent(
  overrides: Partial<JobDataUpdateEvent> = {},
): JobDataUpdateEvent {
  const id = ++sseCounter;
  const defaultDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const defaultDataPoint = {
    id: generateTestId(),
    textContent: `Test post content ${id}`,
    source: 'bluesky',
    sentimentScore: 0.5,
    sentimentLabel: SentimentLabel.NEUTRAL,
    publishedAt: defaultDate,
  };

  return {
    jobId: overrides.jobId ?? generateTestId(),
    timestamp: overrides.timestamp ?? new Date(),
    correlationId: overrides.correlationId,
    dataPoint: overrides.dataPoint
      ? { ...defaultDataPoint, ...overrides.dataPoint }
      : defaultDataPoint,
    totalProcessed: overrides.totalProcessed ?? id,
  };
}

/**
 * Creates a mock heartbeat SSE event.
 *
 * @example
 * const heartbeat = createMockSseHeartbeat();
 */
export function createMockSseHeartbeat(): SseMessage {
  return createSseMessage(SSE_MESSAGE_TYPES.HEARTBEAT, {
    timestamp: new Date().toISOString(),
  });
}

/**
 * Creates a mock subscription confirmation event.
 *
 * @example
 * const subscribed = createMockSseSubscribedEvent('job-123');
 */
export function createMockSseSubscribedEvent(jobId: string): SseMessage {
  return createSseMessage(SSE_MESSAGE_TYPES.SUBSCRIBED, {
    jobId,
    timestamp: new Date().toISOString(),
    message: `Subscribed to updates for job ${jobId}`,
  });
}

/**
 * Creates a mock error SSE event.
 *
 * @example
 * const error = createMockSseErrorEvent('job-123', 'Job not found');
 */
export function createMockSseErrorEvent(
  jobId: string,
  message: string,
): SseMessage {
  return createSseMessage(SSE_MESSAGE_TYPES.ERROR, {
    jobId,
    message,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Creates a batch of data update events for load testing.
 *
 * @example
 * const updates = createMockSseDataUpdateEventBatch(100, { jobId: 'job-123' });
 */
export function createMockSseDataUpdateEventBatch(
  count: number,
  overrides: Partial<JobDataUpdateEvent> = {},
): JobDataUpdateEvent[] {
  return Array.from({ length: count }, (_, i) =>
    createMockSseDataUpdateEvent({
      ...overrides,
      totalProcessed: i + 1,
    }),
  );
}

/**
 * Resets the SSE counter.
 * Call this in beforeEach() to ensure test isolation.
 *
 * @example
 * beforeEach(() => {
 *   resetSseCounter();
 * });
 */
export function resetSseCounter(): void {
  sseCounter = 0;
}

/**
 * Re-export event pattern constants for convenience
 */
export { JOB_EVENTS, SSE_MESSAGE_TYPES };
