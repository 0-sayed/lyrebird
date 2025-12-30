import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { JobsRepository, Job, SentimentDataRepository } from '@app/database';
import { RabbitmqService } from '@app/rabbitmq';
import {
  MESSAGE_PATTERNS,
  StartJobMessage,
  JobStatus,
} from '@app/shared-types';
import { CreateJobDto, JobResponseDto } from './dtos';

@Injectable()
export class GatewayService {
  private readonly logger = new Logger(GatewayService.name);

  constructor(
    private jobsRepository: JobsRepository,
    private rabbitmqService: RabbitmqService,
    private sentimentDataRepository: SentimentDataRepository,
  ) {}

  /**
   * Create a new sentiment analysis job
   */
  async createJob(
    createJobDto: CreateJobDto,
    correlationId: string,
  ): Promise<JobResponseDto> {
    try {
      this.logger.log(
        `[${correlationId}] Creating job for prompt: ${createJobDto.prompt}`,
      );

      // 1. Create job in database
      const job = await this.jobsRepository.create({
        prompt: createJobDto.prompt,
        status: JobStatus.PENDING,
      });

      this.logger.log(`[${correlationId}] Job created: ${job.id}`);

      // 2. Publish message to start ingestion
      const message: StartJobMessage = {
        jobId: job.id,
        prompt: job.prompt,
        timestamp: new Date(),
      };

      this.rabbitmqService.emit(MESSAGE_PATTERNS.JOB_START, message);

      this.logger.log(
        `[${correlationId}] Message published: ${MESSAGE_PATTERNS.JOB_START}`,
      );

      // 3. Return job info to client
      return this.toJobResponseDto(job);
    } catch (error) {
      this.logger.error(
        `[${correlationId}] Failed to create job`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: string): Promise<JobResponseDto> {
    const job = await this.jobsRepository.findById(jobId);

    if (!job) {
      throw new NotFoundException(`Job with ID ${jobId} not found`);
    }

    return await this.toJobResponseDto(job);
  }

  /**
   * List all jobs
   */
  async listJobs(): Promise<JobResponseDto[]> {
    const jobs = await this.jobsRepository.findAll();

    return Promise.all(jobs.map((job) => this.toJobResponseDto(job)));
  }

  private async toJobResponseDto(job: Job): Promise<JobResponseDto> {
    // Fetch sentiment metrics from sentiment_data table
    const [dataPointsCount, avgSentimentStr] = await Promise.all([
      this.sentimentDataRepository.countByJobId(job.id),
      this.sentimentDataRepository.getAverageSentimentByJobId(job.id),
    ]);

    // Convert average sentiment string to number (Drizzle ORM returns string for avg())
    const averageSentiment = avgSentimentStr
      ? parseFloat(avgSentimentStr)
      : undefined;

    return {
      jobId: job.id,
      status: job.status,
      prompt: job.prompt,
      createdAt: job.createdAt,
      averageSentiment,
      dataPointsCount: dataPointsCount > 0 ? dataPointsCount : undefined,
      completedAt: job.completedAt ?? undefined,
    };
  }
}
