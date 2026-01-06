import { JobStatus } from '@app/shared-types';
import { MockJob } from '../mocks/repositories.mock';

/**
 * Generate a valid UUID for testing
 */
const generateId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback UUID generation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

/**
 * Factory for creating test job data
 *
 * Provides convenient methods to create job objects
 * with sensible defaults for testing.
 */
export class JobFactory {
  private static idCounter = 0;

  /**
   * Create a mock job with default values
   */
  static create(overrides: Partial<MockJob> = {}): MockJob {
    const now = new Date();
    return {
      id: generateId(),
      prompt: `Test prompt ${++this.idCounter}`,
      status: JobStatus.PENDING,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      ...overrides,
    };
  }

  /**
   * Create a completed job
   */
  static createCompleted(overrides: Partial<MockJob> = {}): MockJob {
    const now = new Date();
    return this.create({
      status: JobStatus.COMPLETED,
      completedAt: now,
      ...overrides,
    });
  }

  /**
   * Create a failed job
   */
  static createFailed(overrides: Partial<MockJob> = {}): MockJob {
    return this.create({
      status: JobStatus.FAILED,
      ...overrides,
    });
  }

  /**
   * Reset the ID counter (useful in beforeEach)
   */
  static resetCounter(): void {
    this.idCounter = 0;
  }
}
