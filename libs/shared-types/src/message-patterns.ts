/**
 * Message Patterns for Lyrebird
 *
 * These patterns define the routing keys for messages between services.
 * Using constants prevents typos and makes refactoring easier.
 */

export const MESSAGE_PATTERNS = {
  // Job lifecycle events
  JOB_START: 'job.start', // Gateway → Ingestion
  JOB_RAW_DATA: 'job.raw_data', // Ingestion → Analysis
  JOB_COMPLETE: 'job.complete', // Analysis → Gateway
  JOB_FAILED: 'job.failed', // Any → Gateway

  // Health checks
  HEALTH_CHECK: 'health.check',
} as const;

export type MessagePattern =
  (typeof MESSAGE_PATTERNS)[keyof typeof MESSAGE_PATTERNS];
