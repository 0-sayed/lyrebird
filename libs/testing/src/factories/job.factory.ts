import { JobStatus } from '@app/shared-types';
import { MockJob } from '../mocks/repositories.mock';
import { generateId } from '../utils/id.util';

/**
 * Factory for creating test job data
 *
 * Provides convenient methods to create job objects
 * with sensible defaults for testing.
 */
export class JobFactory {
  private static promptCounter = 0;

  /**
   * Create a mock job with default values
   */
  static create(overrides: Partial<MockJob> = {}): MockJob {
    const now = new Date();
    return {
      id: generateId(),
      prompt: `Test prompt ${++this.promptCounter}`,
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
      updatedAt: now,
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
   * Reset the prompt counter to ensure test isolation.
   *
   * **Important**: Call this in `beforeEach()` to prevent tests
   * from affecting each other due to the static counter state.
   *
   * @example
   * beforeEach(() => {
   *   JobFactory.resetCounter();
   * });
   */
  static resetCounter(): void {
    this.promptCounter = 0;
  }
}
