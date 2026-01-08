import { Test, TestingModule } from '@nestjs/testing';
import {
  PollingScraperService,
  PollingConfig,
} from './polling-scraper.service';
import { BlueskyClientService, BlueskyPost } from '@app/bluesky';
import { RawDataMessage } from '@app/shared-types';

describe('PollingScraperService', () => {
  let service: PollingScraperService;
  let mockSearchPostsSince: jest.Mock;
  let mockBuildPostUrl: jest.Mock;

  const createMockPost = (
    overrides: Partial<BlueskyPost> = {},
  ): BlueskyPost => ({
    uri: 'at://did:plc:abc123/app.bsky.feed.post/xyz789',
    cid: 'bafyreia...',
    author: {
      did: 'did:plc:abc123',
      handle: 'testuser.bsky.social',
      displayName: 'Test User',
      avatar: 'https://cdn.bsky.app/avatar.jpg',
    },
    record: {
      text: 'This is a test post!',
      createdAt: '2024-01-15T12:00:00.000Z',
      langs: ['en'],
    },
    likeCount: 10,
    repostCount: 5,
    replyCount: 2,
    indexedAt: '2024-01-15T12:00:01.000Z',
    ...overrides,
  });

  beforeEach(async () => {
    mockSearchPostsSince = jest.fn();
    mockBuildPostUrl = jest.fn((post: BlueskyPost) => {
      const postId = post.uri.split('/').pop() ?? '';
      return `https://bsky.app/profile/${post.author.handle}/post/${postId}`;
    });

    const mockBlueskyClient = {
      searchPosts: jest.fn(),
      searchPostsSince: mockSearchPostsSince,
      buildPostUrl: mockBuildPostUrl,
      isReady: jest.fn().mockReturnValue(true),
      getAuthState: jest.fn().mockReturnValue({
        isAuthenticated: true,
        identifier: 'test.bsky.social',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PollingScraperService,
        {
          provide: BlueskyClientService,
          useValue: mockBlueskyClient,
        },
      ],
    }).compile();

    service = module.get<PollingScraperService>(PollingScraperService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should report no active jobs initially', () => {
      expect(service.getActiveJobCount()).toBe(0);
    });
  });

  describe('startPollingJob', () => {
    it('should perform initial fetch with posts from last hour', async () => {
      const mockPost = createMockPost({
        record: {
          text: 'Test post content',
          createdAt: '2024-01-15T12:00:00.000Z',
        },
      });

      mockSearchPostsSince.mockResolvedValue({
        posts: [mockPost],
        cursor: undefined,
        hitsTotal: 1,
      });

      const receivedData: RawDataMessage[] = [];
      const onData = jest.fn((data: RawDataMessage) => {
        receivedData.push(data);
        return Promise.resolve();
      });
      const onComplete = jest.fn();

      jest.useFakeTimers();

      const config: PollingConfig = {
        jobId: 'job-123',
        prompt: 'test query',
        correlationId: 'corr-456',
        pollIntervalMs: 5000,
        maxDurationMs: 60000,
        onData,
        onComplete,
      };

      await service.startPollingJob(config);

      // Should have performed initial fetch
      expect(mockSearchPostsSince).toHaveBeenCalled();
      expect(onData).toHaveBeenCalledTimes(1);
      expect(receivedData).toHaveLength(1);
      expect(receivedData[0].textContent).toBe('Test post content');
      expect(receivedData[0].source).toBe('bluesky');

      // Cleanup
      await service.stopPollingJob('job-123');
    });

    it('should register as active job', async () => {
      mockSearchPostsSince.mockResolvedValue({
        posts: [],
        cursor: undefined,
        hitsTotal: 0,
      });

      jest.useFakeTimers();

      const config: PollingConfig = {
        jobId: 'job-123',
        prompt: 'test',
        correlationId: 'corr-456',
        pollIntervalMs: 5000,
        maxDurationMs: 60000,
        onData: jest.fn().mockResolvedValue(undefined),
        onComplete: jest.fn(),
      };

      await service.startPollingJob(config);

      expect(service.isJobActive('job-123')).toBe(true);
      expect(service.getActiveJobCount()).toBe(1);

      // Cleanup
      await service.stopPollingJob('job-123');
    });

    it('should map post data correctly to RawDataMessage', async () => {
      const mockPost = createMockPost({
        uri: 'at://did:plc:abc123/app.bsky.feed.post/post123',
        author: {
          did: 'did:plc:abc123',
          handle: 'author.bsky.social',
          displayName: 'Author Name',
        },
        record: {
          text: 'This is the post content',
          createdAt: '2024-01-15T12:00:00.000Z',
        },
        likeCount: 42,
        replyCount: 7,
      });

      mockSearchPostsSince.mockResolvedValue({
        posts: [mockPost],
        cursor: undefined,
        hitsTotal: 1,
      });

      jest.useFakeTimers();

      const receivedData: RawDataMessage[] = [];
      const onData = jest.fn((data: RawDataMessage) => {
        receivedData.push(data);
        return Promise.resolve();
      });

      await service.startPollingJob({
        jobId: 'job-123',
        prompt: 'test',
        correlationId: 'corr-456',
        pollIntervalMs: 5000,
        maxDurationMs: 60000,
        onData,
        onComplete: jest.fn(),
      });

      expect(receivedData).toHaveLength(1);
      const rawData = receivedData[0];
      expect(rawData.jobId).toBe('job-123');
      expect(rawData.textContent).toBe('This is the post content');
      expect(rawData.source).toBe('bluesky');
      expect(rawData.sourceUrl).toBe(
        'https://bsky.app/profile/author.bsky.social/post/post123',
      );
      expect(rawData.authorName).toBe('Author Name');
      expect(rawData.upvotes).toBe(42);
      expect(rawData.commentCount).toBe(7);
      expect(rawData.publishedAt).toBeInstanceOf(Date);
      expect(rawData.collectedAt).toBeInstanceOf(Date);

      await service.stopPollingJob('job-123');
    });

    it('should use handle as author name when displayName is not available', async () => {
      const mockPost = createMockPost({
        author: {
          did: 'did:plc:abc123',
          handle: 'user.bsky.social',
          displayName: undefined,
        },
      });

      mockSearchPostsSince.mockResolvedValue({
        posts: [mockPost],
        cursor: undefined,
        hitsTotal: 1,
      });

      jest.useFakeTimers();

      const receivedData: RawDataMessage[] = [];
      const onData = jest.fn((data: RawDataMessage) => {
        receivedData.push(data);
        return Promise.resolve();
      });

      await service.startPollingJob({
        jobId: 'job-123',
        prompt: 'test',
        correlationId: 'corr-456',
        pollIntervalMs: 5000,
        maxDurationMs: 60000,
        onData,
        onComplete: jest.fn(),
      });

      expect(receivedData[0].authorName).toBe('user.bsky.social');

      await service.stopPollingJob('job-123');
    });

    it('should handle empty initial results', async () => {
      mockSearchPostsSince.mockResolvedValue({
        posts: [],
        cursor: undefined,
        hitsTotal: 0,
      });

      jest.useFakeTimers();

      const onData = jest.fn().mockResolvedValue(undefined);

      await service.startPollingJob({
        jobId: 'job-123',
        prompt: 'nonexistent',
        correlationId: 'corr-456',
        pollIntervalMs: 5000,
        maxDurationMs: 60000,
        onData,
        onComplete: jest.fn(),
      });

      // Initial fetch called but no data
      expect(mockSearchPostsSince).toHaveBeenCalledTimes(1);
      expect(onData).not.toHaveBeenCalled();

      await service.stopPollingJob('job-123');
    });

    it('should poll at the specified interval', async () => {
      mockSearchPostsSince.mockResolvedValue({
        posts: [],
        cursor: undefined,
        hitsTotal: 0,
      });

      jest.useFakeTimers();

      const onData = jest.fn().mockResolvedValue(undefined);
      const onComplete = jest.fn();

      await service.startPollingJob({
        jobId: 'job-123',
        prompt: 'test',
        correlationId: 'corr-456',
        pollIntervalMs: 5000,
        maxDurationMs: 60000,
        onData,
        onComplete,
      });

      // Initial fetch
      expect(mockSearchPostsSince).toHaveBeenCalledTimes(1);

      // Advance time by 5 seconds - should trigger first poll
      await jest.advanceTimersByTimeAsync(5000);
      expect(mockSearchPostsSince).toHaveBeenCalledTimes(2);

      // Advance time by another 5 seconds - should trigger second poll
      await jest.advanceTimersByTimeAsync(5000);
      expect(mockSearchPostsSince).toHaveBeenCalledTimes(3);

      await service.stopPollingJob('job-123');
    });

    it('should call onComplete when max duration is reached', async () => {
      mockSearchPostsSince.mockResolvedValue({
        posts: [],
        cursor: undefined,
        hitsTotal: 0,
      });

      jest.useFakeTimers();
      const startTime = Date.now();
      jest.setSystemTime(startTime);

      const onComplete = jest.fn();

      await service.startPollingJob({
        jobId: 'job-123',
        prompt: 'test',
        correlationId: 'corr-456',
        pollIntervalMs: 5000,
        maxDurationMs: 10000, // 10 seconds
        onData: jest.fn().mockResolvedValue(undefined),
        onComplete,
      });

      expect(onComplete).not.toHaveBeenCalled();

      // Advance time past max duration
      jest.setSystemTime(startTime + 11000);
      await jest.runAllTimersAsync();

      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(service.isJobActive('job-123')).toBe(false);

      jest.useRealTimers();
    });

    it('should stop polling when AbortSignal is triggered', async () => {
      mockSearchPostsSince.mockResolvedValue({
        posts: [],
        cursor: undefined,
        hitsTotal: 0,
      });

      jest.useFakeTimers();
      jest.setSystemTime(Date.now());

      const abortController = new AbortController();
      const onComplete = jest.fn();

      await service.startPollingJob({
        jobId: 'job-123',
        prompt: 'test',
        correlationId: 'corr-456',
        pollIntervalMs: 5000,
        maxDurationMs: 60000,
        onData: jest.fn().mockResolvedValue(undefined),
        onComplete,
        signal: abortController.signal,
      });

      expect(service.isJobActive('job-123')).toBe(true);

      // Trigger abort
      abortController.abort();

      // Advance time to trigger poll check
      await jest.runAllTimersAsync();

      expect(service.isJobActive('job-123')).toBe(false);

      jest.useRealTimers();
    });

    it('should continue polling despite fetch errors', async () => {
      // First call succeeds, second fails, third succeeds
      mockSearchPostsSince
        .mockResolvedValueOnce({ posts: [], cursor: undefined, hitsTotal: 0 })
        .mockRejectedValueOnce(new Error('API error'))
        .mockResolvedValueOnce({ posts: [], cursor: undefined, hitsTotal: 0 });

      jest.useFakeTimers();

      const onData = jest.fn().mockResolvedValue(undefined);

      await service.startPollingJob({
        jobId: 'job-123',
        prompt: 'test',
        correlationId: 'corr-456',
        pollIntervalMs: 5000,
        maxDurationMs: 60000,
        onData,
        onComplete: jest.fn(),
      });

      // Initial fetch
      expect(mockSearchPostsSince).toHaveBeenCalledTimes(1);

      // Advance time - error should be logged but not thrown
      await jest.advanceTimersByTimeAsync(5000);
      expect(mockSearchPostsSince).toHaveBeenCalledTimes(2);

      // Should continue polling despite error
      await jest.advanceTimersByTimeAsync(5000);
      expect(mockSearchPostsSince).toHaveBeenCalledTimes(3);

      // Job should still be active
      expect(service.isJobActive('job-123')).toBe(true);

      await service.stopPollingJob('job-123');
    });

    it('should handle multiple concurrent jobs', async () => {
      mockSearchPostsSince.mockResolvedValue({
        posts: [],
        cursor: undefined,
        hitsTotal: 0,
      });

      jest.useFakeTimers();

      const baseConfig = {
        prompt: 'test',
        correlationId: 'corr',
        pollIntervalMs: 5000,
        maxDurationMs: 60000,
        onData: jest.fn().mockResolvedValue(undefined),
        onComplete: jest.fn(),
      };

      await service.startPollingJob({ ...baseConfig, jobId: 'job-1' });
      await service.startPollingJob({ ...baseConfig, jobId: 'job-2' });
      await service.startPollingJob({ ...baseConfig, jobId: 'job-3' });

      expect(service.getActiveJobCount()).toBe(3);
      expect(service.isJobActive('job-1')).toBe(true);
      expect(service.isJobActive('job-2')).toBe(true);
      expect(service.isJobActive('job-3')).toBe(true);

      await service.stopPollingJob('job-2');

      expect(service.getActiveJobCount()).toBe(2);
      expect(service.isJobActive('job-1')).toBe(true);
      expect(service.isJobActive('job-2')).toBe(false);
      expect(service.isJobActive('job-3')).toBe(true);

      // Cleanup
      await service.stopPollingJob('job-1');
      await service.stopPollingJob('job-3');
    });
  });

  describe('stopPollingJob', () => {
    it('should stop an active job', async () => {
      mockSearchPostsSince.mockResolvedValue({
        posts: [],
        cursor: undefined,
        hitsTotal: 0,
      });

      jest.useFakeTimers();

      const config: PollingConfig = {
        jobId: 'job-123',
        prompt: 'test',
        correlationId: 'corr-456',
        pollIntervalMs: 5000,
        maxDurationMs: 60000,
        onData: jest.fn().mockResolvedValue(undefined),
        onComplete: jest.fn(),
      };

      await service.startPollingJob(config);
      expect(service.isJobActive('job-123')).toBe(true);

      await service.stopPollingJob('job-123');
      expect(service.isJobActive('job-123')).toBe(false);
      expect(service.getActiveJobCount()).toBe(0);
    });

    it('should handle stopping non-existent job gracefully', async () => {
      await expect(async () => {
        await service.stopPollingJob('non-existent');
      }).resolves.not.toThrow();
    });

    it('should not poll after being stopped', async () => {
      mockSearchPostsSince.mockResolvedValue({
        posts: [],
        cursor: undefined,
        hitsTotal: 0,
      });

      jest.useFakeTimers();

      await service.startPollingJob({
        jobId: 'job-123',
        prompt: 'test',
        correlationId: 'corr-456',
        pollIntervalMs: 5000,
        maxDurationMs: 60000,
        onData: jest.fn().mockResolvedValue(undefined),
        onComplete: jest.fn(),
      });

      // Initial fetch
      expect(mockSearchPostsSince).toHaveBeenCalledTimes(1);

      // Stop the job
      await service.stopPollingJob('job-123');

      // Advance time - should NOT trigger more polls
      await jest.advanceTimersByTimeAsync(10000);
      expect(mockSearchPostsSince).toHaveBeenCalledTimes(1);
    });
  });

  describe('isJobActive', () => {
    it('should return false for non-existent job', () => {
      expect(service.isJobActive('non-existent')).toBe(false);
    });
  });
});
