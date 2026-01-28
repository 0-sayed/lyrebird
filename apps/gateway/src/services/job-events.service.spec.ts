import { Test, TestingModule } from '@nestjs/testing';
import { JobEventsService } from './job-events.service';
import { JobsRepository } from '@app/database';
import { JobStatus } from '@app/shared-types';

describe('JobEventsService', () => {
  let service: JobEventsService;
  let mockJobsRepository: Partial<JobsRepository>;

  const mockJob = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    prompt: 'Test prompt',
    status: JobStatus.PENDING,
    searchStrategy: null,
    errorMessage: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: null,
  };

  beforeEach(async () => {
    mockJobsRepository = {
      findById: jest.fn().mockResolvedValue(mockJob),
      updateStatus: jest
        .fn()
        .mockResolvedValue({ ...mockJob, status: JobStatus.IN_PROGRESS }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobEventsService,
        { provide: JobsRepository, useValue: mockJobsRepository },
      ],
    }).compile();

    service = module.get<JobEventsService>(JobEventsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleInitialBatchComplete', () => {
    const correlationId = 'test-correlation-id';
    const message = {
      jobId: mockJob.id,
      initialBatchCount: 10,
      streamingActive: true,
      completedAt: new Date(),
    };

    it('should transition PENDING job to IN_PROGRESS', async () => {
      await service.handleInitialBatchComplete(message, correlationId);

      expect(mockJobsRepository.updateStatus).toHaveBeenCalledWith(
        mockJob.id,
        JobStatus.IN_PROGRESS,
      );
    });

    it('should NOT update status when job is COMPLETED', async () => {
      mockJobsRepository.findById = jest.fn().mockResolvedValue({
        ...mockJob,
        status: JobStatus.COMPLETED,
      });

      await service.handleInitialBatchComplete(message, correlationId);

      expect(mockJobsRepository.updateStatus).not.toHaveBeenCalled();
    });

    it('should NOT update status when job is FAILED', async () => {
      mockJobsRepository.findById = jest.fn().mockResolvedValue({
        ...mockJob,
        status: JobStatus.FAILED,
      });

      await service.handleInitialBatchComplete(message, correlationId);

      expect(mockJobsRepository.updateStatus).not.toHaveBeenCalled();
    });

    it('should NOT update status when job is already IN_PROGRESS', async () => {
      mockJobsRepository.findById = jest.fn().mockResolvedValue({
        ...mockJob,
        status: JobStatus.IN_PROGRESS,
      });

      await service.handleInitialBatchComplete(message, correlationId);

      expect(mockJobsRepository.updateStatus).not.toHaveBeenCalled();
    });

    it('should skip update when job not found', async () => {
      mockJobsRepository.findById = jest.fn().mockResolvedValue(null);

      await service.handleInitialBatchComplete(message, correlationId);

      expect(mockJobsRepository.updateStatus).not.toHaveBeenCalled();
    });
  });

  describe('handleJobFailed', () => {
    const correlationId = 'test-correlation-id';
    const message = {
      jobId: mockJob.id,
      status: JobStatus.FAILED as const,
      errorMessage: 'Test error',
      failedAt: new Date(),
    };

    it('should update job status to FAILED', async () => {
      await service.handleJobFailed(message, correlationId);

      expect(mockJobsRepository.updateStatus).toHaveBeenCalledWith(
        mockJob.id,
        JobStatus.FAILED,
      );
    });

    it('should skip update when job not found', async () => {
      mockJobsRepository.findById = jest.fn().mockResolvedValue(null);

      await service.handleJobFailed(message, correlationId);

      expect(mockJobsRepository.updateStatus).not.toHaveBeenCalled();
    });
  });

  describe('handleJobCompleted', () => {
    const correlationId = 'test-correlation-id';
    const message = {
      jobId: mockJob.id,
      status: JobStatus.COMPLETED as const,
      averageSentiment: 0.75,
      dataPointsCount: 100,
      completedAt: new Date(),
    };

    it('should log completion without updating status (Analysis service owns status)', async () => {
      mockJobsRepository.findById = jest.fn().mockResolvedValue({
        ...mockJob,
        status: JobStatus.COMPLETED,
      });

      await service.handleJobCompleted(message, correlationId);

      // Gateway validates but doesn't update - Analysis service owns status
      expect(mockJobsRepository.updateStatus).not.toHaveBeenCalled();
    });

    it('should skip when job not found', async () => {
      mockJobsRepository.findById = jest.fn().mockResolvedValue(null);

      await service.handleJobCompleted(message, correlationId);

      expect(mockJobsRepository.updateStatus).not.toHaveBeenCalled();
    });
  });
});
