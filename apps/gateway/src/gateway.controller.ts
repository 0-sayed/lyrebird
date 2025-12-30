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
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import type { Request } from 'express';
import { GatewayService } from './gateway.service';
import { SentimentDataRepository } from '@app/database';
import { CreateJobDto, JobResponseDto } from './dtos';

@ApiTags('jobs')
@Controller('api/jobs')
export class GatewayController {
  private readonly logger = new Logger(GatewayController.name);

  constructor(
    private readonly gatewayService: GatewayService,
    private readonly sentimentDataRepository: SentimentDataRepository,
  ) {}

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

  @Get(':id/results')
  @ApiOperation({ summary: 'Get job results with sentiment data' })
  @ApiParam({ name: 'id', description: 'Job UUID' })
  @ApiResponse({
    status: 200,
    description: 'Job results retrieved',
  })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async getJobResults(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ) {
    const correlationId = request.correlationId ?? 'unknown';

    this.logger.log(`[${correlationId}] Fetching results for job: ${id}`);

    const [job, sentimentData, avgSentiment, distribution] = await Promise.all([
      this.gatewayService.getJob(id),
      this.sentimentDataRepository.findByJobId(id),
      this.sentimentDataRepository.getAverageSentimentByJobId(id),
      this.sentimentDataRepository.getSentimentDistributionByJobId(id),
    ]);

    // Safe numeric conversion with NaN guard
    let parsedAvgSentiment: number | null = null;
    if (avgSentiment != null) {
      const parsed = parseFloat(avgSentiment);
      parsedAvgSentiment = isNaN(parsed) ? null : parsed;
    }

    // Guard against undefined sentimentData
    const dataArray = sentimentData ?? [];

    return {
      job,
      results: {
        averageSentiment: parsedAvgSentiment,
        totalDataPoints: dataArray.length,
        distribution: (distribution ?? []).map((d) => {
          const count = Number(d.count);
          return {
            label: d.label,
            count: Number.isFinite(count) ? count : 0,
          };
        }),
        data: dataArray.map((item) => ({
          id: item.id,
          textContent: item.textContent,
          sentimentLabel: item.sentimentLabel,
          sentimentScore: item.sentimentScore,
          source: item.source,
          analyzedAt: item.analyzedAt,
        })),
      },
    };
  }
}
