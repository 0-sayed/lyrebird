/**
 * HTTP header constants used across the application
 */

/**
 * HTTP header name for correlation ID tracking.
 * Used by both Pino logger and CorrelationIdInterceptor to ensure
 * consistent header naming across request/response handling.
 */
export const CORRELATION_ID_HEADER = 'x-correlation-id';
