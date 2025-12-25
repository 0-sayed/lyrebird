import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Logger,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Request } from 'express';
import { GatewayService } from './gateway.service';
import { CreateJobDto, JobResponseDto } from './dtos';

@ApiTags('jobs')
@Controller('api/jobs')
export class GatewayController {
  private readonly logger = new Logger(GatewayController.name);

  constructor(private readonly gatewayService: GatewayService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new sentiment analysis job' })
  @ApiResponse({
    status: 201,
    description: 'Job created successfully',
    type: JobResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async createJob(
    @Body() createJobDto: CreateJobDto,
    @Req() request: Request,
  ): Promise<JobResponseDto> {
    const correlationId = request.correlationId ?? 'unknown';

    this.logger.log(
      `[${correlationId}] Creating job with prompt: "${createJobDto.prompt}"`,
    );

    const job = await this.gatewayService.createJob(
      createJobDto,
      correlationId,
    );

    return job;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get job status and results' })
  @ApiResponse({
    status: 200,
    description: 'Job found',
    type: JobResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async getJob(
    @Param('id') id: string,
    @Req() request: Request,
  ): Promise<JobResponseDto> {
    const correlationId = request.correlationId ?? 'unknown';

    this.logger.log(`[${correlationId}] Fetching job: ${id}`);

    return this.gatewayService.getJob(id);
  }

  @Get()
  @ApiOperation({ summary: 'List all jobs' })
  @ApiResponse({
    status: 200,
    description: 'Jobs retrieved',
    type: [JobResponseDto],
  })
  async listJobs(@Req() request: Request): Promise<JobResponseDto[]> {
    const correlationId = request.correlationId ?? 'unknown';

    this.logger.log(`[${correlationId}] Listing all jobs`);

    return this.gatewayService.listJobs();
  }
}
