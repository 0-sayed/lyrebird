import { Test, TestingModule } from '@nestjs/testing';
import { IngestionService } from './ingestion.service';
import { RabbitmqService } from '@app/rabbitmq';
import { StartJobMessage, MESSAGE_PATTERNS } from '@app/shared-types';

describe('IngestionService', () => {
  let service: IngestionService;
  let mockRabbitmqService: Partial<RabbitmqService>;

  beforeEach(async () => {
    mockRabbitmqService = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IngestionService,
        { provide: RabbitmqService, useValue: mockRabbitmqService },
      ],
    }).compile();

    service = module.get<IngestionService>(IngestionService);

    // Speed up tests by mocking setTimeout
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processJob', () => {
    const mockMessage: StartJobMessage = {
      jobId: '123e4567-e89b-12d3-a456-426614174000',
      prompt: 'Test product',
      timestamp: new Date(),
    };

    it('should emit raw data messages to RabbitMQ', async () => {
      const processPromise = service.processJob(
        mockMessage,
        'test-correlation',
      );

      // Fast-forward timers to skip the simulated API latency
      jest.runAllTimers();

      await processPromise;

      // Should emit 3 hardcoded data items
      expect(mockRabbitmqService.emit).toHaveBeenCalledTimes(3);
    });

    it('should emit to correct message pattern', async () => {
      const processPromise = service.processJob(
        mockMessage,
        'test-correlation',
      );
      jest.runAllTimers();
      await processPromise;

      const emitMock = mockRabbitmqService.emit as jest.Mock<
        void,
        [string, unknown]
      >;
      const calls = emitMock.mock.calls as [[string, unknown]];
      expect(calls[0][0]).toBe(MESSAGE_PATTERNS.JOB_RAW_DATA);
    });

    it('should include job ID in raw data', async () => {
      const processPromise = service.processJob(
        mockMessage,
        'test-correlation',
      );
      jest.runAllTimers();
      await processPromise;

      const emitMock = mockRabbitmqService.emit as jest.Mock<
        void,
        [string, { jobId: string }]
      >;
      const calls = emitMock.mock.calls as [[string, { jobId: string }]];
      expect(calls[0][1].jobId).toBe(mockMessage.jobId);
    });

    it('should include prompt content in generated data', async () => {
      const processPromise = service.processJob(
        mockMessage,
        'test-correlation',
      );
      jest.runAllTimers();
      await processPromise;

      const emitMock = mockRabbitmqService.emit as jest.Mock<
        void,
        [string, { textContent: string }]
      >;
      const calls = emitMock.mock.calls as [[string, { textContent: string }]];
      expect(calls[0][1].textContent).toContain(mockMessage.prompt);
    });

    it('should include source information', async () => {
      const processPromise = service.processJob(
        mockMessage,
        'test-correlation',
      );
      jest.runAllTimers();
      await processPromise;

      const emitMock = mockRabbitmqService.emit as jest.Mock<
        void,
        [string, { source: string }]
      >;
      const calls = emitMock.mock.calls as [[string, { source: string }]];
      expect(calls[0][1].source).toBe('reddit');
    });

    it('should include timestamps in raw data', async () => {
      const processPromise = service.processJob(
        mockMessage,
        'test-correlation',
      );
      jest.runAllTimers();
      await processPromise;

      const emitMock = mockRabbitmqService.emit as jest.Mock<
        void,
        [string, { publishedAt: Date; collectedAt: Date }]
      >;
      const calls = emitMock.mock.calls as [
        [string, { publishedAt: Date; collectedAt: Date }],
      ];
      expect(calls[0][1].publishedAt).toBeInstanceOf(Date);
      expect(calls[0][1].collectedAt).toBeInstanceOf(Date);
    });
  });
});
