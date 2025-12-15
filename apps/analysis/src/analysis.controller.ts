import { Controller, Get } from '@nestjs/common';
import { AnalysisService } from './analysis.service';

@Controller()
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  @Get()
  getHello(): string {
    return this.analysisService.getHello();
  }

  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      service: 'analysis',
      timestamp: new Date().toISOString(),
    };
  }
}
