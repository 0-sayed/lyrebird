import { JobStatus } from '@app/shared-types';

/**
 * Mock job type for testing
 */
export interface MockJob {
  id: string;
  prompt: string;
  status: JobStatus;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

/**
 * In-memory job store for testing
 * Provides realistic CRUD operations without a database
 */
export class MockJobStore {
  private jobs: Map<string, MockJob> = new Map();

  clear(): void {
    this.jobs.clear();
  }

  set(id: string, job: MockJob): void {
    this.jobs.set(id, job);
  }

  get(id: string): MockJob | undefined {
    return this.jobs.get(id);
  }

  getAll(): MockJob[] {
    return Array.from(this.jobs.values());
  }

  delete(id: string): boolean {
    return this.jobs.delete(id);
  }
}

/**
 * Generate a valid UUID for testing
 */
const generateId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older Node.js versions
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

/**
 * Creates a mock JobsRepository with an optional shared job store
 */
export const createMockJobsRepository = (
  store: MockJobStore = new MockJobStore(),
) => ({
  create: jest.fn((data: { prompt: string; status: JobStatus }): MockJob => {
    const id = generateId();
    const job: MockJob = {
      id,
      prompt: data.prompt,
      status: data.status,
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: null,
    };
    store.set(id, job);
    return job;
  }),

  findById: jest.fn((jobId: string): MockJob | undefined => store.get(jobId)),

  findAll: jest.fn((): MockJob[] => store.getAll()),

  updateStatus: jest.fn((jobId: string, status: JobStatus): MockJob => {
    const job = store.get(jobId);
    if (job) {
      job.status = status;
      job.updatedAt = new Date();
      if (status === JobStatus.COMPLETED) {
        job.completedAt = new Date();
      }
    }
    return job as MockJob;
  }),

  // Expose store for test assertions
  _store: store,
});

/**
 * Creates a mock SentimentDataRepository
 */
export const createMockSentimentDataRepository = () => ({
  create: jest.fn().mockResolvedValue({}),
  createMany: jest.fn().mockResolvedValue([]),
  findByJobId: jest.fn().mockResolvedValue([]),
  countByJobId: jest.fn().mockResolvedValue(0),
  getAverageSentimentByJobId: jest.fn().mockResolvedValue(null),
  getSentimentDistributionByJobId: jest.fn().mockResolvedValue([]),
});

export type MockJobsRepository = ReturnType<typeof createMockJobsRepository>;
export type MockSentimentDataRepository = ReturnType<
  typeof createMockSentimentDataRepository
>;
