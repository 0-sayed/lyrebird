import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { GatewayController } from './gateway.controller';
import { GatewayService } from './gateway.service';
import { SentimentDataRepository } from '@app/database';
import { JobStatus, SentimentLabel } from '@app/shared-types';
import {
  createMockGatewayService,
  createMockSentimentDataRepository,
  MockGatewayService,
  MockSentimentDataRepository,
} from '@app/testing';

describe('GatewayController', () => {
  let controller: GatewayController;
  let mockGatewayService: MockGatewayService;
  let mockSentimentDataRepository: MockSentimentDataRepository;

  const TEST_JOB_ID = '123e4567-e89b-12d3-a456-426614174000';
  const TEST_CORRELATION_ID = 'test-correlation-id';

  /**
   * Creates a mock request with optional correlationId
   */
  const createMockRequest = (correlationId?: string): Request =>
    ({ correlationId }) as unknown as Request;

  beforeEach(async () => {
    mockGatewayService = createMockGatewayService({
      mockJobResponse: { jobId: TEST_JOB_ID },
    });
    mockSentimentDataRepository = createMockSentimentDataRepository();

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
    const createJobDto = { prompt: 'Test prompt' };

    it('should return JobResponseDto with jobId when job created', async () => {
      const result = await controller.createJob(
        createJobDto,
        createMockRequest(TEST_CORRELATION_ID),
      );

      expect(result.jobId).toBe(TEST_JOB_ID);
      expect(result.status).toBe(JobStatus.PENDING);
    });

    it('should pass correlationId to service when provided', async () => {
      await controller.createJob(
        createJobDto,
        createMockRequest(TEST_CORRELATION_ID),
      );

      expect(mockGatewayService.createJob).toHaveBeenCalledWith(
        createJobDto,
        TEST_CORRELATION_ID,
      );
    });

    it('should default correlationId to unknown when not provided', async () => {
      await controller.createJob(createJobDto, createMockRequest());

      expect(mockGatewayService.createJob).toHaveBeenCalledWith(
        createJobDto,
        'unknown',
      );
    });
  });

  describe('GET /api/jobs', () => {
    it('should return array of JobResponseDto', async () => {
      const result = await controller.listJobs(
        createMockRequest(TEST_CORRELATION_ID),
      );

      expect(Array.isArray(result)).toBe(true);
      expect(result[0].jobId).toBe(TEST_JOB_ID);
    });
  });

  describe('GET /api/jobs/:id', () => {
    it('should return JobResponseDto for valid id', async () => {
      const result = await controller.getJob(
        TEST_JOB_ID,
        createMockRequest(TEST_CORRELATION_ID),
      );

      expect(result.jobId).toBe(TEST_JOB_ID);
    });

    it('should call service with provided job id', async () => {
      await controller.getJob(
        TEST_JOB_ID,
        createMockRequest(TEST_CORRELATION_ID),
      );

      expect(mockGatewayService.getJob).toHaveBeenCalledWith(TEST_JOB_ID);
    });
  });

  describe('GET /api/jobs/:id/results', () => {
    const mockSentimentData = [
      {
        id: 'sentiment-1',
        jobId: TEST_JOB_ID,
        source: 'bluesky',
        sourceUrl: 'https://bsky.app/test',
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

    beforeEach(() => {
      mockSentimentDataRepository.findByJobId.mockResolvedValue(
        mockSentimentData,
      );
      mockSentimentDataRepository.getAverageSentimentByJobId.mockResolvedValue(
        '0.85',
      );
      mockSentimentDataRepository.getSentimentDistributionByJobId.mockResolvedValue(
        [{ label: SentimentLabel.POSITIVE, count: 1 }],
      );
    });

    it('should return job with results structure', async () => {
      const result = await controller.getJobResults(
        TEST_JOB_ID,
        createMockRequest(TEST_CORRELATION_ID),
      );

      expect(result).toHaveProperty('job');
      expect(result).toHaveProperty('results');
      expect(result.results).toHaveProperty('averageSentiment');
      expect(result.results).toHaveProperty('totalDataPoints');
      expect(result.results).toHaveProperty('distribution');
      expect(result.results).toHaveProperty('data');
    });

    it('should parse averageSentiment as number', async () => {
      const result = await controller.getJobResults(
        TEST_JOB_ID,
        createMockRequest(TEST_CORRELATION_ID),
      );

      expect(result.results.averageSentiment).toBe(0.85);
    });

    it('should return null averageSentiment when not available', async () => {
      mockSentimentDataRepository.getAverageSentimentByJobId.mockResolvedValue(
        null,
      );

      const result = await controller.getJobResults(
        TEST_JOB_ID,
        createMockRequest(TEST_CORRELATION_ID),
      );

      expect(result.results.averageSentiment).toBeNull();
    });

    it('should return null averageSentiment when value is NaN', async () => {
      mockSentimentDataRepository.getAverageSentimentByJobId.mockResolvedValue(
        'not-a-number',
      );

      const result = await controller.getJobResults(
        TEST_JOB_ID,
        createMockRequest(TEST_CORRELATION_ID),
      );

      expect(result.results.averageSentiment).toBeNull();
    });

    it('should handle empty sentiment data array', async () => {
      mockSentimentDataRepository.findByJobId.mockResolvedValue([]);
      mockSentimentDataRepository.getSentimentDistributionByJobId.mockResolvedValue(
        [],
      );

      const result = await controller.getJobResults(
        TEST_JOB_ID,
        createMockRequest(TEST_CORRELATION_ID),
      );

      expect(result.results.totalDataPoints).toBe(0);
      expect(result.results.data).toEqual([]);
    });

    it('should handle undefined sentiment data', async () => {
      mockSentimentDataRepository.findByJobId.mockResolvedValue(undefined);

      const result = await controller.getJobResults(
        TEST_JOB_ID,
        createMockRequest(TEST_CORRELATION_ID),
      );

      expect(result.results.totalDataPoints).toBe(0);
      expect(result.results.data).toEqual([]);
    });

    it('should map sentiment data to response format', async () => {
      const result = await controller.getJobResults(
        TEST_JOB_ID,
        createMockRequest(TEST_CORRELATION_ID),
      );

      expect(result.results.data).toHaveLength(1);
      expect(result.results.data[0]).toMatchObject({
        id: 'sentiment-1',
        textContent: 'Great product!',
        sentimentLabel: SentimentLabel.POSITIVE,
        sentimentScore: 0.85,
        source: 'bluesky',
      });
    });

    it('should convert distribution count to number', async () => {
      mockSentimentDataRepository.getSentimentDistributionByJobId.mockResolvedValue(
        [
          { label: SentimentLabel.POSITIVE, count: '5' },
          { label: SentimentLabel.NEGATIVE, count: 3 },
        ],
      );

      const result = await controller.getJobResults(
        TEST_JOB_ID,
        createMockRequest(TEST_CORRELATION_ID),
      );

      expect(result.results.distribution[0].count).toBe(5);
      expect(result.results.distribution[1].count).toBe(3);
    });

    it('should handle non-finite distribution count as zero', async () => {
      mockSentimentDataRepository.getSentimentDistributionByJobId.mockResolvedValue(
        [{ label: SentimentLabel.POSITIVE, count: Infinity }],
      );

      const result = await controller.getJobResults(
        TEST_JOB_ID,
        createMockRequest(TEST_CORRELATION_ID),
      );

      expect(result.results.distribution[0].count).toBe(0);
    });

    it('should use analyzedAt as fallback when publishedAt is null', async () => {
      const analyzedAt = new Date('2025-01-15T10:00:00Z');
      mockSentimentDataRepository.findByJobId.mockResolvedValue([
        {
          ...mockSentimentData[0],
          publishedAt: null,
          analyzedAt,
        },
      ]);

      const result = await controller.getJobResults(
        TEST_JOB_ID,
        createMockRequest(TEST_CORRELATION_ID),
      );

      expect(result.results.data[0].publishedAt).toBe(analyzedAt);
    });
  });

  describe('DELETE /api/jobs/:id', () => {
    it('should return success true when job deleted', async () => {
      const result = await controller.deleteJob(
        TEST_JOB_ID,
        createMockRequest(TEST_CORRELATION_ID),
      );

      expect(result).toEqual({ success: true });
    });

    it('should call service with provided job id', async () => {
      await controller.deleteJob(
        TEST_JOB_ID,
        createMockRequest(TEST_CORRELATION_ID),
      );

      expect(mockGatewayService.deleteJob).toHaveBeenCalledWith(TEST_JOB_ID);
    });

    it('should default correlationId to unknown when not provided', async () => {
      await controller.deleteJob(TEST_JOB_ID, createMockRequest());

      // Controller logs with correlationId but doesn't pass it to service
      // This test verifies the flow works without errors
      expect(mockGatewayService.deleteJob).toHaveBeenCalledWith(TEST_JOB_ID);
    });
  });
});
