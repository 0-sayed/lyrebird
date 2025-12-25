import { Test, TestingModule } from '@nestjs/testing';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';
import { RabbitmqService } from '@app/rabbitmq';

describe('IngestionController', () => {
  let ingestionController: IngestionController;

  beforeEach(async () => {
    const mockRabbitmqService = {
      emit: jest.fn(),
      getClient: jest.fn(),
    };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [IngestionController],
      providers: [
        IngestionService,
        {
          provide: RabbitmqService,
          useValue: mockRabbitmqService,
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
