import { JobStatus } from '@app/shared-types';
import {
  getTestDatabaseService,
  TestDatabaseService,
} from '../test/test-database.service';
import { createTestJob, resetJobFactory } from '../test/factories/job.factory';
import { DatabaseService } from '../database.service';
import { JobsRepository } from './jobs.repository';

describe('JobsRepository Integration', () => {
  let testDb: TestDatabaseService;
  let jobsRepository: JobsRepository;

  beforeAll(() => {
    testDb = getTestDatabaseService();
    testDb.connect();
    jobsRepository = new JobsRepository(testDb as unknown as DatabaseService);
  });

  afterAll(async () => {
    await testDb.disconnect();
  });

  beforeEach(async () => {
    await testDb.cleanTables();
    resetJobFactory();
  });

  describe('create', () => {
    it('should insert a job and return it with a generated UUID', async () => {
      const input = createTestJob();
      const job = await jobsRepository.create(input);

      expect(job).toBeDefined();
      expect(job.id).toBeDefined();
      expect(job.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(job.prompt).toBe(input.prompt);
    });

    it('should default status to PENDING when not specified', async () => {
      const input = createTestJob({ prompt: 'No status provided' });
      // status is PENDING from factory, but explicitly omit to rely on DB default
      const job = await jobsRepository.create({
        prompt: input.prompt,
        userId: input.userId,
      });

      expect(job.status).toBe(JobStatus.PENDING);
    });

    it('should store the provided status', async () => {
      const input = createTestJob({ status: JobStatus.IN_PROGRESS });
      const job = await jobsRepository.create(input);

      expect(job.status).toBe(JobStatus.IN_PROGRESS);
    });

    it('should set createdAt and updatedAt timestamps', async () => {
      const before = new Date();
      const job = await jobsRepository.create(createTestJob());
      const after = new Date();

      expect(job.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(job.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
      expect(job.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(job.updatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('findById', () => {
    it('should return the job when it exists', async () => {
      const created = await jobsRepository.create(createTestJob());
      const found = await jobsRepository.findById(created.id);

      expect(found).toBeDefined();
      expect(found!.id).toBe(created.id);
      expect(found!.prompt).toBe(created.prompt);
      expect(found!.status).toBe(created.status);
    });

    it('should return undefined for a non-existent UUID', async () => {
      const result = await jobsRepository.findById(
        '00000000-0000-0000-0000-000000000000',
      );
      expect(result).toBeUndefined();
    });
  });

  describe('updateStatus', () => {
    it('should update the job status and return the updated job', async () => {
      const created = await jobsRepository.create(createTestJob());
      const updated = await jobsRepository.updateStatus(
        created.id,
        JobStatus.IN_PROGRESS,
      );

      expect(updated).toBeDefined();
      expect(updated?.id).toBe(created.id);
      expect(updated?.status).toBe(JobStatus.IN_PROGRESS);
    });

    it('should update the updatedAt timestamp', async () => {
      const created = await jobsRepository.create(createTestJob());
      const originalUpdatedAt = created.updatedAt;

      // Small delay to ensure timestamp differs
      await new Promise((resolve) => setTimeout(resolve, 10));

      const updated = await jobsRepository.updateStatus(
        created.id,
        JobStatus.COMPLETED,
      );

      expect(updated).toBeDefined();
      expect(updated!.updatedAt.getTime()).toBeGreaterThan(
        originalUpdatedAt.getTime(),
      );
    });

    it('should return undefined for a non-existent job (Drizzle returns empty array)', async () => {
      const result = await jobsRepository.updateStatus(
        '00000000-0000-0000-0000-000000000000',
        JobStatus.COMPLETED,
      );
      // Drizzle destructures an empty returning() array, yielding undefined
      expect(result).toBeUndefined();
    });

    it.each([
      [JobStatus.PENDING, JobStatus.IN_PROGRESS],
      [JobStatus.IN_PROGRESS, JobStatus.COMPLETED],
      [JobStatus.IN_PROGRESS, JobStatus.FAILED],
      [JobStatus.PENDING, JobStatus.FAILED],
    ])(
      'should transition status from %s to %s',
      async (fromStatus, toStatus) => {
        const created = await jobsRepository.create(
          createTestJob({ status: fromStatus }),
        );
        const updated = await jobsRepository.updateStatus(created.id, toStatus);

        expect(updated).toBeDefined();
        expect(updated?.status).toBe(toStatus);
      },
    );
  });

  describe('findAll', () => {
    it('should return all jobs', async () => {
      await jobsRepository.create(createTestJob());
      await jobsRepository.create(createTestJob());
      await jobsRepository.create(createTestJob());

      const all = await jobsRepository.findAll();
      expect(all).toHaveLength(3);
    });

    it('should return an empty array when no jobs exist', async () => {
      const all = await jobsRepository.findAll();
      expect(all).toEqual([]);
    });

    it('should return all jobs with correct fields', async () => {
      const input = createTestJob({ prompt: 'findAll test prompt' });
      await jobsRepository.create(input);

      const all = await jobsRepository.findAll();
      expect(all).toHaveLength(1);
      expect(all[0].prompt).toBe(input.prompt);
      expect(all[0].status).toBe(input.status);
    });
  });

  describe('delete', () => {
    it('should delete a job and return the deleted job', async () => {
      const created = await jobsRepository.create(createTestJob());
      const deleted = await jobsRepository.delete(created.id);

      expect(deleted).toBeDefined();
      expect(deleted!.id).toBe(created.id);
      expect(deleted!.prompt).toBe(created.prompt);
    });

    it('should remove the job from the database after deletion', async () => {
      const created = await jobsRepository.create(createTestJob());
      await jobsRepository.delete(created.id);

      const found = await jobsRepository.findById(created.id);
      expect(found).toBeUndefined();
    });

    it('should return undefined for a non-existent job', async () => {
      const result = await jobsRepository.delete(
        '00000000-0000-0000-0000-000000000000',
      );
      expect(result).toBeUndefined();
    });
  });

  describe('concurrent operations', () => {
    it('should handle 10 concurrent creates without conflicts', async () => {
      const inputs = Array.from({ length: 10 }, () => createTestJob());
      const results = await Promise.all(
        inputs.map((input) => jobsRepository.create(input)),
      );

      expect(results).toHaveLength(10);
      const ids = results.map((j) => j.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(10);
    });
  });
});
