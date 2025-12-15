import { Controller, Get } from '@nestjs/common';
import { IngestionService } from './ingestion.service';

@Controller()
export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) {}

  @Get()
  getHello(): string {
    return this.ingestionService.getHello();
  }

  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      service: 'ingestion',
      timestamp: new Date().toISOString(),
    };
  }
}
