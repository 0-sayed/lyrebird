import { Test, TestingModule } from '@nestjs/testing';
import { AnalysisController } from './analysis.controller';
import { AnalysisService } from './analysis.service';

describe('AnalysisController', () => {
  let analysisController: AnalysisController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AnalysisController],
      providers: [AnalysisService],
    }).compile();

    analysisController = app.get<AnalysisController>(AnalysisController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(analysisController.getHello()).toBe('Hello World!');
    });
  });
});
