import { JobStatus } from '@app/shared-types';
import { NewJob } from '../../schema/jobs.schema';

let jobCounter = 0;

/**
 * Input type matching JobsRepository.create() signature.
 */
export type CreateJobInput = Pick<NewJob, 'prompt' | 'status'>;

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
  };
}

export function resetJobFactory(): void {
  jobCounter = 0;
}
