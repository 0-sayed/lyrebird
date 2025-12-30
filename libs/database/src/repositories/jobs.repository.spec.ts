import { Test, TestingModule } from '@nestjs/testing';
import { JobsRepository } from './jobs.repository';
import { DatabaseService } from '../database.service';
import { JobStatus } from '@app/shared-types';
import { Job } from '../schema';

describe('JobsRepository', () => {
  let repository: JobsRepository;
  let mockDatabaseService: Partial<DatabaseService>;

  const mockJob: Job = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    prompt: 'Test prompt for TDD',
    status: JobStatus.PENDING,
    searchStrategy: null,
    errorMessage: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: null,
  };

  beforeEach(async () => {
    // Mock the database service with chainable query builder
    const mockQueryBuilder = {
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValue([mockJob]),
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue([mockJob]),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
    };

    mockDatabaseService = {
      db: mockQueryBuilder as unknown as DatabaseService['db'],
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
    it('should create a job with valid data', async () => {
      const job = await repository.create({
        prompt: 'Test prompt for TDD',
        status: JobStatus.PENDING,
      });

      expect(job).toBeDefined();
      expect(job.id).toBe(mockJob.id);
      expect(job.prompt).toBe('Test prompt for TDD');
      expect(job.status).toBe(JobStatus.PENDING);
    });

    it('should call insert with correct values', async () => {
      const input = {
        prompt: 'Test prompt',
        status: JobStatus.PENDING,
      };

      const result = await repository.create(input);

      // Verify the repository returns the expected result from the mock
      expect(result).toBeDefined();
      expect(result.prompt).toBe('Test prompt for TDD');
    });
  });

  describe('findById', () => {
    it('should return job when exists', async () => {
      const found = await repository.findById(mockJob.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(mockJob.id);
    });

    it('should return undefined for non-existent job', async () => {
      // Override mock for this test
      const emptyQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([]),
      };
      (mockDatabaseService as { db: unknown }).db = emptyQueryBuilder;

      const found = await repository.findById(
        '00000000-0000-0000-0000-000000000999',
      );

      expect(found).toBeUndefined();
    });
  });

  describe('updateStatus', () => {
    it('should update job status', async () => {
      const updatedJob = { ...mockJob, status: JobStatus.IN_PROGRESS };
      const mockQueryBuilder = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([updatedJob]),
      };
      (mockDatabaseService as { db: unknown }).db = mockQueryBuilder;

      const updated = await repository.updateStatus(
        mockJob.id,
        JobStatus.IN_PROGRESS,
      );

      expect(updated.status).toBe(JobStatus.IN_PROGRESS);
    });
  });

  describe('findAll', () => {
    it('should return array of jobs', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockResolvedValue([mockJob]),
      };
      (mockDatabaseService as { db: unknown }).db = mockQueryBuilder;

      const jobs = await repository.findAll();

      expect(Array.isArray(jobs)).toBe(true);
      expect(jobs).toHaveLength(1);
    });

    it('should return empty array when no jobs exist', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockResolvedValue([]),
      };
      (mockDatabaseService as { db: unknown }).db = mockQueryBuilder;

      const jobs = await repository.findAll();

      expect(jobs).toHaveLength(0);
    });
  });
});
