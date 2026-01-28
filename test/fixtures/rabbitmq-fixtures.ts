/**
 * RabbitMQ Test Fixtures
 *
 * Factory functions for creating RabbitMQ message payloads
 * for unit and integration testing.
 *
 * @example
 * // Create a job start message
 * const message = createMockStartJobMessage({ prompt: 'test' });
 *
 * @example
 * // Create a complete message flow
 * const start = createMockStartJobMessage();
 * const rawData = createMockRawDataMessage({ jobId: start.jobId });
 * const complete = createMockJobCompleteMessage({ jobId: start.jobId });
 */

import {
  StartJobMessage,
  CancelJobMessage,
  RawDataMessage,
  IngestionCompleteMessage,
  JobCompleteMessage,
  JobFailedMessage,
  JobStatus,
  DataUpdateMessage,
  SentimentLabel,
  InitialBatchCompleteMessage,
} from '@app/shared-types';

/**
 * Counter for generating unique values across factory calls
 */
let messageCounter = 0;

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
 * Creates a mock StartJobMessage for testing job initiation.
 *
 * @example
 * // Basic usage
 * const message = createMockStartJobMessage();
 *
 * @example
 * // With custom options
 * const message = createMockStartJobMessage({
 *   prompt: 'bitcoin sentiment',
 *   options: { job: { maxDurationMs: 60000 } },
 * });
 */
export function createMockStartJobMessage(
  overrides: Partial<StartJobMessage> = {},
): StartJobMessage {
  const id = ++messageCounter;
  return {
    jobId: overrides.jobId ?? generateTestId(),
    prompt: overrides.prompt ?? `Test prompt ${id}`,
    timestamp: overrides.timestamp ?? new Date(),
    options: overrides.options,
  };
}

/**
 * Creates a mock CancelJobMessage for testing job cancellation.
 *
 * @example
 * const message = createMockCancelJobMessage({ jobId: 'job-123' });
 */
export function createMockCancelJobMessage(
  overrides: Partial<CancelJobMessage> = {},
): CancelJobMessage {
  return {
    jobId: overrides.jobId ?? generateTestId(),
    timestamp: overrides.timestamp ?? new Date(),
  };
}

/**
 * Creates a mock RawDataMessage for testing sentiment analysis input.
 *
 * Uses relative dates (1 day ago) to ensure test data remains valid.
 *
 * @example
 * // Basic usage
 * const message = createMockRawDataMessage();
 *
 * @example
 * // With specific sentiment text
 * const positiveMessage = createMockRawDataMessage({
 *   textContent: 'I absolutely love this!',
 * });
 */
export function createMockRawDataMessage(
  overrides: Partial<RawDataMessage> = {},
): RawDataMessage {
  const id = ++messageCounter;
  const defaultDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

  return {
    jobId: overrides.jobId ?? generateTestId(),
    textContent: overrides.textContent ?? `Test content for analysis ${id}`,
    source: overrides.source ?? 'bluesky',
    sourceUrl: overrides.sourceUrl,
    authorName: overrides.authorName,
    upvotes: overrides.upvotes,
    commentCount: overrides.commentCount,
    publishedAt: overrides.publishedAt ?? defaultDate,
    collectedAt: overrides.collectedAt ?? defaultDate,
  };
}

/**
 * Creates a mock InitialBatchCompleteMessage for testing streaming start.
 *
 * @example
 * const message = createMockInitialBatchCompleteMessage({
 *   jobId: 'job-123',
 *   initialBatchCount: 50,
 * });
 */
export function createMockInitialBatchCompleteMessage(
  overrides: Partial<InitialBatchCompleteMessage> = {},
): InitialBatchCompleteMessage {
  return {
    jobId: overrides.jobId ?? generateTestId(),
    initialBatchCount: overrides.initialBatchCount ?? 10,
    completedAt: overrides.completedAt ?? new Date(),
    streamingActive: overrides.streamingActive ?? true,
  };
}

/**
 * Creates a mock IngestionCompleteMessage for testing ingestion completion.
 *
 * @example
 * const message = createMockIngestionCompleteMessage({
 *   jobId: 'job-123',
 *   totalItems: 100,
 * });
 */
export function createMockIngestionCompleteMessage(
  overrides: Partial<IngestionCompleteMessage> = {},
): IngestionCompleteMessage {
  return {
    jobId: overrides.jobId ?? generateTestId(),
    totalItems: overrides.totalItems ?? 50,
    completedAt: overrides.completedAt ?? new Date(),
  };
}

/**
 * Creates a mock JobCompleteMessage for testing successful job completion.
 *
 * @example
 * const message = createMockJobCompleteMessage({
 *   jobId: 'job-123',
 *   averageSentiment: 0.75,
 *   dataPointsCount: 100,
 * });
 */
export function createMockJobCompleteMessage(
  overrides: Partial<Omit<JobCompleteMessage, 'status'>> = {},
): JobCompleteMessage {
  return {
    jobId: overrides.jobId ?? generateTestId(),
    status: JobStatus.COMPLETED,
    averageSentiment: overrides.averageSentiment ?? 0.5,
    dataPointsCount: overrides.dataPointsCount ?? 25,
    completedAt: overrides.completedAt ?? new Date(),
  };
}

/**
 * Creates a mock JobFailedMessage for testing job failure scenarios.
 *
 * @example
 * const message = createMockJobFailedMessage({
 *   jobId: 'job-123',
 *   errorMessage: 'Connection timeout',
 * });
 */
export function createMockJobFailedMessage(
  overrides: Partial<Omit<JobFailedMessage, 'status'>> = {},
): JobFailedMessage {
  return {
    jobId: overrides.jobId ?? generateTestId(),
    status: JobStatus.FAILED,
    errorMessage: overrides.errorMessage ?? 'Test error message',
    failedAt: overrides.failedAt ?? new Date(),
  };
}

/**
 * Creates a mock DataUpdateMessage for testing real-time updates.
 *
 * @example
 * const message = createMockDataUpdateMessage({
 *   jobId: 'job-123',
 *   dataPoint: {
 *     textContent: 'Great product!',
 *     sentimentScore: 0.8,
 *     sentimentLabel: SentimentLabel.POSITIVE,
 *   },
 * });
 */
export function createMockDataUpdateMessage(
  overrides: Partial<DataUpdateMessage> = {},
): DataUpdateMessage {
  const id = ++messageCounter;
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
    dataPoint: overrides.dataPoint
      ? { ...defaultDataPoint, ...overrides.dataPoint }
      : defaultDataPoint,
    totalProcessed: overrides.totalProcessed ?? id,
    analyzedAt: overrides.analyzedAt ?? new Date(),
  };
}

/**
 * Creates a batch of RawDataMessages for load testing.
 *
 * @example
 * const messages = createMockRawDataMessageBatch(100, { jobId: 'job-123' });
 */
export function createMockRawDataMessageBatch(
  count: number,
  overrides: Partial<RawDataMessage> = {},
): RawDataMessage[] {
  return Array.from({ length: count }, () =>
    createMockRawDataMessage(overrides),
  );
}

/**
 * Resets the message counter.
 * Call this in beforeEach() to ensure test isolation.
 *
 * @example
 * beforeEach(() => {
 *   resetMessageCounter();
 * });
 */
export function resetMessageCounter(): void {
  messageCounter = 0;
}
