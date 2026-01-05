import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { IngestionService } from './ingestion.service';
import { RabbitmqService } from '@app/rabbitmq';
import {
  PollingScraperService,
  PollingConfig,
} from './scrapers/polling-scraper.service';
import {
  StartJobMessage,
  MESSAGE_PATTERNS,
  RawDataMessage,
} from '@app/shared-types';

describe('IngestionService', () => {
  let service: IngestionService;
  let mockRabbitmqService: { emit: jest.Mock };
  let mockPollingScraperService: {
    startPollingJob: jest.Mock;
    stopPollingJob: jest.Mock;
    isJobActive: jest.Mock;
    getActiveJobCount: jest.Mock;
  };
  let mockConfigService: { get: jest.Mock };

  const mockRawDataMessages: RawDataMessage[] = [
    {
      jobId: '123e4567-e89b-12d3-a456-426614174000',
      textContent: 'I love this product! Great quality.',
      source: 'bluesky',
      sourceUrl: 'https://bsky.app/profile/user1.bsky.social/post/abc123',
      authorName: 'Test User 1',
      upvotes: 10,
      commentCount: 2,
      publishedAt: new Date('2024-01-15T12:00:00.000Z'),
      collectedAt: new Date('2024-01-15T12:01:00.000Z'),
    },
    {
      jobId: '123e4567-e89b-12d3-a456-426614174000',
      textContent: 'This product is okay, nothing special.',
      source: 'bluesky',
      sourceUrl: 'https://bsky.app/profile/user2.bsky.social/post/def456',
      authorName: 'Test User 2',
      upvotes: 5,
      commentCount: 1,
      publishedAt: new Date('2024-01-15T11:00:00.000Z'),
      collectedAt: new Date('2024-01-15T12:01:00.000Z'),
    },
    {
      jobId: '123e4567-e89b-12d3-a456-426614174000',
      textContent: 'Terrible experience, would not recommend.',
      source: 'bluesky',
      sourceUrl: 'https://bsky.app/profile/user3.bsky.social/post/ghi789',
      authorName: 'Test User 3',
      upvotes: 20,
      commentCount: 15,
      publishedAt: new Date('2024-01-15T10:00:00.000Z'),
      collectedAt: new Date('2024-01-15T12:01:00.000Z'),
    },
  ];

  beforeEach(async () => {
    mockRabbitmqService = {
      emit: jest.fn(),
    };

    mockPollingScraperService = {
      startPollingJob: jest
        .fn()
        .mockImplementation(async (config: PollingConfig) => {
          // Simulate immediate data emission and completion
          for (const data of mockRawDataMessages) {
            await config.onData(data);
          }
          config.onComplete();
        }),
      stopPollingJob: jest.fn(),
      isJobActive: jest.fn().mockReturnValue(false),
      getActiveJobCount: jest.fn().mockReturnValue(0),
    };

    mockConfigService = {
      get: jest.fn().mockImplementation((key: string, defaultValue: number) => {
        if (key === 'BLUESKY_POLL_INTERVAL_MS') return 5000;
        if (key === 'BLUESKY_MAX_DURATION_MS') return 600000;
        return defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IngestionService,
        { provide: RabbitmqService, useValue: mockRabbitmqService },
        { provide: PollingScraperService, useValue: mockPollingScraperService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<IngestionService>(IngestionService);
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

    it('should call PollingScraperService.startPollingJob with correct parameters', async () => {
      await service.processJob(mockMessage, 'test-correlation');

      expect(mockPollingScraperService.startPollingJob).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: mockMessage.jobId,
          prompt: mockMessage.prompt,
          correlationId: 'test-correlation',
          pollIntervalMs: 5000,
          maxDurationMs: 600000,
        }),
      );
    });

    it('should emit raw data messages to RabbitMQ via onData callback', async () => {
      await service.processJob(mockMessage, 'test-correlation');

      expect(mockRabbitmqService.emit).toHaveBeenCalledTimes(3);
    });

    it('should emit to correct message pattern', async () => {
      await service.processJob(mockMessage, 'test-correlation');

      expect(mockRabbitmqService.emit).toHaveBeenCalledWith(
        MESSAGE_PATTERNS.JOB_RAW_DATA,
        expect.any(Object),
      );
    });

    it('should include job ID in raw data', async () => {
      await service.processJob(mockMessage, 'test-correlation');

      expect(mockRabbitmqService.emit).toHaveBeenCalledWith(
        MESSAGE_PATTERNS.JOB_RAW_DATA,
        expect.objectContaining({
          jobId: mockMessage.jobId,
        }),
      );
    });

    it('should include source as bluesky', async () => {
      await service.processJob(mockMessage, 'test-correlation');

      expect(mockRabbitmqService.emit).toHaveBeenCalledWith(
        MESSAGE_PATTERNS.JOB_RAW_DATA,
        expect.objectContaining({
          source: 'bluesky',
        }),
      );
    });

    it('should include timestamps in raw data', async () => {
      await service.processJob(mockMessage, 'test-correlation');

      expect(mockRabbitmqService.emit).toHaveBeenCalledWith(
        MESSAGE_PATTERNS.JOB_RAW_DATA,
        expect.objectContaining({
          publishedAt: expect.any(Date) as Date,
          collectedAt: expect.any(Date) as Date,
        }),
      );
    });

    it('should handle empty results gracefully', async () => {
      mockPollingScraperService.startPollingJob.mockImplementation(
        (config: PollingConfig) => {
          // No data - just complete immediately
          config.onComplete();
          return Promise.resolve();
        },
      );

      await service.processJob(mockMessage, 'test-correlation');

      expect(mockRabbitmqService.emit).not.toHaveBeenCalled();
    });

    it('should propagate errors from polling scraper', async () => {
      mockPollingScraperService.startPollingJob.mockRejectedValue(
        new Error('API error'),
      );

      await expect(
        service.processJob(mockMessage, 'test-correlation'),
      ).rejects.toThrow('API error');
    });

    it('should use polling options from message when provided', async () => {
      const messageWithOptions: StartJobMessage = {
        ...mockMessage,
        options: {
          polling: {
            enabled: true,
            pollIntervalMs: 10000,
            maxDurationMs: 300000,
          },
        },
      };

      await service.processJob(messageWithOptions, 'test-correlation');

      expect(mockPollingScraperService.startPollingJob).toHaveBeenCalledWith(
        expect.objectContaining({
          pollIntervalMs: 10000,
          maxDurationMs: 300000,
        }),
      );
    });

    it('should use default polling options when not provided in message', async () => {
      await service.processJob(mockMessage, 'test-correlation');

      expect(mockPollingScraperService.startPollingJob).toHaveBeenCalledWith(
        expect.objectContaining({
          pollIntervalMs: 5000,
          maxDurationMs: 600000,
        }),
      );
    });
  });

  describe('stopJob', () => {
    it('should call stopPollingJob on the scraper', () => {
      service.stopJob('job-123');

      expect(mockPollingScraperService.stopPollingJob).toHaveBeenCalledWith(
        'job-123',
      );
    });
  });

  describe('isJobActive', () => {
    it('should return true when job is active', () => {
      mockPollingScraperService.isJobActive.mockReturnValue(true);

      expect(service.isJobActive('job-123')).toBe(true);
      expect(mockPollingScraperService.isJobActive).toHaveBeenCalledWith(
        'job-123',
      );
    });

    it('should return false when job is not active', () => {
      mockPollingScraperService.isJobActive.mockReturnValue(false);

      expect(service.isJobActive('job-123')).toBe(false);
    });
  });

  describe('getActiveJobCount', () => {
    it('should return the count of active jobs', () => {
      mockPollingScraperService.getActiveJobCount.mockReturnValue(5);

      expect(service.getActiveJobCount()).toBe(5);
      expect(mockPollingScraperService.getActiveJobCount).toHaveBeenCalled();
    });
  });
});
