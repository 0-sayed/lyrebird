import { JobStatus } from '@app/shared-types';

let jobCounter = 0;

/**
 * Input type matching JobsRepository.create() signature.
 */
export interface CreateJobInput {
  prompt: string;
  status?: JobStatus;
  userId: string;
}

/**
 * Factory for creating test job data.
 * Matches the actual JobsRepository.create() parameter type.
 */
export function createTestJob(
  overrides: Partial<CreateJobInput> = {},
): CreateJobInput {
  jobCounter++;
  return {
    prompt: overrides.prompt ?? `Test prompt ${jobCounter}`,
    status: overrides.status ?? JobStatus.PENDING,
    userId: overrides.userId ?? 'test-user-id',
  };
}

export function resetJobFactory(): void {
  jobCounter = 0;
}
