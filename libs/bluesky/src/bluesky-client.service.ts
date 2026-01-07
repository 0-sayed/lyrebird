import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AtpAgent } from '@atproto/api';
import { BlueskyPost, SearchPostsOptions, SearchPostsResult } from './types';

@Injectable()
export class BlueskyClientService implements OnModuleInit {
  private readonly logger = new Logger(BlueskyClientService.name);
  private readonly agent: AtpAgent;
  private readonly identifier: string;
  private readonly password: string;
  private isAuthenticated = false;

  constructor(private readonly configService: ConfigService) {
    // Initialize agent pointing to Bluesky's main PDS
    this.agent = new AtpAgent({
      service: 'https://bsky.social',
    });

    // Get credentials from environment
    this.identifier = this.configService.get<string>('BLUESKY_IDENTIFIER', '');
    this.password = this.configService.get<string>('BLUESKY_APP_PASSWORD', '');

    if (this.identifier) {
      this.logger.log(`Bluesky client initialized for: ${this.identifier}`);
    } else {
      this.logger.warn(
        'Bluesky identifier not configured. Set BLUESKY_IDENTIFIER env var.',
      );
    }
  }

  async onModuleInit(): Promise<void> {
    // Optionally authenticate on startup
    // await this.ensureAuthenticated();
  }

  /**
   * Ensure we're authenticated before making API calls
   * Uses lazy authentication - only authenticates when needed
   */
  private async ensureAuthenticated(): Promise<void> {
    if (this.isAuthenticated) {
      // Check if session is still valid
      if (this.agent.session) {
        return;
      }
      // Session expired, need to re-authenticate
      this.logger.warn('Session expired, re-authenticating');
      this.isAuthenticated = false;
    }

    if (!this.identifier || !this.password) {
      throw new Error(
        'Bluesky credentials not configured. Set BLUESKY_IDENTIFIER and BLUESKY_APP_PASSWORD',
      );
    }

    try {
      this.logger.log(`Authenticating with Bluesky as: ${this.identifier}`);

      await this.agent.login({
        identifier: this.identifier,
        password: this.password,
      });

      this.isAuthenticated = true;
      this.logger.log('Successfully authenticated with Bluesky');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Bluesky authentication failed: ${message}`);
      throw new Error(`Bluesky authentication failed: ${message}`);
    }
  }

  /**
   * Search Bluesky posts by keyword
   *
   * @param query - Search query string
   * @param options - Optional search parameters
   * @returns Search results with posts and cursor for pagination
   */
  async searchPosts(
    query: string,
    options: SearchPostsOptions = {},
  ): Promise<SearchPostsResult> {
    await this.ensureAuthenticated();

    try {
      this.logger.debug(`Searching Bluesky for: "${query}"`);

      const response = await this.agent.app.bsky.feed.searchPosts({
        q: query,
        limit: options.limit ?? 25,
        cursor: options.cursor,
        sort: options.sort,
        since: options.since,
        until: options.until,
        lang: options.lang,
      });

      const posts: BlueskyPost[] = response.data.posts.reduce<BlueskyPost[]>(
        (acc, post) => {
          const record = post.record as {
            text?: string;
            createdAt?: string;
            langs?: string[];
          };

          // Skip posts with missing createdAt field to prevent data corruption
          if (!record.createdAt) {
            this.logger.warn(
              `Skipping post ${post.uri} due to missing createdAt field`,
            );
            return acc;
          }

          acc.push({
            uri: post.uri,
            cid: post.cid,
            author: {
              did: post.author.did,
              handle: post.author.handle,
              displayName: post.author.displayName,
              avatar: post.author.avatar,
            },
            record: {
              text: record.text ?? '',
              createdAt: record.createdAt,
              langs: record.langs,
            },
            likeCount: post.likeCount,
            repostCount: post.repostCount,
            replyCount: post.replyCount,
            indexedAt: post.indexedAt,
          });

          return acc;
        },
        [],
      );

      this.logger.debug(`Found ${posts.length} posts for query: "${query}"`);

      return {
        posts,
        cursor: response.data.cursor,
        hitsTotal: response.data.hitsTotal,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Bluesky search failed: ${message}`);
      throw new Error(`Bluesky search failed: ${message}`);
    }
  }

  /**
   * Search for posts created after a specific timestamp
   * Used for polling/incremental updates
   *
   * @param query - Search query string
   * @param since - Only return posts after this date
   * @param options - Additional search options
   */
  async searchPostsSince(
    query: string,
    since: Date,
    options: SearchPostsOptions = {},
  ): Promise<SearchPostsResult> {
    return this.searchPosts(query, {
      ...options,
      since: since.toISOString(),
    });
  }

  /**
   * Convert AT Protocol URI to bsky.app URL
   *
   * @param post - Bluesky post object
   * @returns Human-readable bsky.app URL
   */
  buildPostUrl(post: BlueskyPost): string {
    const postId = post.uri.split('/').pop();
    return `https://bsky.app/profile/${post.author.handle}/post/${postId}`;
  }

  /**
   * Check if the client is ready to make API calls
   */
  isReady(): boolean {
    return Boolean(this.identifier && this.password);
  }

  /**
   * Get the authenticated state
   */
  getAuthState(): { isAuthenticated: boolean; identifier: string } {
    return {
      isAuthenticated: this.isAuthenticated,
      identifier: this.identifier,
    };
  }
}
