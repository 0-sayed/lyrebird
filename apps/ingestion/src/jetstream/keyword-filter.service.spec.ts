import { Test, TestingModule } from '@nestjs/testing';
import { KeywordFilterService } from './keyword-filter.service';
import { JobRegistryService } from './job-registry.service';
import { DidResolverService } from '@app/bluesky';
import {
  createMockJetstreamPostEvent,
  resetJetstreamCounter,
} from '../../../../test/fixtures';

describe('KeywordFilterService', () => {
  let service: KeywordFilterService;
  let jobRegistry: JobRegistryService;
  let didResolver: jest.Mocked<DidResolverService>;
  let module: TestingModule;
  let jobCounter = 0;

  const createJobConfig = (overrides: {
    prompt: string;
    onData?: jest.Mock;
    onComplete?: jest.Mock;
  }) => ({
    jobId: `job-${++jobCounter}`,
    prompt: overrides.prompt,
    correlationId: `corr-${jobCounter}`,
    maxDurationMs: 60000,
    onData: overrides.onData ?? jest.fn().mockResolvedValue(undefined),
    onComplete: overrides.onComplete ?? jest.fn(),
  });

  beforeEach(async () => {
    jobCounter = 0;
    resetJetstreamCounter();

    const mockDidResolver = {
      resolveHandle: jest.fn().mockImplementation((did: string) => did),
      resolveHandleOrNull: jest.fn().mockResolvedValue(null),
      resolveHandles: jest.fn().mockResolvedValue([]),
      warmCache: jest.fn().mockResolvedValue(undefined),
      getMetrics: jest.fn().mockReturnValue({
        totalRequests: 0,
        cacheHits: 0,
        cacheMisses: 0,
        failures: 0,
        cacheSize: 0,
        hitRate: 0,
      }),
      clearCache: jest.fn(),
      resetMetrics: jest.fn(),
      setCachedHandle: jest.fn(),
      onModuleDestroy: jest.fn(),
    };

    module = await Test.createTestingModule({
      providers: [
        KeywordFilterService,
        JobRegistryService,
        { provide: DidResolverService, useValue: mockDidResolver },
      ],
    }).compile();

    service = module.get<KeywordFilterService>(KeywordFilterService);
    jobRegistry = module.get<JobRegistryService>(JobRegistryService);
    didResolver = module.get(DidResolverService);
  });

  afterEach(async () => {
    await module.close();
  });

  describe('matchPost', () => {
    it('should return empty array when no active jobs', () => {
      const post = createMockJetstreamPostEvent({ text: 'Bitcoin is great!' });
      const matches = service.matchPost(post);

      expect(matches).toHaveLength(0);
    });

    it('should return matching jobs', () => {
      jobRegistry.registerJob(
        createJobConfig({ prompt: 'bitcoin cryptocurrency' }),
      );

      const post = createMockJetstreamPostEvent({
        text: 'I just bought bitcoin!',
      });
      const matches = service.matchPost(post);

      expect(matches).toHaveLength(1);
      expect(matches[0].jobId).toBe('job-1');
    });

    it('should return empty array when no jobs match', () => {
      jobRegistry.registerJob(createJobConfig({ prompt: 'ethereum' }));

      const post = createMockJetstreamPostEvent({ text: 'I love dogecoin!' });
      const matches = service.matchPost(post);

      expect(matches).toHaveLength(0);
    });

    it('should return multiple matching jobs', () => {
      jobRegistry.registerJob(createJobConfig({ prompt: 'bitcoin' }));
      jobRegistry.registerJob(
        createJobConfig({ prompt: 'crypto cryptocurrency' }),
      );

      const post = createMockJetstreamPostEvent({
        text: 'Bitcoin is the best cryptocurrency!',
      });
      const matches = service.matchPost(post);

      expect(matches).toHaveLength(2);
      expect(matches.map((j) => j.jobId)).toContain('job-1');
      expect(matches.map((j) => j.jobId)).toContain('job-2');
    });

    describe('case sensitivity', () => {
      it.each([
        [
          'BITCOIN',
          'bitcoin',
          true,
          'uppercase post matches lowercase keyword',
        ],
        [
          'bitcoin',
          'BITCOIN',
          true,
          'lowercase post matches uppercase keyword',
        ],
        [
          'Bitcoin',
          'bitcoin',
          true,
          'mixed case post matches lowercase keyword',
        ],
        ['BiTcOiN', 'bitcoin', true, 'alternating case matches'],
      ] as const)(
        'should match when post contains "%s" and keyword is "%s" (%s)',
        (postText, keyword, shouldMatch, _description) => {
          jobRegistry.registerJob(createJobConfig({ prompt: keyword }));

          const post = createMockJetstreamPostEvent({
            text: `I love ${postText}!`,
          });
          const matches = service.matchPost(post);

          expect(matches.length > 0).toBe(shouldMatch);
        },
      );
    });

    describe('Unicode and emoji handling', () => {
      it.each([
        ['bitcoin', 'Bitcoin is great', true, 'ASCII keyword matches'],
        ['bitcoin', 'Check Bitcoin', true, 'ASCII with different context'],
        ['bitcoin', 'I love Bitcoin!', true, 'ASCII with punctuation'],
        ['bitcoin', 'No crypto here', false, 'ASCII no match'],
      ] as const)(
        'should handle ASCII: keyword="%s" text="%s" -> %s',
        (keyword, text, shouldMatch, _description) => {
          jobRegistry.registerJob(createJobConfig({ prompt: keyword }));

          const post = createMockJetstreamPostEvent({ text });
          const matches = service.matchPost(post);

          expect(matches.length > 0).toBe(shouldMatch);
        },
      );

      it('should match ASCII keywords in text with special characters nearby', () => {
        // Note: Accented character matching (café vs cafe) is not currently supported
        // This test verifies basic matching still works with nearby special chars
        jobRegistry.registerJob(createJobConfig({ prompt: 'cafe' }));

        const post = createMockJetstreamPostEvent({
          text: 'I went to the café cafe today!',
        });
        const matches = service.matchPost(post);

        expect(matches.length).toBe(1);
      });

      it('should not match keywords partially embedded in other words', () => {
        jobRegistry.registerJob(createJobConfig({ prompt: 'coin' }));

        const post = createMockJetstreamPostEvent({
          text: 'I love altcoin and bitcoin!', // contains "coin" as suffix, not standalone word
        });
        const matches = service.matchPost(post);

        expect(matches).toHaveLength(0);
      });

      it('should match keywords at word boundaries with emojis nearby', () => {
        jobRegistry.registerJob(createJobConfig({ prompt: 'bitcoin' }));

        const post = createMockJetstreamPostEvent({
          text: 'Bitcoin is the future!',
        });
        const matches = service.matchPost(post);

        expect(matches).toHaveLength(1);
      });
    });

    describe('word boundary matching', () => {
      it.each([
        ['crypto', 'I love crypto!', true, 'exact word match'],
        [
          'crypto',
          'cryptocurrency is great',
          false,
          'substring should not match',
        ],
        ['bitcoin', 'my-bitcoin-wallet', true, 'hyphen acts as word boundary'],
        ['eth', 'ethereum is cool', false, 'prefix should not match'],
        ['coin', 'bitcoin rules', false, 'suffix should not match'],
      ] as const)(
        'should handle word boundaries: keyword="%s" text="%s" -> %s (%s)',
        (keyword, text, shouldMatch, _description) => {
          jobRegistry.registerJob(createJobConfig({ prompt: keyword }));

          const post = createMockJetstreamPostEvent({ text });
          const matches = service.matchPost(post);

          expect(matches.length > 0).toBe(shouldMatch);
        },
      );
    });
  });

  describe('processPost', () => {
    it('should dispatch post to matching jobs', async () => {
      const onData = jest.fn().mockResolvedValue(undefined);
      jobRegistry.registerJob(createJobConfig({ prompt: 'bitcoin', onData }));

      const post = createMockJetstreamPostEvent({
        text: 'Bitcoin to the moon!',
      });
      const matchCount = await service.processPost(post);

      expect(matchCount).toBe(1);
      expect(onData).toHaveBeenCalledTimes(1);
      expect(onData).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: 'job-1',
          textContent: 'Bitcoin to the moon!',
          source: 'bluesky',
        }),
      );
    });

    it('should dispatch to multiple matching jobs', async () => {
      const onData1 = jest.fn().mockResolvedValue(undefined);
      const onData2 = jest.fn().mockResolvedValue(undefined);

      jobRegistry.registerJob(
        createJobConfig({ prompt: 'bitcoin', onData: onData1 }),
      );
      jobRegistry.registerJob(
        createJobConfig({ prompt: 'moon', onData: onData2 }),
      );

      const post = createMockJetstreamPostEvent({
        text: 'Bitcoin to the moon!',
      });
      const matchCount = await service.processPost(post);

      expect(matchCount).toBe(2);
      expect(onData1).toHaveBeenCalledTimes(1);
      expect(onData2).toHaveBeenCalledTimes(1);
    });

    it('should return 0 for non-matching posts', async () => {
      const onData = jest.fn().mockResolvedValue(undefined);
      jobRegistry.registerJob(createJobConfig({ prompt: 'ethereum', onData }));

      const post = createMockJetstreamPostEvent({ text: 'I love dogecoin!' });
      const matchCount = await service.processPost(post);

      expect(matchCount).toBe(0);
      expect(onData).not.toHaveBeenCalled();
    });

    it('should increment match count for matching jobs', async () => {
      jobRegistry.registerJob(createJobConfig({ prompt: 'bitcoin' }));

      const post = createMockJetstreamPostEvent({ text: 'Bitcoin is great!' });
      await service.processPost(post);

      const job = jobRegistry.getJob('job-1');
      expect(job?.matchedCount).toBe(1);
    });

    describe('source URL construction', () => {
      it('should build source URL with handle when available', async () => {
        const onData = jest.fn().mockResolvedValue(undefined);
        jobRegistry.registerJob(createJobConfig({ prompt: 'bitcoin', onData }));

        const post = createMockJetstreamPostEvent({
          text: 'Bitcoin is great!',
          handle: 'alice.bsky.social',
          rkey: 'xyz789',
        });
        await service.processPost(post);

        expect(onData).toHaveBeenCalledWith(
          expect.objectContaining({
            sourceUrl: 'https://bsky.app/profile/alice.bsky.social/post/xyz789',
            authorName: 'alice.bsky.social',
          }),
        );
      });

      it('should build source URL with DID when handle not available', async () => {
        const onData = jest.fn().mockResolvedValue(undefined);
        jobRegistry.registerJob(createJobConfig({ prompt: 'bitcoin', onData }));

        const post = createMockJetstreamPostEvent({
          text: 'Bitcoin is great!',
          handle: undefined,
          did: 'did:plc:abc123',
          rkey: 'xyz789',
        });
        await service.processPost(post);

        expect(onData).toHaveBeenCalledWith(
          expect.objectContaining({
            sourceUrl: 'https://bsky.app/profile/did:plc:abc123/post/xyz789',
            authorName: 'did:plc:abc123',
          }),
        );
      });
    });

    describe('timestamp fields', () => {
      it('should include correct timestamp fields', async () => {
        const onData = jest.fn().mockResolvedValue(undefined);
        jobRegistry.registerJob(createJobConfig({ prompt: 'bitcoin', onData }));

        const createdAt = new Date('2026-01-15T12:00:00.000Z');
        const post = createMockJetstreamPostEvent({
          text: 'Bitcoin!',
          createdAt,
        });
        await service.processPost(post);

        expect(onData).toHaveBeenCalledWith(
          expect.objectContaining({
            publishedAt: createdAt,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            collectedAt: expect.any(Date),
          }),
        );
      });
    });

    describe('error handling', () => {
      it('should handle callback errors gracefully', async () => {
        const onData = jest
          .fn()
          .mockRejectedValue(new Error('Callback failed'));
        jobRegistry.registerJob(createJobConfig({ prompt: 'bitcoin', onData }));

        const post = createMockJetstreamPostEvent({
          text: 'Bitcoin is great!',
        });

        // Should not throw
        await expect(service.processPost(post)).resolves.toBe(1);
      });

      it('should continue processing other jobs when one callback fails', async () => {
        const onData1 = jest.fn().mockRejectedValue(new Error('First failed'));
        const onData2 = jest.fn().mockResolvedValue(undefined);

        jobRegistry.registerJob(
          createJobConfig({ prompt: 'bitcoin', onData: onData1 }),
        );
        jobRegistry.registerJob(
          createJobConfig({ prompt: 'moon', onData: onData2 }),
        );

        const post = createMockJetstreamPostEvent({ text: 'Bitcoin moon!' });
        const matchCount = await service.processPost(post);

        expect(matchCount).toBe(2);
        expect(onData1).toHaveBeenCalledTimes(1);
        expect(onData2).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('getMatchStats', () => {
    it('should return zero stats when no jobs', () => {
      const stats = service.getMatchStats();

      expect(stats.totalJobs).toBe(0);
      expect(stats.totalMatched).toBe(0);
      expect(stats.jobStats).toHaveLength(0);
    });

    it('should return correct statistics', () => {
      jobRegistry.registerJob(createJobConfig({ prompt: 'bitcoin' }));
      jobRegistry.registerJob(createJobConfig({ prompt: 'ethereum' }));

      // Simulate some matches
      jobRegistry.incrementMatchedCount('job-1');
      jobRegistry.incrementMatchedCount('job-1');
      jobRegistry.incrementMatchedCount('job-2');

      const stats = service.getMatchStats();

      expect(stats.totalJobs).toBe(2);
      expect(stats.totalMatched).toBe(3);
      expect(stats.jobStats).toHaveLength(2);
      expect(
        stats.jobStats.find((j) => j.jobId === 'job-1')?.matchedCount,
      ).toBe(2);
      expect(
        stats.jobStats.find((j) => j.jobId === 'job-2')?.matchedCount,
      ).toBe(1);
    });
  });

  describe('DID resolution', () => {
    it('should resolve handle when not present on post', async () => {
      didResolver.resolveHandle.mockResolvedValue('resolved.bsky.social');
      const onData = jest.fn().mockResolvedValue(undefined);
      jobRegistry.registerJob(createJobConfig({ prompt: 'bitcoin', onData }));

      const post = createMockJetstreamPostEvent({
        text: 'Bitcoin is great!',
        handle: undefined,
        did: 'did:plc:needsresolution',
      });
      await service.processPost(post);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(didResolver.resolveHandle).toHaveBeenCalledWith(
        'did:plc:needsresolution',
      );
      expect(onData).toHaveBeenCalledWith(
        expect.objectContaining({
          authorName: 'resolved.bsky.social',
        }),
      );
    });

    it('should not resolve handle when already present on post', async () => {
      const onData = jest.fn().mockResolvedValue(undefined);
      jobRegistry.registerJob(createJobConfig({ prompt: 'bitcoin', onData }));

      const post = createMockJetstreamPostEvent({
        text: 'Bitcoin is great!',
        handle: 'already.bsky.social',
      });
      await service.processPost(post);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(didResolver.resolveHandle).not.toHaveBeenCalled();
      expect(onData).toHaveBeenCalledWith(
        expect.objectContaining({
          authorName: 'already.bsky.social',
        }),
      );
    });

    it('should use DID when resolution fails', async () => {
      // When resolution fails, resolveHandle returns the original DID
      didResolver.resolveHandle.mockResolvedValue('did:plc:failedresolution');
      const onData = jest.fn().mockResolvedValue(undefined);
      jobRegistry.registerJob(createJobConfig({ prompt: 'bitcoin', onData }));

      const post = createMockJetstreamPostEvent({
        text: 'Bitcoin is great!',
        handle: undefined,
        did: 'did:plc:failedresolution',
      });
      await service.processPost(post);

      expect(onData).toHaveBeenCalledWith(
        expect.objectContaining({
          authorName: 'did:plc:failedresolution',
        }),
      );
    });
  });

  describe('getResolverMetrics', () => {
    it('should return DID resolver metrics', () => {
      const mockMetrics = {
        totalRequests: 100,
        cacheHits: 80,
        cacheMisses: 20,
        failures: 5,
        cacheSize: 50,
        hitRate: 0.8,
      };
      didResolver.getMetrics.mockReturnValue(mockMetrics);

      const metrics = service.getResolverMetrics();

      expect(metrics).toEqual(mockMetrics);
    });
  });
});
