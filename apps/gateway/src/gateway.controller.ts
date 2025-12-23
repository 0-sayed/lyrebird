import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { GatewayService } from './gateway.service';

interface StartJobDto {
  prompt: string;
}

@Controller('api/v1')
export class GatewayController {
  constructor(private readonly gatewayService: GatewayService) {}

  @Post('jobs')
  async startJob(@Body() body: StartJobDto) {
    return this.gatewayService.startJob(body.prompt);
  }

  @Get('jobs/:jobId')
  async getJobStatus(@Param('jobId') jobId: string) {
    return this.gatewayService.getJobStatus(jobId);
  }

  @Get('health')
  getHealth() {
    return { status: 'ok', service: 'gateway', timestamp: new Date() };
  }
}
