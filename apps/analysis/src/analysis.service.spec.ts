import { Test, TestingModule } from '@nestjs/testing';
import { AnalysisService } from './analysis.service';
import {
  SentimentDataRepository,
  JobsRepository,
  NewSentimentData,
} from '@app/database';
import { RabbitmqService } from '@app/rabbitmq';
import { RawDataMessage, SentimentLabel, JobStatus } from '@app/shared-types';

describe('AnalysisService', () => {
  let service: AnalysisService;
  let mockSentimentDataRepository: Partial<SentimentDataRepository>;
  let mockJobsRepository: Partial<JobsRepository>;
  let mockRabbitmqService: Partial<RabbitmqService>;

  // Helper to get the create call argument with proper typing
  const getCreateCallArg = (): NewSentimentData => {
    const mock = mockSentimentDataRepository.create as jest.Mock<
      Promise<unknown>,
      [NewSentimentData]
    >;
    const calls = mock.mock.calls as [[NewSentimentData]];
    return calls[0][0];
  };

  beforeEach(async () => {
    mockSentimentDataRepository = {
      create: jest.fn().mockResolvedValue({
        id: 'test-sentiment-id',
        sentimentScore: 0.85,
        sentimentLabel: SentimentLabel.POSITIVE,
      }),
      countByJobId: jest.fn().mockResolvedValue(3),
      getAverageSentimentByJobId: jest.fn().mockResolvedValue('0.75'),
    };

    mockJobsRepository = {
      updateStatus: jest
        .fn()
        .mockResolvedValue({ status: JobStatus.COMPLETED }),
    };

    mockRabbitmqService = {
      emit: jest.fn(),
    };

    mockBertSentimentService = {
      analyze: jest.fn().mockResolvedValue({
        score: 0.85,
        label: 'positive',
        confidence: 0.92,
      }),
      isReady: jest.fn().mockReturnValue(true),
      getStatus: jest.fn().mockReturnValue({ ready: true, loading: false }),
    };

    module = await Test.createTestingModule({
      providers: [
        AnalysisService,
        {
          provide: SentimentDataRepository,
          useValue: mockSentimentDataRepository,
        },
        { provide: JobsRepository, useValue: mockJobsRepository },
        { provide: RabbitmqService, useValue: mockRabbitmqService },
        { provide: BertSentimentService, useValue: mockBertSentimentService },
      ],
    }).compile();

    service = module.get<AnalysisService>(AnalysisService);
    // Initialize module to trigger lifecycle hooks
    await module.init();
  });

  afterEach(async () => {
    // Close module to trigger OnModuleDestroy and clean up intervals
    await module.close();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processRawData', () => {
    const baseMessage: RawDataMessage = {
      jobId: '123e4567-e89b-12d3-a456-426614174000',
      source: 'reddit',
      textContent: 'I love this amazing product!',
      publishedAt: new Date(),
      collectedAt: new Date(),
    };

    it('should process positive text and save to database', async () => {
      (mockBertSentimentService.analyze as jest.Mock).mockResolvedValue({
        score: 0.85,
        label: 'positive',
        confidence: 0.92,
      });

      await service.processRawData(baseMessage, 'test-correlation-id');

      expect(mockSentimentDataRepository.create).toHaveBeenCalled();
      const createCall = getCreateCallArg();
      expect(createCall.sentimentLabel).toBe(SentimentLabel.POSITIVE);
      expect(createCall.sentimentScore).toBeGreaterThan(0.6);
    });

    it('should process negative text correctly', async () => {
      (mockBertSentimentService.analyze as jest.Mock).mockResolvedValue({
        score: 0.15,
        label: 'negative',
        confidence: 0.88,
      });

      const negativeMessage = {
        ...baseMessage,
        textContent: 'This is terrible and I hate it',
      };

      await service.processRawData(negativeMessage, 'test-correlation-id');

      const createCall = getCreateCallArg();
      expect(createCall.sentimentLabel).toBe(SentimentLabel.NEGATIVE);
      expect(createCall.sentimentScore).toBeLessThan(0.4);
    });

    it('should process neutral text correctly', async () => {
      (mockBertSentimentService.analyze as jest.Mock).mockResolvedValue({
        score: 0.5,
        label: 'neutral',
        confidence: 0.6,
      });

      const neutralMessage = {
        ...baseMessage,
        textContent: 'This product exists',
      };

      await service.processRawData(neutralMessage, 'test-correlation-id');

      const createCall = getCreateCallArg();
      expect(createCall.sentimentLabel).toBe(SentimentLabel.NEUTRAL);
    });

    it('should include confidence score', async () => {
      (mockBertSentimentService.analyze as jest.Mock).mockResolvedValue({
        score: 0.85,
        label: 'positive',
        confidence: 0.92,
      });

      await service.processRawData(baseMessage, 'test-correlation-id');

      const createCall = getCreateCallArg();
      expect(createCall.confidence).toBeGreaterThanOrEqual(0);
      expect(createCall.confidence).toBeLessThanOrEqual(1);
    });

    it('should include source information in saved data', async () => {
      await service.processRawData(baseMessage, 'test-correlation-id');

      const createCall = getCreateCallArg();
      expect(createCall.source).toBe('reddit');
      expect(createCall.jobId).toBe(baseMessage.jobId);
    });

    it('should handle optional fields from message', async () => {
      const messageWithOptionals: RawDataMessage = {
        ...baseMessage,
        sourceUrl: 'https://reddit.com/test',
        authorName: 'testuser',
        upvotes: 100,
        commentCount: 50,
      };

      await service.processRawData(messageWithOptionals, 'test-correlation-id');

      const createCall = getCreateCallArg();
      expect(createCall.sourceUrl).toBe('https://reddit.com/test');
      expect(createCall.authorName).toBe('testuser');
      expect(createCall.upvotes).toBe(100);
      expect(createCall.commentCount).toBe(50);
    });

    it('should process text with "okay" as neutral', async () => {
      (mockBertSentimentService.analyze as jest.Mock).mockResolvedValue({
        score: 0.5,
        label: 'neutral',
        confidence: 0.55,
      });

      const okayMessage = {
        ...baseMessage,
        textContent: 'The product is okay',
      };

      await service.processRawData(okayMessage, 'test-correlation-id');

      const createCall = getCreateCallArg();
      expect(createCall.sentimentLabel).toBe(SentimentLabel.NEUTRAL);
      expect(createCall.sentimentScore).toBe(0.5);
    });

    it('should process text with "excellent" as positive', async () => {
      (mockBertSentimentService.analyze as jest.Mock).mockResolvedValue({
        score: 0.9,
        label: 'positive',
        confidence: 0.95,
      });

      const excellentMessage = {
        ...baseMessage,
        textContent: 'This is excellent!',
      };

      await service.processRawData(excellentMessage, 'test-correlation-id');

      const createCall = getCreateCallArg();
      expect(createCall.sentimentLabel).toBe(SentimentLabel.POSITIVE);
    });

    it('should process text with "worst" as negative', async () => {
      (mockBertSentimentService.analyze as jest.Mock).mockResolvedValue({
        score: 0.1,
        label: 'negative',
        confidence: 0.9,
      });
      const worstMessage = {
        ...baseMessage,
        textContent: 'This is the worst product ever',
      };

      await service.processRawData(worstMessage, 'test-correlation-id');

      const createCall = getCreateCallArg();
      expect(createCall.sentimentLabel).toBe(SentimentLabel.NEGATIVE);
    });
  });
});
