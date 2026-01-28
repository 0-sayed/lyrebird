import { Test, TestingModule } from '@nestjs/testing';
import { JetstreamManagerService } from './jetstream-manager.service';
import { JobRegistryService, RegisterJobConfig } from './job-registry.service';
import { KeywordFilterService } from './keyword-filter.service';
import { JetstreamClientService } from '@app/bluesky';
import {
  createMockJetstreamClientService,
  createMockJobRegistryService,
  createMockKeywordFilterService,
  JetstreamFactory,
} from '@app/testing';

describe('JetstreamManagerService', () => {
  let service: JetstreamManagerService;
  let jetstreamClient: ReturnType<typeof createMockJetstreamClientService>;
  let jobRegistry: ReturnType<typeof createMockJobRegistryService>;
  let keywordFilter: ReturnType<typeof createMockKeywordFilterService>;

  /** Helper to create base job config */
  const createJobConfig = (
    overrides: Partial<{
      jobId: string;
      prompt: string;
      correlationId: string;
      maxDurationMs: number;
      onData: jest.Mock;
      onComplete: jest.Mock;
    }> = {},
  ) => ({
    jobId: overrides.jobId ?? 'test-job-1',
    prompt: overrides.prompt ?? 'test prompt',
    correlationId: overrides.correlationId ?? 'corr-123',
    maxDurationMs: overrides.maxDurationMs ?? 120000,
    onData: overrides.onData ?? jest.fn().mockResolvedValue(undefined),
    onComplete: overrides.onComplete ?? jest.fn(),
  });

  /** Helper to wait for async operations */
  const flushPromises = (): Promise<void> =>
    new Promise((resolve) => setImmediate(resolve));

  beforeEach(async () => {
    // Reset factory counter for test isolation
    JetstreamFactory.reset();

    // Create mocks
    jetstreamClient = createMockJetstreamClientService();
    jobRegistry = createMockJobRegistryService();
    keywordFilter = createMockKeywordFilterService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JetstreamManagerService,
        { provide: JetstreamClientService, useValue: jetstreamClient },
        { provide: JobRegistryService, useValue: jobRegistry },
        { provide: KeywordFilterService, useValue: keywordFilter },
      ],
    }).compile();

    service = module.get<JetstreamManagerService>(JetstreamManagerService);
  });

  afterEach(() => {
    // Clean up any intervals/subscriptions
    service.onModuleDestroy();
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should not be listening initially', () => {
      expect(service.isCurrentlyListening()).toBe(false);
    });

    it('should set up status monitoring on module init', () => {
      service.onModuleInit();

      // Should have subscribed to status$
      expect(jetstreamClient._statusSubject.observed).toBe(true);
    });
  });

  describe('registerJob', () => {
    it('should register job with JobRegistryService', async () => {
      const config = createJobConfig();

      await service.registerJob(config);

      expect(jobRegistry.registerJob).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: config.jobId,
          prompt: config.prompt,
          correlationId: config.correlationId,
          maxDurationMs: config.maxDurationMs,
          onData: config.onData,
        }),
      );
    });

    it('should start listening on first job registration', async () => {
      const config = createJobConfig();

      await service.registerJob(config);

      expect(service.isCurrentlyListening()).toBe(true);
      expect(jetstreamClient.connect).toHaveBeenCalled();
    });

    it('should not reconnect when registering additional jobs', async () => {
      // First job starts connection
      await service.registerJob(createJobConfig({ jobId: 'job-1' }));
      expect(jetstreamClient.connect).toHaveBeenCalledTimes(1);

      // Second job should not trigger another connect
      await service.registerJob(createJobConfig({ jobId: 'job-2' }));
      expect(jetstreamClient.connect).toHaveBeenCalledTimes(1);
    });

    it('should subscribe to post stream when starting to listen', async () => {
      await service.registerJob(createJobConfig());

      expect(jetstreamClient._postsSubject.observed).toBe(true);
    });

    it('should process incoming posts through KeywordFilterService', async () => {
      await service.registerJob(createJobConfig());

      // Emit a post
      const post = JetstreamFactory.createPostEvent({ text: 'test content' });
      jetstreamClient._emitPost(post);

      await flushPromises();

      expect(keywordFilter.processPost).toHaveBeenCalledWith(post);
    });

    it('should handle connection failure gracefully', async () => {
      jetstreamClient.connect.mockRejectedValueOnce(
        new Error('Connection failed'),
      );

      await expect(service.registerJob(createJobConfig())).rejects.toThrow(
        'Connection failed',
      );

      // Should have cleaned up
      expect(service.isCurrentlyListening()).toBe(false);
    });

    describe('concurrent job registration', () => {
      it.each([2, 3, 5])(
        'should handle %d concurrent jobs with single connection',
        async (jobCount) => {
          for (let i = 0; i < jobCount; i++) {
            await service.registerJob(createJobConfig({ jobId: `job-${i}` }));
          }

          // Should have connected only once
          expect(jetstreamClient.connect).toHaveBeenCalledTimes(1);
          expect(service.isCurrentlyListening()).toBe(true);
        },
      );

      it('should register all jobs with unique configs', async () => {
        const configs = [
          createJobConfig({ jobId: 'job-a', prompt: 'prompt A' }),
          createJobConfig({ jobId: 'job-b', prompt: 'prompt B' }),
          createJobConfig({ jobId: 'job-c', prompt: 'prompt C' }),
        ];

        for (const config of configs) {
          await service.registerJob(config);
        }

        expect(jobRegistry.registerJob).toHaveBeenCalledTimes(3);
        expect(jobRegistry.registerJob).toHaveBeenCalledWith(
          expect.objectContaining({ jobId: 'job-a', prompt: 'prompt A' }),
        );
        expect(jobRegistry.registerJob).toHaveBeenCalledWith(
          expect.objectContaining({ jobId: 'job-b', prompt: 'prompt B' }),
        );
        expect(jobRegistry.registerJob).toHaveBeenCalledWith(
          expect.objectContaining({ jobId: 'job-c', prompt: 'prompt C' }),
        );
      });
    });
  });

  describe('completeJob', () => {
    beforeEach(async () => {
      // Register a job first
      await service.registerJob(createJobConfig({ jobId: 'test-job' }));
    });

    it('should delegate to JobRegistryService.completeJob', () => {
      // Mock getJob to return a job
      const mockJob = {
        jobId: 'test-job',
        correlationId: 'corr-123',
        matchedCount: 5,
      };
      jobRegistry.getJob.mockReturnValue(mockJob);

      service.completeJob('test-job');

      expect(jobRegistry.completeJob).toHaveBeenCalledWith('test-job');
    });

    it('should log warning when job not found', () => {
      jobRegistry.getJob.mockReturnValue(undefined);

      // Should not throw
      service.completeJob('nonexistent-job');

      expect(jobRegistry.completeJob).not.toHaveBeenCalled();
    });

    it('should stop listening when last job completes', async () => {
      const onComplete = jest.fn();
      const config = createJobConfig({ jobId: 'last-job', onComplete });

      // Capture the wrapped onComplete callback
      let wrappedOnComplete: (count: number) => void = () => {};
      jobRegistry.registerJob.mockImplementation((cfg: RegisterJobConfig) => {
        wrappedOnComplete = cfg.onComplete;
      });

      await service.registerJob(config);

      // Mock no active jobs after completion
      jobRegistry.hasActiveJobs.mockReturnValue(false);

      // Simulate job completion via the wrapped callback
      wrappedOnComplete(10);

      // Should have stopped listening
      expect(service.isCurrentlyListening()).toBe(false);
      expect(jetstreamClient.disconnect).toHaveBeenCalled();
      expect(onComplete).toHaveBeenCalledWith(10);
    });

    it('should keep listening when other jobs remain active', async () => {
      // Register two jobs
      await service.registerJob(createJobConfig({ jobId: 'job-1' }));
      await service.registerJob(createJobConfig({ jobId: 'job-2' }));

      // Mock job-1 exists
      jobRegistry.getJob.mockReturnValue({
        jobId: 'job-1',
        correlationId: 'corr-1',
      });

      // Mock that there are still active jobs
      jobRegistry.hasActiveJobs.mockReturnValue(true);

      service.completeJob('job-1');

      // Should still be listening
      expect(service.isCurrentlyListening()).toBe(true);
    });
  });

  describe('cancelJob', () => {
    beforeEach(async () => {
      await service.registerJob(createJobConfig({ jobId: 'test-job' }));
    });

    it('should unregister job without triggering completion callback', () => {
      const mockJob = {
        jobId: 'test-job',
        correlationId: 'corr-123',
      };
      jobRegistry.getJob.mockReturnValue(mockJob);

      service.cancelJob('test-job');

      expect(jobRegistry.unregisterJob).toHaveBeenCalledWith('test-job');
      // Should NOT call completeJob
      expect(jobRegistry.completeJob).not.toHaveBeenCalled();
    });

    it('should stop listening when last job is cancelled', () => {
      const mockJob = {
        jobId: 'test-job',
        correlationId: 'corr-123',
      };
      jobRegistry.getJob.mockReturnValue(mockJob);
      jobRegistry.hasActiveJobs.mockReturnValue(false);

      service.cancelJob('test-job');

      expect(service.isCurrentlyListening()).toBe(false);
    });

    it('should log warning when cancelling nonexistent job', () => {
      jobRegistry.getJob.mockReturnValue(undefined);

      // Should not throw
      service.cancelJob('nonexistent');

      expect(jobRegistry.unregisterJob).not.toHaveBeenCalled();
    });
  });

  describe('getStatus', () => {
    it('should return current manager status', async () => {
      await service.registerJob(createJobConfig());

      jobRegistry.getActiveJobCount.mockReturnValue(1);
      jetstreamClient.getConnectionStatus.mockReturnValue('connected');
      jetstreamClient.getMetrics.mockReturnValue({
        messagesReceived: 100,
        messagesPerSecond: 50,
        postsProcessed: 80,
        connectionStatus: 'connected',
        reconnectAttempts: 0,
      });

      const status = service.getStatus();

      expect(status.isListening).toBe(true);
      expect(status.connectionStatus).toBe('connected');
      expect(status.activeJobCount).toBe(1);
      expect(status.metrics.messagesReceived).toBe(100);
      expect(status.metrics.messagesPerSecond).toBe(50);
    });
  });

  describe('getStats', () => {
    it('should return processing statistics', async () => {
      await service.registerJob(createJobConfig());

      // Mock some stats
      jobRegistry.getActiveJobCount.mockReturnValue(2);
      keywordFilter.getMatchStats.mockReturnValue({
        totalJobs: 2,
        totalMatched: 50,
        jobStats: [
          { jobId: 'job-1', matchedCount: 30 },
          { jobId: 'job-2', matchedCount: 20 },
        ],
      });

      const stats = service.getStats();

      expect(stats.totalPostsProcessed).toBe(0);
      expect(stats.totalPostsMatched).toBe(0);
      expect(stats.activeJobs).toBe(2);
      expect(stats.matchStats.totalJobs).toBe(2);
      expect(stats.matchStats.totalMatched).toBe(50);
    });
  });

  describe('post processing', () => {
    it('should increment totalPostsProcessed for each post', async () => {
      await service.registerJob(createJobConfig());

      // Emit multiple posts
      const posts = JetstreamFactory.createPostEvents(5);
      for (const post of posts) {
        jetstreamClient._emitPost(post);
      }

      await flushPromises();

      const stats = service.getStats();
      expect(stats.totalPostsProcessed).toBe(5);
    });

    it('should increment totalPostsMatched when posts match jobs', async () => {
      await service.registerJob(createJobConfig());

      // Mock some matches
      keywordFilter.processPost
        .mockResolvedValueOnce(2) // First post matches 2 jobs
        .mockResolvedValueOnce(0) // Second post matches none
        .mockResolvedValueOnce(1); // Third post matches 1 job

      // Emit posts
      const posts = JetstreamFactory.createPostEvents(3);
      for (const post of posts) {
        jetstreamClient._emitPost(post);
        await flushPromises();
      }

      const stats = service.getStats();
      expect(stats.totalPostsMatched).toBe(3); // 2 + 0 + 1
    });

    it('should handle post processing errors gracefully', async () => {
      await service.registerJob(createJobConfig());

      // Make processPost throw
      keywordFilter.processPost.mockRejectedValueOnce(
        new Error('Processing failed'),
      );

      // Emit a post
      const post = JetstreamFactory.createPostEvent();
      jetstreamClient._emitPost(post);

      await flushPromises();

      // Service should still be functional
      expect(service.isCurrentlyListening()).toBe(true);
    });

    it('should continue processing after errors', async () => {
      await service.registerJob(createJobConfig());

      // First post fails, second succeeds
      keywordFilter.processPost
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce(1);

      const posts = JetstreamFactory.createPostEvents(2);
      for (const post of posts) {
        jetstreamClient._emitPost(post);
        await flushPromises();
      }

      const stats = service.getStats();
      expect(stats.totalPostsProcessed).toBe(2);
      expect(stats.totalPostsMatched).toBe(1);
    });
  });

  describe('reconnect', () => {
    it('should reconnect when there are active jobs', async () => {
      await service.registerJob(createJobConfig());
      jobRegistry.hasActiveJobs.mockReturnValue(true);

      await service.reconnect();

      // Disconnect should be called, then connect
      expect(jetstreamClient.disconnect).toHaveBeenCalled();
      expect(jetstreamClient.connect).toHaveBeenCalledTimes(2); // Initial + reconnect
    });

    it('should not reconnect when no active jobs', async () => {
      await service.registerJob(createJobConfig());
      jetstreamClient.connect.mockClear();
      jobRegistry.hasActiveJobs.mockReturnValue(false);

      await service.reconnect();

      expect(jetstreamClient.disconnect).toHaveBeenCalled();
      expect(jetstreamClient.connect).not.toHaveBeenCalled();
    });
  });

  describe('resetStats', () => {
    it('should reset all counters', async () => {
      await service.registerJob(createJobConfig());

      // Process some posts to increment counters
      keywordFilter.processPost.mockResolvedValue(1);
      const posts = JetstreamFactory.createPostEvents(10);
      for (const post of posts) {
        jetstreamClient._emitPost(post);
      }
      await flushPromises();

      // Verify counters are non-zero
      expect(service.getStats().totalPostsProcessed).toBeGreaterThan(0);

      // Reset
      service.resetStats();

      // Verify reset
      expect(service.getStats().totalPostsProcessed).toBe(0);
      expect(service.getStats().totalPostsMatched).toBe(0);
      expect(jetstreamClient.resetMetrics).toHaveBeenCalled();
    });
  });

  describe('stopListening', () => {
    it('should clean up subscriptions and disconnect', async () => {
      await service.registerJob(createJobConfig());

      service.stopListening();

      expect(service.isCurrentlyListening()).toBe(false);
      expect(jetstreamClient.disconnect).toHaveBeenCalled();
    });

    it('should be idempotent (safe to call multiple times)', async () => {
      await service.registerJob(createJobConfig());

      service.stopListening();
      service.stopListening();
      service.stopListening();

      // disconnect should only be called once per listening session
      expect(jetstreamClient.disconnect).toHaveBeenCalledTimes(1);
    });
  });

  describe('connection status monitoring', () => {
    beforeEach(() => {
      service.onModuleInit();
    });

    it.each([
      ['connecting', 'connecting'],
      ['connected', 'connected'],
      ['disconnected', 'disconnected'],
      ['error', 'error'],
      ['reconnecting', 'reconnecting'],
    ] as const)(
      'should subscribe to %s status changes without throwing',
      (status, _description) => {
        // Should handle status change without throwing
        expect(() => jetstreamClient._emitStatus(status)).not.toThrow();
      },
    );

    it('should access active job count on error status', () => {
      jobRegistry.getActiveJobCount.mockReturnValue(3);

      jetstreamClient._emitStatus('error');

      expect(jobRegistry.getActiveJobCount).toHaveBeenCalled();
    });

    it('should access reconnect attempts on reconnecting status', () => {
      jetstreamClient.getMetrics.mockReturnValue({
        messagesReceived: 0,
        messagesPerSecond: 0,
        postsProcessed: 0,
        connectionStatus: 'reconnecting',
        reconnectAttempts: 3,
      });

      jetstreamClient._emitStatus('reconnecting');

      expect(jetstreamClient.getMetrics).toHaveBeenCalled();
    });
  });

  describe('onModuleDestroy', () => {
    it('should stop listening and clean up', async () => {
      await service.registerJob(createJobConfig());

      service.onModuleDestroy();

      expect(service.isCurrentlyListening()).toBe(false);
    });
  });

  describe('race conditions', () => {
    it('should handle cancel during registration', async () => {
      // Start registration (don't await)
      const registerPromise = service.registerJob(
        createJobConfig({ jobId: 'test-job' }),
      );

      // Cancel immediately before registration completes
      service.cancelJob('test-job');

      // Registration should complete without errors
      await expect(registerPromise).resolves.not.toThrow();

      // Job should not be active (either never registered or was cancelled)
      expect(service.isJobRegistered('test-job')).toBe(false);
    });
  });

  describe('concurrent job lifecycle', () => {
    it('should complete jobs independently when multiple are active', async () => {
      const onComplete1 = jest.fn();
      const onComplete2 = jest.fn();

      // Track wrapped callbacks
      const wrappedCallbacks = new Map<string, (count: number) => void>();
      jobRegistry.registerJob.mockImplementation((cfg: RegisterJobConfig) => {
        wrappedCallbacks.set(cfg.jobId, cfg.onComplete);
      });

      await service.registerJob(
        createJobConfig({ jobId: 'job-1', onComplete: onComplete1 }),
      );
      await service.registerJob(
        createJobConfig({ jobId: 'job-2', onComplete: onComplete2 }),
      );

      // Complete job-1 while job-2 is still active
      jobRegistry.getJob.mockReturnValue({
        jobId: 'job-1',
        correlationId: 'c1',
      });
      jobRegistry.hasActiveJobs.mockReturnValue(true); // job-2 still active

      // Trigger completion via wrapped callback
      wrappedCallbacks.get('job-1')!(10);

      // job-1 callback should be called
      expect(onComplete1).toHaveBeenCalledWith(10);
      // job-2 callback should NOT be called
      expect(onComplete2).not.toHaveBeenCalled();
      // Should still be listening
      expect(service.isCurrentlyListening()).toBe(true);
    });

    it('should disconnect only when all jobs are complete', async () => {
      const wrappedCallbacks = new Map<string, (count: number) => void>();
      jobRegistry.registerJob.mockImplementation((cfg: RegisterJobConfig) => {
        wrappedCallbacks.set(cfg.jobId, cfg.onComplete);
      });

      await service.registerJob(createJobConfig({ jobId: 'job-1' }));
      await service.registerJob(createJobConfig({ jobId: 'job-2' }));

      // Complete job-1, job-2 still active
      jobRegistry.getJob.mockReturnValue({
        jobId: 'job-1',
        correlationId: 'c1',
      });
      jobRegistry.hasActiveJobs.mockReturnValue(true);
      wrappedCallbacks.get('job-1')!(5);

      expect(service.isCurrentlyListening()).toBe(true);
      expect(jetstreamClient.disconnect).not.toHaveBeenCalled();

      // Complete job-2, no more active jobs
      jobRegistry.getJob.mockReturnValue({
        jobId: 'job-2',
        correlationId: 'c2',
      });
      jobRegistry.hasActiveJobs.mockReturnValue(false);
      wrappedCallbacks.get('job-2')!(15);

      expect(service.isCurrentlyListening()).toBe(false);
      expect(jetstreamClient.disconnect).toHaveBeenCalled();
    });

    it('should handle mixed complete and cancel operations', async () => {
      const wrappedCallbacks = new Map<string, (count: number) => void>();
      jobRegistry.registerJob.mockImplementation((cfg: RegisterJobConfig) => {
        wrappedCallbacks.set(cfg.jobId, cfg.onComplete);
      });

      await service.registerJob(createJobConfig({ jobId: 'job-1' }));
      await service.registerJob(createJobConfig({ jobId: 'job-2' }));
      await service.registerJob(createJobConfig({ jobId: 'job-3' }));

      // Cancel job-2
      jobRegistry.getJob.mockReturnValue({
        jobId: 'job-2',
        correlationId: 'c2',
      });
      jobRegistry.hasActiveJobs.mockReturnValue(true);
      service.cancelJob('job-2');

      expect(jobRegistry.unregisterJob).toHaveBeenCalledWith('job-2');
      expect(service.isCurrentlyListening()).toBe(true);

      // Complete job-1
      jobRegistry.getJob.mockReturnValue({
        jobId: 'job-1',
        correlationId: 'c1',
      });
      jobRegistry.hasActiveJobs.mockReturnValue(true);
      wrappedCallbacks.get('job-1')!(10);

      expect(service.isCurrentlyListening()).toBe(true);

      // Complete job-3 (last one)
      jobRegistry.getJob.mockReturnValue({
        jobId: 'job-3',
        correlationId: 'c3',
      });
      jobRegistry.hasActiveJobs.mockReturnValue(false);
      wrappedCallbacks.get('job-3')!(20);

      expect(service.isCurrentlyListening()).toBe(false);
    });
  });
});
