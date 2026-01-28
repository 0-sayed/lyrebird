import { Test, TestingModule } from '@nestjs/testing';
import {
  JobRegistryService,
  RegisteredJob,
  RegisterJobConfig,
} from './job-registry.service';

describe('JobRegistryService', () => {
  let service: JobRegistryService;
  let module: TestingModule;

  /**
   * Creates a job config with defaults for testing
   */
  const createJobConfig = (
    overrides: Partial<RegisterJobConfig> = {},
  ): RegisterJobConfig => ({
    jobId: `test-job-${Date.now()}`,
    prompt: 'bitcoin cryptocurrency',
    correlationId: 'corr-123',
    maxDurationMs: 60000,
    onData: jest.fn().mockResolvedValue(undefined),
    onComplete: jest.fn(),
    ...overrides,
  });

  beforeEach(async () => {
    jest.useFakeTimers();

    module = await Test.createTestingModule({
      providers: [JobRegistryService],
    }).compile();

    service = module.get<JobRegistryService>(JobRegistryService);
  });

  afterEach(async () => {
    jest.useRealTimers();
    await module.close();
  });

  describe('initialization', () => {
    it('should have no active jobs initially', () => {
      expect(service.hasActiveJobs()).toBe(false);
      expect(service.getActiveJobCount()).toBe(0);
      expect(service.getActiveJobs()).toHaveLength(0);
    });
  });

  describe('registerJob', () => {
    it('should register a job and make it retrievable', () => {
      const config = createJobConfig({ jobId: 'job-123' });
      service.registerJob(config);

      expect(service.hasActiveJobs()).toBe(true);
      expect(service.getActiveJobCount()).toBe(1);

      const job = service.getJob('job-123');
      expect(job).toBeDefined();
      expect(job?.prompt).toBe(config.prompt);
      expect(job?.matchedCount).toBe(0);
    });

    it('should replace existing job with same ID', () => {
      const config1 = createJobConfig({ jobId: 'job-123', prompt: 'first' });
      const config2 = createJobConfig({ jobId: 'job-123', prompt: 'second' });

      service.registerJob(config1);
      service.registerJob(config2);

      expect(service.getActiveJobCount()).toBe(1);
      expect(service.getJob('job-123')?.prompt).toBe('second');
    });

    describe('keyword extraction', () => {
      it.each([
        ['bitcoin', ['bitcoin']],
        ['Bitcoin and Ethereum', ['bitcoin', 'ethereum']],
        ['#crypto #bitcoin trading', ['crypto', 'bitcoin', 'trading']],
        ['the and is a to', []], // only stop words
        ['a to be', []], // short words filtered
      ])(
        'should extract keywords from "%s" as %j',
        (prompt: string, expected: string[]) => {
          const config = createJobConfig({ jobId: 'job-123', prompt });
          service.registerJob(config);

          const job = service.getJob('job-123');
          expect(job?.keywords).toEqual(expected);
        },
      );

      it('should limit keywords to maximum count', () => {
        const manyWords = Array.from({ length: 50 }, (_, i) => `word${i}`).join(
          ' ',
        );
        const keywords = service.extractKeywords(manyWords);
        expect(keywords.length).toBeLessThanOrEqual(20);
      });
    });

    describe('duration timeout', () => {
      it('should trigger onComplete when max duration is reached', () => {
        const onComplete = jest.fn();
        const config = createJobConfig({
          jobId: 'job-123',
          maxDurationMs: 5000,
          onComplete,
        });

        service.registerJob(config);
        jest.advanceTimersByTime(5000);

        expect(onComplete).toHaveBeenCalledWith(0);
        expect(service.hasActiveJobs()).toBe(false);
      });

      it('should not set timeout when maxDurationMs is 0', () => {
        const onComplete = jest.fn();
        const config = createJobConfig({
          jobId: 'job-123',
          maxDurationMs: 0,
          onComplete,
        });

        service.registerJob(config);
        jest.advanceTimersByTime(100000);

        expect(onComplete).not.toHaveBeenCalled();
        expect(service.hasActiveJobs()).toBe(true);
      });
    });
  });

  describe('unregisterJob', () => {
    it('should remove job from registry', () => {
      const config = createJobConfig({ jobId: 'job-123' });
      service.registerJob(config);
      expect(service.hasActiveJobs()).toBe(true);

      service.unregisterJob('job-123');

      expect(service.hasActiveJobs()).toBe(false);
      expect(service.getJob('job-123')).toBeUndefined();
    });

    it('should clear duration timeout when unregistered', () => {
      const onComplete = jest.fn();
      const config = createJobConfig({
        jobId: 'job-123',
        maxDurationMs: 5000,
        onComplete,
      });

      service.registerJob(config);
      service.unregisterJob('job-123');

      jest.advanceTimersByTime(10000);
      expect(onComplete).not.toHaveBeenCalled();
    });

    it('should handle unregistering non-existent job gracefully', () => {
      expect(() => service.unregisterJob('non-existent')).not.toThrow();
    });
  });

  describe('completeJob', () => {
    it('should remove job and invoke onComplete with matched count', () => {
      const onComplete = jest.fn();
      const config = createJobConfig({ jobId: 'job-123', onComplete });

      service.registerJob(config);
      service.incrementMatchedCount('job-123');
      service.incrementMatchedCount('job-123');
      service.completeJob('job-123');

      expect(onComplete).toHaveBeenCalledWith(2);
      expect(service.hasActiveJobs()).toBe(false);
    });

    it('should handle completing non-existent job gracefully', () => {
      expect(() => service.completeJob('non-existent')).not.toThrow();
    });
  });

  describe('buildRegexPattern', () => {
    it.each([
      // [keywords, matchingText, shouldMatch]
      [['bitcoin'], 'I bought bitcoin', true],
      [['bitcoin'], 'BITCOIN is great', true],
      [['coin'], 'coin is money', true],
      [['coin'], 'bitcoin', false], // partial word
      [['coin'], 'coins', false], // plural
      [['test.com'], 'visit test.com now', true],
      [['test.com'], 'visit testXcom', false], // . is escaped
      [[], 'anything', false], // empty keywords
    ] as const)(
      'should handle %j matching "%s" = %s',
      (keywords, text, expected) => {
        const pattern = service.buildRegexPattern([...keywords]);
        expect(pattern.test(text)).toBe(expected);
      },
    );
  });

  describe('matchesJob', () => {
    it('should match text against job regex pattern', () => {
      const config = createJobConfig({
        jobId: 'job-123',
        prompt: 'bitcoin ethereum',
      });
      service.registerJob(config);
      const job = service.getJob('job-123') as RegisteredJob;

      expect(service.matchesJob('I just bought bitcoin', job)).toBe(true);
      expect(service.matchesJob('Ethereum to the moon!', job)).toBe(true);
      expect(service.matchesJob('I love dogecoin', job)).toBe(false);
    });
  });

  describe('concurrent job operations', () => {
    it('should manage multiple jobs independently', () => {
      const jobs = [
        createJobConfig({ jobId: 'job-1', prompt: 'bitcoin' }),
        createJobConfig({ jobId: 'job-2', prompt: 'ethereum' }),
        createJobConfig({ jobId: 'job-3', prompt: 'dogecoin' }),
      ];

      jobs.forEach((config) => service.registerJob(config));
      expect(service.getActiveJobCount()).toBe(3);

      // Complete one job
      service.completeJob('job-2');
      expect(service.getActiveJobCount()).toBe(2);
      expect(service.getJob('job-1')).toBeDefined();
      expect(service.getJob('job-2')).toBeUndefined();
      expect(service.getJob('job-3')).toBeDefined();
    });

    it('should track matched counts per job independently', () => {
      service.registerJob(createJobConfig({ jobId: 'job-1' }));
      service.registerJob(createJobConfig({ jobId: 'job-2' }));

      service.incrementMatchedCount('job-1');
      service.incrementMatchedCount('job-1');
      service.incrementMatchedCount('job-2');

      expect(service.getJob('job-1')?.matchedCount).toBe(2);
      expect(service.getJob('job-2')?.matchedCount).toBe(1);
    });

    it('should return all active jobs in registration order', () => {
      for (let i = 0; i < 3; i++) {
        service.registerJob(createJobConfig({ jobId: `job-${i}` }));
      }

      const jobs = service.getActiveJobs();
      expect(jobs.map((j) => j.jobId)).toEqual(['job-0', 'job-1', 'job-2']);
    });

    it('should handle timeout expiration for multiple jobs independently', () => {
      const onComplete1 = jest.fn();
      const onComplete2 = jest.fn();

      service.registerJob(
        createJobConfig({
          jobId: 'job-1',
          maxDurationMs: 5000,
          onComplete: onComplete1,
        }),
      );
      service.registerJob(
        createJobConfig({
          jobId: 'job-2',
          maxDurationMs: 10000,
          onComplete: onComplete2,
        }),
      );

      jest.advanceTimersByTime(5000);
      expect(onComplete1).toHaveBeenCalledWith(0);
      expect(onComplete2).not.toHaveBeenCalled();
      expect(service.getActiveJobCount()).toBe(1);

      jest.advanceTimersByTime(5000);
      expect(onComplete2).toHaveBeenCalledWith(0);
      expect(service.getActiveJobCount()).toBe(0);
    });
  });

  describe('incrementMatchedCount', () => {
    it('should handle incrementing non-existent job gracefully', () => {
      expect(() => service.incrementMatchedCount('non-existent')).not.toThrow();
    });
  });

  describe('state cleanup', () => {
    it('should clear all state when job completes via timeout', () => {
      const onComplete = jest.fn();
      const config = createJobConfig({
        jobId: 'job-123',
        maxDurationMs: 1000,
        onComplete,
      });

      service.registerJob(config);
      service.incrementMatchedCount('job-123');

      jest.advanceTimersByTime(1000);

      expect(onComplete).toHaveBeenCalledWith(1);
      expect(service.getJob('job-123')).toBeUndefined();
      expect(service.hasActiveJobs()).toBe(false);
    });

    it('should clear timeout when completing job before timeout', () => {
      const onComplete = jest.fn();
      const config = createJobConfig({
        jobId: 'job-123',
        maxDurationMs: 10000,
        onComplete,
      });

      service.registerJob(config);
      service.completeJob('job-123');

      expect(onComplete).toHaveBeenCalledTimes(1);

      // Advance past timeout - should not trigger again
      jest.advanceTimersByTime(15000);
      expect(onComplete).toHaveBeenCalledTimes(1);
    });
  });
});
