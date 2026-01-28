/**
 * Message Patterns for Lyrebird
 *
 * These patterns define the routing keys for messages between services.
 * Using constants prevents typos and makes refactoring easier.
 */

export const MESSAGE_PATTERNS = {
  // Job lifecycle events
  JOB_START: 'job.start', // Gateway → Ingestion
  JOB_CANCEL: 'job.cancel', // Gateway → Ingestion (stop processing deleted job)
  JOB_RAW_DATA: 'job.raw_data', // Ingestion → Analysis
  JOB_INITIAL_BATCH_COMPLETE: 'job.initial_batch_complete', // Ingestion → Gateway (signals job started, real-time streaming active)
  JOB_INGESTION_COMPLETE: 'job.ingestion_complete', // Ingestion → Analysis (signals all data sent, streaming ended)
  JOB_DATA_UPDATE: 'job.data_update', // Analysis → Gateway (real-time data point updates)
  JOB_COMPLETE: 'job.complete', // Analysis → Gateway
  JOB_FAILED: 'job.failed', // Any → Gateway

  // Health checks
  HEALTH_CHECK: 'health.check',
} as const;

export type MessagePattern =
  (typeof MESSAGE_PATTERNS)[keyof typeof MESSAGE_PATTERNS];
