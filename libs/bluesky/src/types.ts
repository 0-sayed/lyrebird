/**
 * Bluesky API Types
 *
 * Type definitions for Bluesky/AT Protocol integration
 */

export interface BlueskyCredentials {
  identifier: string;
  password: string;
}

export interface BlueskyPost {
  uri: string;
  cid: string;
  author: {
    did: string;
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  record: {
    text: string;
    createdAt: string;
    langs?: string[];
  };
  likeCount?: number;
  repostCount?: number;
  replyCount?: number;
  indexedAt: string;
}

export interface SearchPostsOptions {
  limit?: number;
  cursor?: string;
  sort?: 'top' | 'latest';
  since?: string;
  until?: string;
  lang?: string;
}

export interface SearchPostsResult {
  posts: BlueskyPost[];
  cursor?: string;
  hitsTotal?: number;
}
