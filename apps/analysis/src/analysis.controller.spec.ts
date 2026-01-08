import { Test, TestingModule } from '@nestjs/testing';
import { AnalysisController } from './analysis.controller';
import { AnalysisService } from './analysis.service';

describe('AnalysisController', () => {
  let analysisController: AnalysisController;
  let mockAnalysisService: {
    processRawData: jest.Mock;
    handleIngestionComplete: jest.Mock;
  };

  beforeEach(async () => {
    mockAnalysisService = {
      processRawData: jest.fn(),
      handleIngestionComplete: jest.fn(),
    };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AnalysisController],
      providers: [
        {
          provide: AnalysisService,
          useValue: mockAnalysisService,
        },
      ],
    }).compile();

    analysisController = app.get<AnalysisController>(AnalysisController);
  });

  describe('controller', () => {
    it('should be defined', () => {
      expect(analysisController).toBeDefined();
    });

    it('should have handleIngestionComplete method', () => {
      expect(typeof analysisController.handleIngestionComplete).toBe(
        'function',
      );
    });
  });
});
