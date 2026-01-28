import { JobStatus } from '@app/shared-types';
import { generateId } from '../utils/id.util';

/**
 * Job response type matching JobResponseDto from gateway
 */
export interface MockJobResponse {
  jobId: string;
  prompt: string;
  status: JobStatus;
  dataPointsCount: number;
  averageSentiment?: number;
  createdAt: Date;
  completedAt?: Date;
}

/**
 * Factory to create mock job responses with sensible defaults.
 *
 * @example
 * const job = createMockJobResponse();
 * const completedJob = createMockJobResponse({ status: JobStatus.COMPLETED });
 */
export function createMockJobResponse(
  overrides: Partial<MockJobResponse> = {},
): MockJobResponse {
  return {
    jobId: generateId(),
    prompt: 'Test prompt',
    status: JobStatus.PENDING,
    dataPointsCount: 0,
    averageSentiment: undefined,
    createdAt: new Date(),
    ...overrides,
  };
}

/**
 * Creates a mock GatewayService for controller testing.
 *
 * The mock provides Jest mock functions for all service methods,
 * pre-configured with sensible default return values.
 *
 * @example
 * // Basic usage
 * const mockService = createMockGatewayService();
 *
 * // Customize specific responses
 * const mockService = createMockGatewayService({
 *   mockJobResponse: { status: JobStatus.COMPLETED },
 *   listJobsResponse: [job1, job2],
 * });
 *
 * // Override individual methods
 * mockService.createJob.mockResolvedValue(customJob);
 */
export function createMockGatewayService(options?: {
  mockJobResponse?: Partial<MockJobResponse>;
  listJobsResponse?: MockJobResponse[];
  deleteJobResponse?: { success: boolean };
}) {
  const defaultJob = createMockJobResponse(options?.mockJobResponse);

  return {
    createJob: jest.fn().mockResolvedValue(defaultJob),
    getJob: jest.fn().mockResolvedValue(defaultJob),
    listJobs: jest
      .fn()
      .mockResolvedValue(options?.listJobsResponse ?? [defaultJob]),
    deleteJob: jest
      .fn()
      .mockResolvedValue(options?.deleteJobResponse ?? { success: true }),
  };
}

export type MockGatewayService = ReturnType<typeof createMockGatewayService>;
