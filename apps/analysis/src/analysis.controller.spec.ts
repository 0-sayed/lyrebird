import { Test, TestingModule } from '@nestjs/testing';
import { AnalysisController } from './analysis.controller';
import { AnalysisService } from './analysis.service';

describe('AnalysisController', () => {
  let analysisController: AnalysisController;

  beforeEach(async () => {
    const mockAnalysisService = {
      processRawData: jest.fn(),
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
  });
});
