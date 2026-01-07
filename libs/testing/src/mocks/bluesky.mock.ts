import type { BlueskyPost } from '@app/bluesky';

/**
 * Mock implementation of BlueskyClientService for testing
 */
export const createMockBlueskyClientService = () => ({
  searchPosts: jest.fn().mockResolvedValue({ posts: [], cursor: null }),
  searchPostsSince: jest.fn().mockResolvedValue({ posts: [], cursor: null }),
  buildPostUrl: jest
    .fn()
    .mockImplementation(
      (post: BlueskyPost) =>
        `https://bsky.app/profile/${post.author.handle}/post/${post.uri.split('/').pop()}`,
    ),
  onModuleInit: jest.fn(),
});
