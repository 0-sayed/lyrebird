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
      updateStatus: jest
        .fn()
        .mockResolvedValue({ ...mockJob, status: JobStatus.IN_PROGRESS }),
    };

    mockSentimentDataRepository = {
      countByJobId: jest.fn().mockResolvedValue(3),
      getAverageSentimentByJobId: jest.fn().mockResolvedValue('0.75'),
      findByJobId: jest.fn().mockResolvedValue([]),
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

      const result = await service.createJob(createJobDto, correlationId);

      expect(mockJobsRepository.create).toHaveBeenCalledWith({
        prompt: createJobDto.prompt,
        status: JobStatus.PENDING,
      });
      expect(mockRabbitmqService.emit).toHaveBeenCalled();
      expect(result.jobId).toBe(mockJob.id);
      expect(result.status).toBe(JobStatus.PENDING);
    });

    it('should include job prompt in response', async () => {
      const createJobDto = { prompt: 'Test prompt' };

      const result = await service.createJob(createJobDto, 'correlation-id');

      expect(result.prompt).toBe(mockJob.prompt);
    });
  });

  describe('getJob', () => {
    it('should return job when exists', async () => {
      const result = await service.getJob(mockJob.id);

      expect(result.jobId).toBe(mockJob.id);
      expect(result.prompt).toBe(mockJob.prompt);
    });

    it('should include data points count when available', async () => {
      const result = await service.getJob(mockJob.id);

      expect(result.dataPointsCount).toBe(3);
    });

    it('should include average sentiment when available', async () => {
      const result = await service.getJob(mockJob.id);

      expect(result.averageSentiment).toBe(0.75);
    });

    it('should throw NotFoundException when job does not exist', async () => {
      mockJobsRepository.findById = jest.fn().mockResolvedValue(undefined);

      await expect(service.getJob('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('listJobs', () => {
    it('should return array of jobs', async () => {
      const result = await service.listJobs();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
      expect(result[0].jobId).toBe(mockJob.id);
    });

    it('should return empty array when no jobs exist', async () => {
      mockJobsRepository.findAll = jest.fn().mockResolvedValue([]);

      const result = await service.listJobs();

      expect(result).toHaveLength(0);
    });
  });
});
