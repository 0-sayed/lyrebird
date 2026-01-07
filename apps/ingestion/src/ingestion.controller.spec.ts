import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';
import { RabbitmqService } from '@app/rabbitmq';
import {
  PollingScraperService,
  PollingConfig,
} from './scrapers/polling-scraper.service';

describe('IngestionController', () => {
  let ingestionController: IngestionController;

  beforeEach(async () => {
    const mockRabbitmqService = {
      emit: jest.fn(),
      getClient: jest.fn(),
    };

    const mockPollingScraperService = {
      startPollingJob: jest.fn().mockImplementation((config: PollingConfig) => {
        config.onComplete();
        return Promise.resolve();
      }),
      stopPollingJob: jest.fn(),
      isJobActive: jest.fn().mockReturnValue(false),
      getActiveJobCount: jest.fn().mockReturnValue(0),
    };

    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string, defaultValue: number) => {
        if (key === 'BLUESKY_POLL_INTERVAL_MS') return 5000;
        if (key === 'BLUESKY_MAX_DURATION_MS') return 600000;
        return defaultValue;
      }),
    };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [IngestionController],
      providers: [
        IngestionService,
        {
          provide: RabbitmqService,
          useValue: mockRabbitmqService,
        },
        {
          provide: PollingScraperService,
          useValue: mockPollingScraperService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    ingestionController = app.get<IngestionController>(IngestionController);
  });

  describe('IngestionController', () => {
    it('should be defined', () => {
      expect(ingestionController).toBeDefined();
    });
  });
});
