import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BlueskyClientService } from './bluesky-client.service';
import { BlueskyPost } from './types';

// Mock the @atproto/api module
const mockLogin = jest.fn();
const mockSearchPosts = jest.fn();

// Mock agent instance that will be returned by AtpAgent constructor
const mockAgentInstance = {
  login: mockLogin,
  app: {
    bsky: {
      feed: {
        searchPosts: mockSearchPosts,
      },
    },
  },
  session: undefined as
    | { did: string; handle: string; accessJwt?: string }
    | undefined,
};

jest.mock('@atproto/api', () => {
  return {
    AtpAgent: jest.fn().mockImplementation(() => mockAgentInstance),
  };
});

describe('BlueskyClientService', () => {
  let service: BlueskyClientService;
  let module: TestingModule;

  const mockConfig = {
    BLUESKY_IDENTIFIER: 'test.bsky.social',
    BLUESKY_APP_PASSWORD: 'test-app-password',
  };

  beforeEach(async () => {
    // Reset mocks
    mockLogin.mockReset();
    mockSearchPosts.mockReset();
    mockAgentInstance.session = undefined;

    module = await Test.createTestingModule({
      providers: [
        BlueskyClientService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              return mockConfig[key as keyof typeof mockConfig] ?? defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<BlueskyClientService>(BlueskyClientService);
    // Initialize module to trigger lifecycle hooks
    await module.init();
  });

  afterEach(async () => {
    // Close module to trigger cleanup
    await module.close();
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should initialize with correct identifier', () => {
      const authState = service.getAuthState();
      expect(authState.identifier).toBe('test.bsky.social');
      expect(authState.isAuthenticated).toBe(false);
    });

    it('should report ready when credentials are configured', () => {
      expect(service.isReady()).toBe(true);
    });
  });

  describe('authenticate', () => {
    it('should authenticate with Bluesky on first API call', async () => {
      mockLogin.mockResolvedValueOnce({});
      mockSearchPosts.mockResolvedValueOnce({
        data: {
          posts: [],
          cursor: undefined,
          hitsTotal: 0,
        },
      });

      await service.searchPosts('test');

      expect(mockLogin).toHaveBeenCalledWith({
        identifier: 'test.bsky.social',
        password: 'test-app-password',
      });
    });

    it('should not re-authenticate if already authenticated', async () => {
      mockLogin.mockResolvedValueOnce({});
      mockSearchPosts.mockResolvedValue({
        data: {
          posts: [],
          cursor: undefined,
          hitsTotal: 0,
        },
      });

      // First call - should authenticate
      await service.searchPosts('test1');
      expect(mockLogin).toHaveBeenCalledTimes(1);

      // Set session after login to simulate successful authentication
      mockAgentInstance.session = {
        did: 'test-did',
        handle: 'test.bsky.social',
        accessJwt: 'test-jwt-token',
      };
      // Set session expiry to avoid re-authentication
      // Using Reflect to set private properties for testing
      Reflect.set(
        service,
        'sessionExpiresAt',
        new Date(Date.now() + 2 * 60 * 60 * 1000),
      );
      Reflect.set(service, 'isAuthenticated', true);

      // Second call - should not authenticate again
      await service.searchPosts('test2');
      expect(mockLogin).toHaveBeenCalledTimes(1);
    });

    it('should throw error if authentication fails', async () => {
      mockLogin.mockRejectedValueOnce(new Error('Invalid credentials'));

      await expect(service.searchPosts('test')).rejects.toThrow(
        'Bluesky authentication failed: Invalid credentials',
      );
    });
  });

  describe('searchPosts', () => {
    const mockPostsData = [
      {
        uri: 'at://did:plc:abc123/app.bsky.feed.post/xyz789',
        cid: 'bafyreia...',
        author: {
          did: 'did:plc:abc123',
          handle: 'testuser.bsky.social',
          displayName: 'Test User',
          avatar: 'https://cdn.bsky.app/avatar.jpg',
        },
        record: {
          text: 'This is a test post about technology!',
          createdAt: '2024-01-15T12:00:00.000Z',
          langs: ['en'],
        },
        likeCount: 10,
        repostCount: 5,
        replyCount: 2,
        indexedAt: '2024-01-15T12:00:01.000Z',
      },
      {
        uri: 'at://did:plc:def456/app.bsky.feed.post/uvw321',
        cid: 'bafyreib...',
        author: {
          did: 'did:plc:def456',
          handle: 'another.bsky.social',
          displayName: 'Another User',
        },
        record: {
          text: 'Technology is changing the world',
          createdAt: '2024-01-15T11:00:00.000Z',
        },
        likeCount: 25,
        repostCount: 12,
        replyCount: 8,
        indexedAt: '2024-01-15T11:00:02.000Z',
      },
    ];

    beforeEach(() => {
      mockLogin.mockResolvedValue({});
    });

    it('should search for posts and return results', async () => {
      mockSearchPosts.mockResolvedValueOnce({
        data: {
          posts: mockPostsData,
          cursor: 'next-page-cursor',
          hitsTotal: 100,
        },
      });

      const result = await service.searchPosts('technology');

      expect(result.posts).toHaveLength(2);
      expect(result.cursor).toBe('next-page-cursor');
      expect(result.hitsTotal).toBe(100);
    });

    it('should map post data correctly', async () => {
      mockSearchPosts.mockResolvedValueOnce({
        data: {
          posts: [mockPostsData[0]],
          cursor: undefined,
          hitsTotal: 1,
        },
      });

      const result = await service.searchPosts('technology');
      const post = result.posts[0];

      expect(post.uri).toBe('at://did:plc:abc123/app.bsky.feed.post/xyz789');
      expect(post.author.handle).toBe('testuser.bsky.social');
      expect(post.author.displayName).toBe('Test User');
      expect(post.record.text).toBe('This is a test post about technology!');
      expect(post.likeCount).toBe(10);
    });

    it('should pass search options correctly', async () => {
      mockSearchPosts.mockResolvedValueOnce({
        data: { posts: [], cursor: undefined, hitsTotal: 0 },
      });

      await service.searchPosts('test', {
        limit: 50,
        sort: 'latest',
        lang: 'en',
      });

      expect(mockSearchPosts).toHaveBeenCalledWith({
        q: 'test',
        limit: 50,
        cursor: undefined,
        sort: 'latest',
        since: undefined,
        until: undefined,
        lang: 'en',
      });
    });

    it('should use default limit of 25', async () => {
      mockSearchPosts.mockResolvedValueOnce({
        data: { posts: [], cursor: undefined, hitsTotal: 0 },
      });

      await service.searchPosts('test');

      expect(mockSearchPosts).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 25 }),
      );
    });

    it('should throw error if search fails', async () => {
      mockSearchPosts.mockRejectedValueOnce(new Error('API error'));

      await expect(service.searchPosts('test')).rejects.toThrow(
        'Bluesky search failed: API error',
      );
    });

    it('should handle empty results', async () => {
      mockSearchPosts.mockResolvedValueOnce({
        data: { posts: [], cursor: undefined, hitsTotal: 0 },
      });

      const result = await service.searchPosts('nonexistent');

      expect(result.posts).toHaveLength(0);
      expect(result.cursor).toBeUndefined();
    });
  });

  describe('searchPostsSince', () => {
    beforeEach(() => {
      mockLogin.mockResolvedValue({});
    });

    it('should include since parameter in search', async () => {
      mockSearchPosts.mockResolvedValueOnce({
        data: { posts: [], cursor: undefined, hitsTotal: 0 },
      });

      const sinceDate = new Date('2024-01-15T10:00:00.000Z');
      await service.searchPostsSince('test', sinceDate);

      expect(mockSearchPosts).toHaveBeenCalledWith(
        expect.objectContaining({
          since: '2024-01-15T10:00:00.000Z',
        }),
      );
    });
  });

  describe('buildPostUrl', () => {
    it('should convert AT URI to bsky.app URL', () => {
      const post: BlueskyPost = {
        uri: 'at://did:plc:abc123/app.bsky.feed.post/xyz789',
        cid: 'bafyreia...',
        author: {
          did: 'did:plc:abc123',
          handle: 'testuser.bsky.social',
        },
        record: {
          text: 'Test post',
          createdAt: '2024-01-15T12:00:00.000Z',
        },
        indexedAt: '2024-01-15T12:00:01.000Z',
      };

      const url = service.buildPostUrl(post);

      expect(url).toBe(
        'https://bsky.app/profile/testuser.bsky.social/post/xyz789',
      );
    });
  });
});

describe('BlueskyClientService without credentials', () => {
  let service: BlueskyClientService;
  let module: TestingModule;

  beforeEach(async () => {
    mockLogin.mockReset();
    mockSearchPosts.mockReset();

    module = await Test.createTestingModule({
      providers: [
        BlueskyClientService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(() => undefined),
          },
        },
      ],
    }).compile();

    service = module.get<BlueskyClientService>(BlueskyClientService);
    await module.init();
  });

  afterEach(async () => {
    await module.close();
  });

  it('should report not ready when credentials missing', () => {
    expect(service.isReady()).toBe(false);
  });

  it('should throw error when attempting to search without credentials', async () => {
    await expect(service.searchPosts('test')).rejects.toThrow(
      'Bluesky credentials not configured',
    );
  });
});
