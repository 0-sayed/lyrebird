import { Test, TestingModule } from '@nestjs/testing';
import { JobsRepository } from './jobs.repository';
import { DatabaseService } from '../database.service';
import { JobStatus } from '@app/shared-types';
import { Job } from '../schema';
import { createMockDrizzleQueryBuilder } from '@app/testing';

/**
 * Unit tests for JobsRepository
 *
 * These tests verify the query builder logic using mocks.
 * For integration tests with a real database, see jobs.repository.integration.spec.ts
 */
describe('JobsRepository', () => {
  let repository: JobsRepository;
  let mockDb: ReturnType<typeof createMockDrizzleQueryBuilder>;

  /**
   * Creates a mock job with default values
   */
  const createMockJob = (overrides: Partial<Job> = {}): Job => ({
    id: '123e4567-e89b-12d3-a456-426614174000',
    prompt: 'Test prompt for TDD',
    status: JobStatus.PENDING,
    searchStrategy: null,
    errorMessage: null,
    createdAt: new Date('2026-01-24T12:00:00Z'),
    updatedAt: new Date('2026-01-24T12:00:00Z'),
    completedAt: null,
    ...overrides,
  });

  beforeEach(async () => {
    mockDb = createMockDrizzleQueryBuilder();

    const mockDatabaseService: Partial<DatabaseService> = {
      db: mockDb as unknown as DatabaseService['db'],
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobsRepository,
        { provide: DatabaseService, useValue: mockDatabaseService },
      ],
    }).compile();

    repository = module.get<JobsRepository>(JobsRepository);
  });

  describe('create', () => {
    it('should return created job when insert succeeds', async () => {
      const mockJob = createMockJob();
      mockDb.returning.mockResolvedValue([mockJob]);

      const result = await repository.create({
        prompt: 'Test prompt for TDD',
        status: JobStatus.PENDING,
      });

      expect(result).toEqual(mockJob);
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalledWith({
        prompt: 'Test prompt for TDD',
        status: JobStatus.PENDING,
      });
      expect(mockDb.returning).toHaveBeenCalled();
    });

    it.each([
      [JobStatus.PENDING],
      [JobStatus.IN_PROGRESS],
      [JobStatus.COMPLETED],
      [JobStatus.FAILED],
    ] as const)('should accept status %s', async (status: JobStatus) => {
      const mockJob = createMockJob({ status });
      mockDb.returning.mockResolvedValue([mockJob]);

      const result = await repository.create({ prompt: 'Test', status });

      expect(result.status).toBe(status);
    });

    it('should propagate database errors', async () => {
      mockDb.returning.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(
        repository.create({ prompt: 'Test', status: JobStatus.PENDING }),
      ).rejects.toThrow('Database connection failed');
    });
  });

  describe('findById', () => {
    it('should return job when exists', async () => {
      const mockJob = createMockJob();
      mockDb.where.mockResolvedValue([mockJob]);

      const result = await repository.findById(mockJob.id);

      expect(result).toEqual(mockJob);
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.from).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should return undefined when job does not exist', async () => {
      mockDb.where.mockResolvedValue([]);

      const result = await repository.findById('non-existent-id');

      expect(result).toBeUndefined();
    });

    it.each([
      '123e4567-e89b-12d3-a456-426614174000',
      '00000000-0000-0000-0000-000000000000',
      'ffffffff-ffff-ffff-ffff-ffffffffffff',
    ])('should query with job ID: %s', async (jobId) => {
      mockDb.where.mockResolvedValue([]);

      await repository.findById(jobId);

      expect(mockDb.where).toHaveBeenCalled();
    });
  });

  describe('updateStatus', () => {
    it.each([
      [JobStatus.PENDING, JobStatus.IN_PROGRESS],
      [JobStatus.IN_PROGRESS, JobStatus.COMPLETED],
      [JobStatus.IN_PROGRESS, JobStatus.FAILED],
      [JobStatus.PENDING, JobStatus.FAILED],
    ] as const)(
      'should update status from %s to %s',
      async (fromStatus: JobStatus, toStatus: JobStatus) => {
        const mockJob = createMockJob({ status: toStatus });
        mockDb.returning.mockResolvedValue([mockJob]);

        const result = await repository.updateStatus(mockJob.id, toStatus);

        expect(result.status).toBe(toStatus);
        expect(mockDb.update).toHaveBeenCalled();
        expect(mockDb.set).toHaveBeenCalled();
        expect(mockDb.where).toHaveBeenCalled();
      },
    );

    it('should set updatedAt when updating status', async () => {
      const mockJob = createMockJob({ status: JobStatus.IN_PROGRESS });
      mockDb.returning.mockResolvedValue([mockJob]);

      await repository.updateStatus(mockJob.id, JobStatus.IN_PROGRESS);

      expect(mockDb.set).toHaveBeenCalled();
      // Get the first call argument and assert its properties
      const calls = mockDb.set.mock.calls as Array<
        [{ status: JobStatus; updatedAt: Date }]
      >;
      const setArg = calls[0][0];
      expect(setArg.status).toBe(JobStatus.IN_PROGRESS);
      expect(setArg.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('findAll', () => {
    it('should return array of jobs', async () => {
      const mockJobs = [
        createMockJob({ id: 'job-1', prompt: 'First prompt' }),
        createMockJob({ id: 'job-2', prompt: 'Second prompt' }),
      ];
      mockDb.from.mockResolvedValue(mockJobs);

      const result = await repository.findAll();

      expect(result).toHaveLength(2);
      expect(result).toEqual(mockJobs);
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.from).toHaveBeenCalled();
    });

    it('should return empty array when no jobs exist', async () => {
      mockDb.from.mockResolvedValue([]);

      const result = await repository.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('delete', () => {
    it('should return deleted job when exists', async () => {
      const mockJob = createMockJob();
      mockDb.returning.mockResolvedValue([mockJob]);

      const result = await repository.delete(mockJob.id);

      expect(result).toEqual(mockJob);
      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should return undefined when job does not exist', async () => {
      mockDb.returning.mockResolvedValue([]);

      const result = await repository.delete('non-existent-id');

      expect(result).toBeUndefined();
    });

    it('should propagate database errors', async () => {
      mockDb.returning.mockRejectedValue(new Error('Foreign key constraint'));

      await expect(repository.delete('job-id')).rejects.toThrow(
        'Foreign key constraint',
      );
    });
  });

  describe('error handling', () => {
    it('should propagate errors from create', async () => {
      mockDb.returning.mockRejectedValue(new Error('DB Error'));

      await expect(
        repository.create({ prompt: 'Test', status: JobStatus.PENDING }),
      ).rejects.toThrow('DB Error');
    });

    it('should propagate errors from findById', async () => {
      mockDb.where.mockRejectedValue(new Error('DB Error'));

      await expect(repository.findById('id')).rejects.toThrow('DB Error');
    });

    it('should propagate errors from updateStatus', async () => {
      mockDb.returning.mockRejectedValue(new Error('DB Error'));

      await expect(
        repository.updateStatus('id', JobStatus.IN_PROGRESS),
      ).rejects.toThrow('DB Error');
    });

    it('should propagate errors from findAll', async () => {
      mockDb.from.mockRejectedValue(new Error('DB Error'));

      await expect(repository.findAll()).rejects.toThrow('DB Error');
    });

    it('should propagate errors from delete', async () => {
      mockDb.returning.mockRejectedValue(new Error('DB Error'));

      await expect(repository.delete('id')).rejects.toThrow('DB Error');
    });
  });
});
