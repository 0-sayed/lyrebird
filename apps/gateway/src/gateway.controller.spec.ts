import { Test, TestingModule } from '@nestjs/testing';
import { GatewayController } from './gateway.controller';
import { GatewayService } from './gateway.service';
import { SentimentDataRepository } from '@app/database';
import { JobStatus, SentimentLabel } from '@app/shared-types';

describe('GatewayController', () => {
  let controller: GatewayController;
  let mockGatewayService: Partial<GatewayService>;
  let mockSentimentDataRepository: Partial<SentimentDataRepository>;

  const mockJobResponse = {
    jobId: '123e4567-e89b-12d3-a456-426614174000',
    prompt: 'Test prompt',
    status: JobStatus.PENDING,
    dataPointsCount: 0,
    averageSentiment: undefined,
    createdAt: new Date(),
  };

  const mockSentimentData = [
    {
      id: 'sentiment-1',
      jobId: mockJobResponse.jobId,
      source: 'reddit',
      sourceUrl: 'https://reddit.com/test',
      authorName: 'testuser',
      textContent: 'Great product!',
      rawContent: 'Great product!',
      sentimentScore: 0.85,
      sentimentLabel: SentimentLabel.POSITIVE,
      confidence: 0.92,
      upvotes: 10,
      commentCount: 5,
      publishedAt: new Date(),
      collectedAt: new Date(),
      analyzedAt: new Date(),
    },
  ];

  beforeEach(async () => {
    mockGatewayService = {
      createJob: jest.fn().mockResolvedValue(mockJobResponse),
      getJob: jest.fn().mockResolvedValue(mockJobResponse),
      listJobs: jest.fn().mockResolvedValue([mockJobResponse]),
    };

    mockSentimentDataRepository = {
      findByJobId: jest.fn().mockResolvedValue(mockSentimentData),
      getAverageSentimentByJobId: jest.fn().mockResolvedValue('0.85'),
      getSentimentDistributionByJobId: jest
        .fn()
        .mockResolvedValue([{ label: SentimentLabel.POSITIVE, count: 1 }]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GatewayController],
      providers: [
        { provide: GatewayService, useValue: mockGatewayService },
        {
          provide: SentimentDataRepository,
          useValue: mockSentimentDataRepository,
        },
      ],
    }).compile();

    controller = module.get<GatewayController>(GatewayController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('POST /api/jobs', () => {
    it('should create job and return response', async () => {
      const createJobDto = { prompt: 'Test prompt' };
      const mockRequest = { correlationId: 'test-id' } as never;

      const result = await controller.createJob(createJobDto, mockRequest);

      expect(mockGatewayService.createJob).toHaveBeenCalledWith(
        createJobDto,
        'test-id',
      );
      expect(result.jobId).toBe(mockJobResponse.jobId);
    });

    it('should use unknown as correlationId when not provided', async () => {
      const createJobDto = { prompt: 'Test prompt' };
      const mockRequest = {} as never;

      await controller.createJob(createJobDto, mockRequest);

      expect(mockGatewayService.createJob).toHaveBeenCalledWith(
        createJobDto,
        'unknown',
      );
    });
  });

  describe('GET /api/jobs', () => {
    it('should return list of jobs', async () => {
      const mockRequest = { correlationId: 'test-id' } as never;

      const result = await controller.listJobs(mockRequest);

      expect(Array.isArray(result)).toBe(true);
      expect(result[0].jobId).toBe(mockJobResponse.jobId);
    });
  });

  describe('GET /api/jobs/:id', () => {
    it('should return job by id', async () => {
      const mockRequest = { correlationId: 'test-id' } as never;

      const result = await controller.getJob(
        mockJobResponse.jobId,
        mockRequest,
      );

      expect(mockGatewayService.getJob).toHaveBeenCalledWith(
        mockJobResponse.jobId,
      );
      expect(result.jobId).toBe(mockJobResponse.jobId);
    });
  });

  describe('GET /api/jobs/:id/results', () => {
    it('should return job with sentiment data', async () => {
      const mockRequest = { correlationId: 'test-id' } as never;

      const result = await controller.getJobResults(
        mockJobResponse.jobId,
        mockRequest,
      );

      expect(result).toHaveProperty('job');
      expect(result).toHaveProperty('results');
      expect(result.results).toHaveProperty('averageSentiment');
      expect(result.results).toHaveProperty('totalDataPoints');
      expect(result.results).toHaveProperty('distribution');
      expect(result.results).toHaveProperty('data');
    });

    it('should return correct average sentiment', async () => {
      const mockRequest = { correlationId: 'test-id' } as never;

      const result = await controller.getJobResults(
        mockJobResponse.jobId,
        mockRequest,
      );

      expect(result.results.averageSentiment).toBe(0.85);
    });

    it('should handle null average sentiment', async () => {
      mockSentimentDataRepository.getAverageSentimentByJobId = jest
        .fn()
        .mockResolvedValue(null);
      const mockRequest = { correlationId: 'test-id' } as never;

      const result = await controller.getJobResults(
        mockJobResponse.jobId,
        mockRequest,
      );

      expect(result.results.averageSentiment).toBeNull();
    });
  });
});
