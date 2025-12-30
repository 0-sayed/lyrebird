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

      expect(mockRabbitmqService.emit).toHaveBeenCalledWith(
        MESSAGE_PATTERNS.JOB_RAW_DATA,
        expect.any(Object),
      );
    });

    it('should include job ID in raw data', async () => {
      const processPromise = service.processJob(
        mockMessage,
        'test-correlation',
      );
      jest.runAllTimers();
      await processPromise;

      expect(mockRabbitmqService.emit).toHaveBeenCalledWith(
        MESSAGE_PATTERNS.JOB_RAW_DATA,
        expect.objectContaining({
          jobId: mockMessage.jobId,
        }),
      );
    });

    it('should include prompt content in generated data', async () => {
      const processPromise = service.processJob(
        mockMessage,
        'test-correlation',
      );
      jest.runAllTimers();
      await processPromise;

      expect(mockRabbitmqService.emit).toHaveBeenCalledWith(
        MESSAGE_PATTERNS.JOB_RAW_DATA,
        expect.objectContaining({
          textContent: expect.stringContaining(
            mockMessage.prompt,
          ) as unknown as string,
        }),
      );
    });

    it('should include source information', async () => {
      const processPromise = service.processJob(
        mockMessage,
        'test-correlation',
      );
      jest.runAllTimers();
      await processPromise;

      expect(mockRabbitmqService.emit).toHaveBeenCalledWith(
        MESSAGE_PATTERNS.JOB_RAW_DATA,
        expect.objectContaining({
          source: 'reddit',
        }),
      );
    });

    it('should include timestamps in raw data', async () => {
      const processPromise = service.processJob(
        mockMessage,
        'test-correlation',
      );
      jest.runAllTimers();
      await processPromise;

      expect(mockRabbitmqService.emit).toHaveBeenCalledWith(
        MESSAGE_PATTERNS.JOB_RAW_DATA,
        expect.objectContaining({
          publishedAt: expect.any(Date) as unknown as Date,
          collectedAt: expect.any(Date) as unknown as Date,
        }),
      );
    });
  });
});
