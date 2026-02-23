import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { GatewayService } from './gateway.service';
import { JobsRepository, SentimentDataRepository } from '@app/database';
import { RabbitmqService } from '@app/rabbitmq';
import { JobStatus } from '@app/shared-types';

describe('GatewayService', () => {
  let service: GatewayService;
  let mockJobsRepository: Partial<JobsRepository>;
  let mockSentimentDataRepository: Partial<SentimentDataRepository>;
  let mockRabbitmqService: Partial<RabbitmqService>;

  const mockJob = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    userId: 'test-user-id',
    prompt: 'Test prompt',
    status: JobStatus.PENDING,
    searchStrategy: null,
    errorMessage: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: null,
  };

  beforeEach(async () => {
    mockJobsRepository = {
      create: jest.fn().mockResolvedValue(mockJob),
      findById: jest.fn().mockResolvedValue(mockJob),
      findAll: jest.fn().mockResolvedValue([mockJob]),
      findByIdForUser: jest.fn().mockResolvedValue(mockJob),
      findAllForUser: jest.fn().mockResolvedValue([mockJob]),
      deleteForUser: jest.fn().mockResolvedValue(mockJob),
      delete: jest.fn().mockResolvedValue(mockJob),
      updateStatus: jest
        .fn()
        .mockResolvedValue({ ...mockJob, status: JobStatus.IN_PROGRESS }),
    };

    mockSentimentDataRepository = {
      countByJobId: jest.fn().mockResolvedValue(3),
      getAverageSentimentByJobId: jest.fn().mockResolvedValue('0.75'),
      findByJobId: jest.fn().mockResolvedValue([]),
      deleteByJobId: jest.fn().mockResolvedValue(undefined),
    };

    mockRabbitmqService = {
      emit: jest.fn(),
      send: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GatewayService,
        { provide: JobsRepository, useValue: mockJobsRepository },
        {
          provide: SentimentDataRepository,
          useValue: mockSentimentDataRepository,
        },
        { provide: RabbitmqService, useValue: mockRabbitmqService },
      ],
    }).compile();

    service = module.get<GatewayService>(GatewayService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createJob', () => {
    it('should create job and emit message to RabbitMQ', async () => {
      const createJobDto = { prompt: 'Analyze sentiment for product X' };
      const correlationId = 'test-correlation-id';

      const result = await service.createJob(
        createJobDto,
        correlationId,
        'test-user-id',
      );

      expect(mockJobsRepository.create).toHaveBeenCalledWith({
        prompt: createJobDto.prompt,
        status: JobStatus.PENDING,
        userId: 'test-user-id',
      });
      expect(mockRabbitmqService.emit).toHaveBeenCalled();
      expect(result.jobId).toBe(mockJob.id);
      expect(result.status).toBe(JobStatus.PENDING);
    });

    it('should include job prompt in response', async () => {
      const createJobDto = { prompt: 'Test prompt' };

      const result = await service.createJob(
        createJobDto,
        'correlation-id',
        'test-user-id',
      );

      expect(result.prompt).toBe(mockJob.prompt);
    });
  });

  describe('getJob', () => {
    it('should return job when exists', async () => {
      const result = await service.getJob(mockJob.id, 'test-user-id');

      expect(result.jobId).toBe(mockJob.id);
      expect(result.prompt).toBe(mockJob.prompt);
    });

    it('should include data points count when available', async () => {
      const result = await service.getJob(mockJob.id, 'test-user-id');

      expect(result.dataPointsCount).toBe(3);
    });

    it('should include average sentiment when available', async () => {
      const result = await service.getJob(mockJob.id, 'test-user-id');

      expect(result.averageSentiment).toBe(0.75);
    });

    it('should call findByIdForUser with jobId and userId', async () => {
      await service.getJob(mockJob.id, 'test-user-id');

      expect(mockJobsRepository.findByIdForUser).toHaveBeenCalledWith(
        mockJob.id,
        'test-user-id',
      );
    });

    it('should throw NotFoundException when job does not exist or not owned', async () => {
      mockJobsRepository.findByIdForUser = jest
        .fn()
        .mockResolvedValue(undefined);

      await expect(
        service.getJob('non-existent-id', 'test-user-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listJobs', () => {
    it('should return array of jobs', async () => {
      const result = await service.listJobs('test-user-id');

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
      expect(result[0].jobId).toBe(mockJob.id);
    });

    it('should call findAllForUser with userId', async () => {
      await service.listJobs('test-user-id');

      expect(mockJobsRepository.findAllForUser).toHaveBeenCalledWith(
        'test-user-id',
      );
    });

    it('should return empty array when no jobs exist', async () => {
      mockJobsRepository.findAllForUser = jest.fn().mockResolvedValue([]);

      const result = await service.listJobs('test-user-id');

      expect(result).toHaveLength(0);
    });
  });

  describe('Data isolation', () => {
    const USER_B = 'different-user-id';

    it('should not return user A job when user B calls getJob', async () => {
      // User A's job exists, but findByIdForUser returns undefined for user B
      mockJobsRepository.findByIdForUser = jest
        .fn()
        .mockResolvedValue(undefined);

      await expect(service.getJob(mockJob.id, USER_B)).rejects.toThrow(
        NotFoundException,
      );

      expect(mockJobsRepository.findByIdForUser).toHaveBeenCalledWith(
        mockJob.id,
        USER_B,
      );
    });

    it('should return empty list when user B calls listJobs and only user A has jobs', async () => {
      mockJobsRepository.findAllForUser = jest.fn().mockResolvedValue([]);

      const result = await service.listJobs(USER_B);

      expect(result).toHaveLength(0);
      expect(mockJobsRepository.findAllForUser).toHaveBeenCalledWith(USER_B);
    });

    it('should not allow user B to delete user A job', async () => {
      mockJobsRepository.findByIdForUser = jest
        .fn()
        .mockResolvedValue(undefined);

      await expect(service.deleteJob(mockJob.id, USER_B)).rejects.toThrow(
        NotFoundException,
      );

      expect(mockJobsRepository.findByIdForUser).toHaveBeenCalledWith(
        mockJob.id,
        USER_B,
      );
      // deleteForUser should never be called since ownership check failed
      expect(mockJobsRepository.deleteForUser).not.toHaveBeenCalled();
    });
  });

  describe('deleteJob', () => {
    it('should delete job and return success', async () => {
      const result = await service.deleteJob(mockJob.id, 'test-user-id');

      expect(result).toEqual({ success: true });
    });

    it('should verify ownership via findByIdForUser', async () => {
      await service.deleteJob(mockJob.id, 'test-user-id');

      expect(mockJobsRepository.findByIdForUser).toHaveBeenCalledWith(
        mockJob.id,
        'test-user-id',
      );
    });

    it('should throw NotFoundException when job not found or not owned', async () => {
      mockJobsRepository.findByIdForUser = jest
        .fn()
        .mockResolvedValue(undefined);

      await expect(
        service.deleteJob('non-existent-id', 'test-user-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should emit cancel message to RabbitMQ', async () => {
      await service.deleteJob(mockJob.id, 'test-user-id');

      expect(mockRabbitmqService.emit).toHaveBeenCalled();
    });

    it('should delete sentiment data before deleting job', async () => {
      await service.deleteJob(mockJob.id, 'test-user-id');

      expect(mockSentimentDataRepository.deleteByJobId).toHaveBeenCalledWith(
        mockJob.id,
      );
      expect(mockJobsRepository.deleteForUser).toHaveBeenCalledWith(
        mockJob.id,
        'test-user-id',
      );
    });
  });
});
