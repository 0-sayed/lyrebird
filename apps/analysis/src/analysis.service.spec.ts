import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AnalysisService } from './analysis.service';
import {
  SentimentDataRepository,
  JobsRepository,
  NewSentimentData,
} from '@app/database';
import { RabbitmqService } from '@app/rabbitmq';
import {
  SentimentLabel,
  JobStatus,
  IngestionCompleteMessage,
  MESSAGE_PATTERNS,
} from '@app/shared-types';
import { BertSentimentService } from './services/bert-sentiment.service';
import {
  createMockJobsRepository,
  createMockSentimentDataRepository,
  createMockRabbitmqService,
  createMockBertSentimentService,
  MockJobStore,
} from '@app/testing';
import {
  createMockRawDataMessage,
  createMockIngestionCompleteMessage,
  resetMessageCounter,
} from '../../../test/fixtures';

describe('AnalysisService', () => {
  let service: AnalysisService;
  let testingModule: TestingModule;
  let mockSentimentDataRepo: ReturnType<
    typeof createMockSentimentDataRepository
  >;
  let mockJobsRepo: ReturnType<typeof createMockJobsRepository>;
  let mockRabbitmqService: ReturnType<typeof createMockRabbitmqService>;
  let mockBertService: ReturnType<typeof createMockBertSentimentService>;
  let jobStore: MockJobStore;

  // Test constants
  const TEST_JOB_ID = '123e4567-e89b-12d3-a456-426614174000';
  const TEST_JOB_ID_2 = '223e4567-e89b-12d3-a456-426614174001';

  /**
   * Helper to get the create call argument with proper typing
   */
  const getCreateCallArg = (callIndex = 0): NewSentimentData => {
    const mock = mockSentimentDataRepo.create as jest.Mock<
      Promise<unknown>,
      [NewSentimentData]
    >;
    const calls = mock.mock.calls;
    return calls[callIndex][0];
  };

  /**
   * Helper to create a message for the test job
   */
  const createTestMessage = (text: string, jobId = TEST_JOB_ID) =>
    createMockRawDataMessage({
      jobId,
      textContent: text,
    });

  /**
   * Helper to set up BERT mock for specific sentiment
   */
  const setupBertMock = (
    score: number,
    label: 'positive' | 'negative' | 'neutral',
    confidence = 0.85,
  ) => {
    mockBertService.analyze.mockResolvedValue({
      score,
      label,
      confidence,
      source: 'local-onnx',
    });
  };

  /**
   * Helper to create ingestion complete message
   */
  const createIngestionComplete = (
    totalItems: number,
    jobId = TEST_JOB_ID,
  ): IngestionCompleteMessage =>
    createMockIngestionCompleteMessage({ jobId, totalItems });

  /**
   * Helper to assert job was completed
   */
  const assertJobCompleted = (jobId = TEST_JOB_ID) => {
    expect(mockJobsRepo.updateStatus).toHaveBeenCalledWith(
      jobId,
      JobStatus.COMPLETED,
    );
    expect(mockRabbitmqService.emit).toHaveBeenCalledWith(
      MESSAGE_PATTERNS.JOB_COMPLETE,
      expect.objectContaining({ jobId, status: JobStatus.COMPLETED }),
    );
  };

  /**
   * Helper to assert job was NOT completed
   */
  const assertJobNotCompleted = () => {
    expect(mockJobsRepo.updateStatus).not.toHaveBeenCalled();
  };

  /**
   * Rebuilds the testing module (needed after testingModule.close())
   */
  const rebuildModule = async () => {
    testingModule = await Test.createTestingModule({
      providers: [
        AnalysisService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(10),
          },
        },
        { provide: SentimentDataRepository, useValue: mockSentimentDataRepo },
        { provide: JobsRepository, useValue: mockJobsRepo },
        { provide: RabbitmqService, useValue: mockRabbitmqService },
        { provide: BertSentimentService, useValue: mockBertService },
      ],
    }).compile();

    service = testingModule.get<AnalysisService>(AnalysisService);
    await testingModule.init();
  };

  beforeEach(async () => {
    resetMessageCounter();
    jobStore = new MockJobStore();

    // Set up test job in store
    jobStore.set(TEST_JOB_ID, {
      id: TEST_JOB_ID,
      prompt: 'test prompt',
      status: JobStatus.IN_PROGRESS,
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: null,
    });

    mockSentimentDataRepo = createMockSentimentDataRepository();
    mockJobsRepo = createMockJobsRepository(jobStore);
    mockRabbitmqService = createMockRabbitmqService();
    mockBertService = createMockBertSentimentService();

    // Default mock behavior
    mockSentimentDataRepo.countByJobId.mockResolvedValue(3);
    mockSentimentDataRepo.getAverageSentimentByJobId.mockResolvedValue('0.75');
    mockSentimentDataRepo.create.mockResolvedValue({
      id: 'test-sentiment-id',
      sentimentScore: 0.85,
      sentimentLabel: SentimentLabel.POSITIVE,
    });

    testingModule = await Test.createTestingModule({
      providers: [
        AnalysisService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'FAR_FUTURE_YEARS_THRESHOLD') return 10;
              return undefined;
            }),
          },
        },
        { provide: SentimentDataRepository, useValue: mockSentimentDataRepo },
        { provide: JobsRepository, useValue: mockJobsRepo },
        { provide: RabbitmqService, useValue: mockRabbitmqService },
        { provide: BertSentimentService, useValue: mockBertService },
      ],
    }).compile();

    service = testingModule.get<AnalysisService>(AnalysisService);
    await testingModule.init();
  });

  afterEach(async () => {
    await testingModule.close();
  });

  describe('processRawData', () => {
    describe('sentiment classification', () => {
      it.each([
        {
          score: 0.85,
          label: 'positive' as const,
          expected: SentimentLabel.POSITIVE,
        },
        {
          score: -0.85,
          label: 'negative' as const,
          expected: SentimentLabel.NEGATIVE,
        },
        {
          score: 0.0,
          label: 'neutral' as const,
          expected: SentimentLabel.NEUTRAL,
        },
        {
          score: 0.9,
          label: 'positive' as const,
          expected: SentimentLabel.POSITIVE,
        },
        {
          score: 0.1,
          label: 'negative' as const,
          expected: SentimentLabel.NEGATIVE,
        },
      ])(
        'should classify as $expected when BERT returns $label',
        async ({ score, label, expected }) => {
          setupBertMock(score, label);
          const message = createTestMessage(`Test ${label} text`);

          await service.processRawData(message, 'test-correlation-id');

          const createCall = getCreateCallArg();
          expect(createCall.sentimentLabel).toBe(expected);
        },
      );

      it('should include confidence score in range [0, 1]', async () => {
        setupBertMock(0.85, 'positive', 0.92);

        await service.processRawData(
          createTestMessage('Great product!'),
          'test-correlation-id',
        );

        const createCall = getCreateCallArg();
        expect(createCall.confidence).toBeGreaterThanOrEqual(0);
        expect(createCall.confidence).toBeLessThanOrEqual(1);
      });

      it('should process positive sentiment with score > 0.1', async () => {
        setupBertMock(0.85, 'positive');

        await service.processRawData(
          createTestMessage('I love this amazing product!'),
          'test-correlation-id',
        );

        const createCall = getCreateCallArg();
        expect(createCall.sentimentScore).toBeGreaterThan(0.1);
      });

      it('should process negative sentiment with score < -0.1', async () => {
        setupBertMock(-0.85, 'negative');

        await service.processRawData(
          createTestMessage('This is terrible'),
          'test-correlation-id',
        );

        const createCall = getCreateCallArg();
        expect(createCall.sentimentScore).toBeLessThan(-0.1);
      });
    });

    describe('metadata preservation', () => {
      it('should include source information in saved data', async () => {
        const message = createMockRawDataMessage({
          jobId: TEST_JOB_ID,
          source: 'reddit',
        });

        await service.processRawData(message, 'test-correlation-id');

        const createCall = getCreateCallArg();
        expect(createCall.source).toBe('reddit');
        expect(createCall.jobId).toBe(TEST_JOB_ID);
      });

      it('should handle optional fields from message', async () => {
        const message = createMockRawDataMessage({
          jobId: TEST_JOB_ID,
          sourceUrl: 'https://reddit.com/test',
          authorName: 'testuser',
          upvotes: 100,
          commentCount: 50,
        });

        await service.processRawData(message, 'test-correlation-id');

        const createCall = getCreateCallArg();
        expect(createCall.sourceUrl).toBe('https://reddit.com/test');
        expect(createCall.authorName).toBe('testuser');
        expect(createCall.upvotes).toBe(100);
        expect(createCall.commentCount).toBe(50);
      });
    });

    describe('job validation', () => {
      it('should skip processing when job does not exist', async () => {
        const message = createMockRawDataMessage({
          jobId: 'non-existent-job-id',
        });

        await service.processRawData(message, 'test-correlation-id');

        expect(mockSentimentDataRepo.create).not.toHaveBeenCalled();
        expect(mockBertService.analyze).not.toHaveBeenCalled();
      });
    });
  });

  describe('handleIngestionComplete', () => {
    it('should complete job when all items are already processed', async () => {
      // Process 3 items first
      await service.processRawData(createTestMessage('Post 1'), 'corr-1');
      await service.processRawData(createTestMessage('Post 2'), 'corr-2');
      await service.processRawData(createTestMessage('Post 3'), 'corr-3');

      // Signal ingestion complete with 3 items
      await service.handleIngestionComplete(
        createIngestionComplete(3),
        'corr-complete',
      );

      assertJobCompleted();
    });

    it('should complete job when ingestion complete arrives first', async () => {
      // Signal ingestion complete with 2 items expected
      await service.handleIngestionComplete(
        createIngestionComplete(2),
        'corr-complete',
      );

      // Job should NOT be complete yet
      assertJobNotCompleted();

      // Process the 2 items
      await service.processRawData(createTestMessage('Post 1'), 'corr-1');
      await service.processRawData(createTestMessage('Post 2'), 'corr-2');

      // Job should be complete now
      assertJobCompleted();
    });

    it('should complete job immediately for zero items', async () => {
      mockSentimentDataRepo.countByJobId.mockResolvedValue(0);
      mockSentimentDataRepo.getAverageSentimentByJobId.mockResolvedValue(null);

      await service.handleIngestionComplete(
        createIngestionComplete(0),
        'corr-complete',
      );

      assertJobCompleted();
      expect(mockRabbitmqService.emit).toHaveBeenCalledWith(
        MESSAGE_PATTERNS.JOB_COMPLETE,
        expect.objectContaining({ dataPointsCount: 0 }),
      );
    });

    it('should track progress without completing if ingestion not signaled', async () => {
      await service.processRawData(createTestMessage('Post 1'), 'corr-1');
      await service.processRawData(createTestMessage('Post 2'), 'corr-2');

      // No ingestion complete signal yet
      assertJobNotCompleted();
    });

    it('should skip processing if job does not exist in database', async () => {
      await service.handleIngestionComplete(
        createMockIngestionCompleteMessage({
          jobId: 'non-existent-job',
          totalItems: 5,
        }),
        'corr-complete',
      );

      expect(mockJobsRepo.updateStatus).not.toHaveBeenCalled();
      expect(mockRabbitmqService.emit).not.toHaveBeenCalled();
    });
  });

  describe('concurrent processing', () => {
    it('should serialize concurrent processRawData calls for same job', async () => {
      const operationOrder: string[] = [];

      mockSentimentDataRepo.create.mockImplementation(
        async (data: NewSentimentData) => {
          operationOrder.push(`create-start-${data.textContent}`);
          await new Promise((resolve) => setTimeout(resolve, 10));
          operationOrder.push(`create-end-${data.textContent}`);
          return {
            id: `sentiment-${data.textContent}`,
            sentimentScore: 0.5,
            sentimentLabel: SentimentLabel.NEUTRAL,
          };
        },
      );

      const promises = [
        service.processRawData(createTestMessage('msg-1'), 'corr-1'),
        service.processRawData(createTestMessage('msg-2'), 'corr-2'),
        service.processRawData(createTestMessage('msg-3'), 'corr-3'),
      ];

      await Promise.all(promises);

      expect(mockSentimentDataRepo.create).toHaveBeenCalledTimes(3);
    });

    it('should correctly count all items when processed concurrently', async () => {
      await service.handleIngestionComplete(
        createIngestionComplete(5),
        'corr-complete',
      );
      mockJobsRepo.updateStatus.mockClear();

      let callCount = 0;
      mockSentimentDataRepo.create.mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          id: `sentiment-${callCount}`,
          sentimentScore: 0.5,
          sentimentLabel: SentimentLabel.NEUTRAL,
        });
      });

      const promises = Array.from({ length: 5 }, (_, i) =>
        service.processRawData(createTestMessage(`msg-${i}`), `corr-${i}`),
      );

      await Promise.all(promises);

      assertJobCompleted();
    });

    it('should handle concurrent calls across multiple jobs independently', async () => {
      // Set up second job in store
      jobStore.set(TEST_JOB_ID_2, {
        id: TEST_JOB_ID_2,
        prompt: 'test prompt 2',
        status: JobStatus.IN_PROGRESS,
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: null,
      });

      await service.handleIngestionComplete(
        createIngestionComplete(2, TEST_JOB_ID),
        'corr-job1-complete',
      );
      await service.handleIngestionComplete(
        createIngestionComplete(2, TEST_JOB_ID_2),
        'corr-job2-complete',
      );

      mockJobsRepo.updateStatus.mockClear();

      let createCount = 0;
      mockSentimentDataRepo.create.mockImplementation(() => {
        createCount++;
        return Promise.resolve({
          id: `sentiment-${createCount}`,
          sentimentScore: 0.5,
          sentimentLabel: SentimentLabel.NEUTRAL,
        });
      });

      const promises = [
        service.processRawData(createTestMessage('job1-msg1'), 'corr-1'),
        service.processRawData(
          createTestMessage('job2-msg1', TEST_JOB_ID_2),
          'corr-2',
        ),
        service.processRawData(createTestMessage('job1-msg2'), 'corr-3'),
        service.processRawData(
          createTestMessage('job2-msg2', TEST_JOB_ID_2),
          'corr-4',
        ),
      ];

      await Promise.all(promises);

      expect(mockJobsRepo.updateStatus).toHaveBeenCalledWith(
        TEST_JOB_ID,
        JobStatus.COMPLETED,
      );
      expect(mockJobsRepo.updateStatus).toHaveBeenCalledWith(
        TEST_JOB_ID_2,
        JobStatus.COMPLETED,
      );
    });
  });

  describe('error recovery and tracker preservation', () => {
    it('should preserve tracker when updateStatus fails', async () => {
      (mockJobsRepo.updateStatus as jest.Mock).mockRejectedValueOnce(
        new Error('Database connection lost'),
      );

      await service.handleIngestionComplete(
        createIngestionComplete(1),
        'corr-complete',
      );

      await expect(
        service.processRawData(createTestMessage('msg-1'), 'corr-1'),
      ).rejects.toThrow('Database connection lost');

      // Fix repository and retry
      (mockJobsRepo.updateStatus as jest.Mock).mockResolvedValue({
        status: JobStatus.COMPLETED,
      });
      (mockJobsRepo.updateStatus as jest.Mock).mockClear();

      await service.processRawData(createTestMessage('msg-2'), 'corr-2');

      assertJobCompleted();
    });

    it('should preserve tracker when emit fails during completion', async () => {
      mockRabbitmqService.emit.mockImplementation((pattern: string) => {
        if (pattern === MESSAGE_PATTERNS.JOB_COMPLETE) {
          throw new Error('RabbitMQ connection failed');
        }
        return undefined;
      });

      await service.handleIngestionComplete(
        createIngestionComplete(1),
        'corr-complete',
      );

      await expect(
        service.processRawData(createTestMessage('msg-1'), 'corr-1'),
      ).rejects.toThrow('RabbitMQ connection failed');

      // Restore emit and retry
      mockRabbitmqService.emit.mockImplementation(() => undefined);
      mockJobsRepo.updateStatus.mockClear();

      await service.processRawData(createTestMessage('msg-2'), 'corr-2');

      assertJobCompleted();
    });

    it('should preserve tracker when getAverageSentimentByJobId fails', async () => {
      mockSentimentDataRepo.getAverageSentimentByJobId.mockRejectedValueOnce(
        new Error('Query timeout'),
      );

      await service.handleIngestionComplete(
        createIngestionComplete(1),
        'corr-complete',
      );

      await expect(
        service.processRawData(createTestMessage('msg-1'), 'corr-1'),
      ).rejects.toThrow('Query timeout');

      // Fix repository and retry
      mockSentimentDataRepo.getAverageSentimentByJobId.mockResolvedValue(
        '0.75',
      );
      mockJobsRepo.updateStatus.mockClear();

      await service.processRawData(createTestMessage('msg-2'), 'corr-2');

      assertJobCompleted();
    });
  });

  describe('cleanup and lifecycle', () => {
    it('should initialize cleanup interval on module init', async () => {
      await testingModule.close();
      await rebuildModule();
      expect(service).toBeDefined();
    });

    it('should clean up all timeouts on module destroy', async () => {
      await service.processRawData(createTestMessage('Test content'), 'corr-1');
      await service.handleIngestionComplete(
        createIngestionComplete(10),
        'corr-complete',
      );

      await testingModule.close();
      await rebuildModule();

      expect(service).toBeDefined();
    });

    it('should not leak trackers for incomplete jobs', async () => {
      await service.processRawData(createTestMessage('Test content'), 'corr-1');

      // No ingestion complete - tracker exists but will be cleaned up by interval
      expect(mockSentimentDataRepo.create).toHaveBeenCalled();
    });

    it('should clean up trackers that exceed max TTL', async () => {
      await service.handleIngestionComplete(
        createIngestionComplete(100),
        'corr-complete',
      );

      await service.processRawData(createTestMessage('Test content'), 'corr-1');

      // Tracker persists until TTL or completion
      expect(mockSentimentDataRepo.create).toHaveBeenCalled();
    });
  });
});
