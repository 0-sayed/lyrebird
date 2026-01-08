/**
 * Base class for application-specific errors
 * Provides a consistent error hierarchy for the lyrebird system
 */
export abstract class AppError extends Error {
  constructor(
    message: string,
    public readonly originalError?: Error,
  ) {
    super(message);
    this.name = this.constructor.name;

    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Transient errors indicate temporary failures that should be retried.
 *
 * Use this for:
 * - Network timeouts
 * - Service temporarily unavailable (HTTP 503)
 * - Rate limiting (HTTP 429)
 * - Connection errors
 * - Temporary resource exhaustion
 *
 * Message queue consumers should requeue messages that fail with TransientError.
 */
export class TransientError extends AppError {
  constructor(message: string, originalError?: Error) {
    super(message, originalError);
  }
}

/**
 * Permanent errors indicate failures that will not succeed on retry.
 *
 * Use this for:
 * - Validation errors
 * - Invalid data/input
 * - Resource not found (HTTP 404)
 * - Authorization failures (HTTP 401, 403)
 * - Duplicate entries
 * - Business logic violations
 *
 * Message queue consumers should NOT requeue messages that fail with PermanentError.
 */
export class PermanentError extends AppError {
  constructor(message: string, originalError?: Error) {
    super(message, originalError);
  }
}

/**
 * Type guard to check if an error is a TransientError
 */
export function isTransientError(error: unknown): error is TransientError {
  return error instanceof TransientError;
}

/**
 * Type guard to check if an error is a PermanentError
 */
export function isPermanentError(error: unknown): error is PermanentError {
  return error instanceof PermanentError;
}
