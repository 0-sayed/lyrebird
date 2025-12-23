import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { JobsRepository } from '@app/database';
import { RabbitmqService } from '@app/rabbitmq';
import {
  MESSAGE_PATTERNS,
  StartJobMessage,
  JobStatus,
} from '@app/shared-types';

@Injectable()
export class GatewayService {
  private readonly logger = new Logger(GatewayService.name);

  constructor(
    private jobsRepository: JobsRepository,
    private rabbitmqService: RabbitmqService,
  ) {}

  /**
   * Start a new sentiment analysis job
   */
  async startJob(prompt: string) {
    try {
      this.logger.log(`Starting job for prompt: ${prompt}`);

      // 1. Create job in database
      const job = await this.jobsRepository.create({
        prompt,
        status: JobStatus.PENDING,
      });

      this.logger.log(`Job created: ${job.id}`);

      // 2. Publish message to start ingestion
      const message: StartJobMessage = {
        jobId: job.id,
        prompt: job.prompt,
        timestamp: new Date(),
      };

      this.rabbitmqService.emit(MESSAGE_PATTERNS.JOB_START, message);

      this.logger.log(`Message published: ${MESSAGE_PATTERNS.JOB_START}`);

      // 3. Return job info to client
      return {
        jobId: job.id,
        status: job.status,
        prompt: job.prompt,
        createdAt: job.createdAt,
      };
    } catch (error) {
      this.logger.error(
        'Failed to start job',
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string) {
    const job = await this.jobsRepository.findById(jobId);

    if (!job) {
      throw new NotFoundException(`Job not found: ${jobId}`);
    }

    return job;
  }
}
