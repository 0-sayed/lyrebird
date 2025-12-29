import {
  Controller,
  Sse,
  Param,
  Logger,
  MessageEvent,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  Observable,
  fromEvent,
  interval,
  filter,
  takeUntil,
  Subject,
} from 'rxjs';
import { JobsRepository } from '@app/database';
import { JobStatus } from '@app/shared-types';
import { JOB_EVENTS } from '../events';
import type { JobCompletedEvent, JobFailedEvent } from '../events';

@ApiTags('jobs')
@Controller('api/jobs')
export class JobSseController {
  private readonly logger = new Logger(JobSseController.name);

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly jobsRepository: JobsRepository,
  ) {}

  /**
   * SSE endpoint for real-time job status updates
   *
   * Client connects and receives updates until:
   * 1. Job completes (status: 'completed')
   * 2. Job fails (status: 'failed')
   * 3. Client disconnects
   *
   * @example
   * ```javascript
   * const eventSource = new EventSource('/api/jobs/123/events');
   * eventSource.onmessage = (event) => {
   *   const data = JSON.parse(event.data);
   *   console.log('Job update:', data);
   * };
   * eventSource.addEventListener('job.completed', (event) => {
   *   console.log('Job completed!', JSON.parse(event.data));
   *   eventSource.close();
   * });
   * ```
   */
  @Sse(':id/events')
  @ApiOperation({
    summary: 'Subscribe to real-time job status updates via SSE',
  })
  @ApiParam({ name: 'id', description: 'Job UUID' })
  @ApiResponse({ status: 200, description: 'SSE stream established' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  subscribeToJobEvents(
    @Param('id', ParseUUIDPipe) jobId: string,
  ): Observable<MessageEvent> {
    this.logger.log(`SSE connection requested for job: ${jobId}`);

    // Return an observable that handles job lookup and streaming
    return new Observable<MessageEvent>((subscriber) => {
      void this.initializeJobStream(jobId, subscriber);
    });
  }

  /**
   * Initialize the job stream - handles async job lookup and event subscription
   */
  private async initializeJobStream(
    jobId: string,
    subscriber: {
      next: (value: MessageEvent) => void;
      complete: () => void;
      error: (err: unknown) => void;
    },
  ): Promise<void> {
    try {
      // Verify job exists
      const job = await this.jobsRepository.findById(jobId);
      if (!job) {
        subscriber.next(
          this.createMessageEvent('job.error', {
            jobId,
            error: 'Job not found',
            timestamp: new Date().toISOString(),
          }),
        );
        subscriber.complete();
        return;
      }

      // If job is already complete or failed, send final status immediately
      if (
        job.status === (JobStatus.COMPLETED as string) ||
        job.status === (JobStatus.FAILED as string)
      ) {
        this.logger.log(
          `Job ${jobId} already in terminal state: ${job.status}`,
        );
        subscriber.next(
          this.createMessageEvent('job.status', {
            jobId,
            status: job.status,
            timestamp: new Date().toISOString(),
            message: `Job already ${job.status}`,
            final: true,
          }),
        );
        subscriber.complete();
        return;
      }

      // Send initial subscription confirmation
      subscriber.next(
        this.createMessageEvent('job.subscribed', {
          jobId,
          status: job.status,
          timestamp: new Date().toISOString(),
          message: 'Subscribed to job updates',
        }),
      );

      // Create destroy subject for cleanup
      const destroy$ = new Subject<void>();

      // Listen for completion events for this specific job
      fromEvent<JobCompletedEvent>(
        this.eventEmitter as unknown as NodeJS.EventEmitter,
        JOB_EVENTS.COMPLETED,
      )
        .pipe(
          filter((event) => event.jobId === jobId),
          takeUntil(destroy$),
        )
        .subscribe((event) => {
          subscriber.next(this.createMessageEvent('job.completed', event));
          subscriber.complete();
          destroy$.next();
          destroy$.complete();
        });

      // Listen for failure events for this specific job
      fromEvent<JobFailedEvent>(
        this.eventEmitter as unknown as NodeJS.EventEmitter,
        JOB_EVENTS.FAILED,
      )
        .pipe(
          filter((event) => event.jobId === jobId),
          takeUntil(destroy$),
        )
        .subscribe((event) => {
          subscriber.next(this.createMessageEvent('job.failed', event));
          subscriber.complete();
          destroy$.next();
          destroy$.complete();
        });

      // Heartbeat every 30 seconds to keep connection alive
      interval(30000)
        .pipe(takeUntil(destroy$))
        .subscribe(() => {
          subscriber.next(
            this.createMessageEvent('heartbeat', {
              jobId,
              timestamp: new Date().toISOString(),
              message: 'Connection alive',
            }),
          );
        });

      // Note: cleanup handled by takeUntil and the destroy$ subject
    } catch (error) {
      this.logger.error(
        `Error initializing SSE stream for job ${jobId}`,
        error,
      );
      subscriber.next(
        this.createMessageEvent('job.error', {
          jobId,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        }),
      );
      subscriber.complete();
    }
  }

  /**
   * Create a properly formatted SSE MessageEvent
   */
  private createMessageEvent(type: string, data: object): MessageEvent {
    return {
      type,
      data,
      id: Date.now().toString(),
      retry: 5000, // Reconnect after 5 seconds if disconnected
    };
  }
}
