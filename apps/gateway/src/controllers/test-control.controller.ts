import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JobStatus, SentimentLabel } from '@app/shared-types';
import { JobsRepository, SentimentDataRepository } from '@app/database';
import { JOB_EVENTS } from '../events';
import type {
  JobCompletedEvent,
  JobFailedEvent,
  JobDataUpdateEvent,
  JobStatusChangedEvent,
} from '../events';

/**
 * Test-only controller for triggering SSE events from Playwright
 * Only registered when NODE_ENV === 'test'
 */
@Controller('__test')
export class TestControlController {
  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly jobsRepository: JobsRepository,
    private readonly sentimentDataRepository: SentimentDataRepository,
  ) {}

  @Post('emit-status')
  @HttpCode(200)
  async emitStatus(
    @Body() body: { jobId: string; status: string; initialBatchCount?: number },
  ) {
    // Update job status in repository so it persists for subsequent fetches
    await this.jobsRepository.updateStatus(
      body.jobId,
      body.status as JobStatus,
    );

    const event: JobStatusChangedEvent = {
      jobId: body.jobId,
      status: body.status as JobStatus,
      initialBatchCount: body.initialBatchCount,
      streamingActive: true,
      timestamp: new Date(),
    };
    this.eventEmitter.emit(JOB_EVENTS.STATUS_CHANGED, event);
    return { success: true };
  }

  @Post('emit-data-update')
  @HttpCode(200)
  async emitDataUpdate(
    @Body() body: { jobId: string; score: number; totalProcessed?: number },
  ) {
    const id = crypto.randomUUID();
    const publishedAt = new Date();
    const sentimentLabel = this.scoreToLabel(body.score);

    // Persist to database so jobResults query returns data
    await this.sentimentDataRepository.create({
      id,
      jobId: body.jobId,
      source: 'bluesky',
      sourceUrl: `https://bsky.app/test/${id}`,
      textContent: 'Test post',
      sentimentScore: body.score,
      sentimentLabel,
      publishedAt,
    });

    const event: JobDataUpdateEvent = {
      jobId: body.jobId,
      dataPoint: {
        id,
        sentimentScore: body.score,
        sentimentLabel,
        textContent: 'Test post',
        publishedAt,
        source: 'bluesky',
      },
      totalProcessed: body.totalProcessed ?? 1,
      timestamp: new Date(),
    };
    this.eventEmitter.emit(JOB_EVENTS.DATA_UPDATE, event);
    return { success: true };
  }

  @Post('emit-completed')
  @HttpCode(200)
  async emitCompleted(
    @Body()
    body: {
      jobId: string;
      averageSentiment?: number;
      totalDataPoints?: number;
    },
  ) {
    // Update job status in repository so it persists for subsequent fetches
    await this.jobsRepository.updateStatus(body.jobId, JobStatus.COMPLETED);

    const event: JobCompletedEvent = {
      jobId: body.jobId,
      status: JobStatus.COMPLETED,
      averageSentiment: body.averageSentiment ?? 0.5,
      dataPointsCount: body.totalDataPoints ?? 10,
      timestamp: new Date(),
    };
    this.eventEmitter.emit(JOB_EVENTS.COMPLETED, event);
    return { success: true };
  }

  @Post('emit-failed')
  @HttpCode(200)
  async emitFailed(@Body() body: { jobId: string; error: string }) {
    // Update job status in repository so it persists for subsequent fetches
    await this.jobsRepository.updateStatus(body.jobId, JobStatus.FAILED);

    const event: JobFailedEvent = {
      jobId: body.jobId,
      status: JobStatus.FAILED,
      errorMessage: body.error,
      timestamp: new Date(),
    };
    this.eventEmitter.emit(JOB_EVENTS.FAILED, event);
    return { success: true };
  }

  /**
   * Convert sentiment score to label
   */
  private scoreToLabel(score: number): SentimentLabel {
    if (score < -0.3) return SentimentLabel.NEGATIVE;
    if (score > 0.3) return SentimentLabel.POSITIVE;
    return SentimentLabel.NEUTRAL;
  }
}
