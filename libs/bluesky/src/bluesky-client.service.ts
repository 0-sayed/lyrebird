import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AtpAgent } from '@atproto/api';
import { BlueskyPost, SearchPostsOptions, SearchPostsResult } from './types';

@Injectable()
export class BlueskyClientService implements OnModuleInit {
  private readonly logger = new Logger(BlueskyClientService.name);
  private readonly agent: AtpAgent;
  private identifier: string;
  private password: string;
  private isAuthenticated = false;
  private sessionExpiresAt?: Date;

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
      // Check if session is still valid and not expired
      if (this.agent.session?.accessJwt) {
        // Check expiry time if available
        if (this.sessionExpiresAt && new Date() < this.sessionExpiresAt) {
          return; // Session is valid and not expired
        }
        // Try to refresh session or re-authenticate
        this.logger.warn('Session may be expired, re-authenticating');
      }
      this.isAuthenticated = false;
    }

    // Re-fetch password from config if cleared after previous auth
    if (!this.password) {
      this.password = this.configService.get<string>(
        'BLUESKY_APP_PASSWORD',
        '',
      );
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

      // Set session expiry (AT Protocol sessions typically last 2-4 hours)
      // Conservative estimate: 2 hours
      this.sessionExpiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

      // Clear credentials from memory after successful authentication
      // Re-authentication will require re-reading from config
      this.password = '';

      this.logger.log(
        'Successfully authenticated with Bluesky (credentials cleared from memory)',
      );
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

    // Track timeout ID to clear it after request completes
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    try {
      this.logger.debug(`Searching Bluesky for: "${query}"`);

      // Add timeout to prevent hanging on API calls
      // Use a clearable timeout to avoid keeping Node.js process alive
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () =>
            reject(new Error('Bluesky API request timed out after 15 seconds')),
          15000,
        );
      });

      const response = await Promise.race([
        this.agent.app.bsky.feed.searchPosts({
          q: query,
          limit: options.limit ?? 25,
          cursor: options.cursor,
          sort: options.sort,
          since: options.since,
          until: options.until,
          lang: options.lang,
        }),
        timeoutPromise,
      ]);

      const posts: BlueskyPost[] = response.data.posts.reduce<BlueskyPost[]>(
        (acc, post) => {
          // Validate post structure before type assertion
          if (!post.record || typeof post.record !== 'object') {
            this.logger.warn(
              `Skipping post ${post.uri} due to invalid record structure`,
            );
            return acc;
          }

          const record = post.record as {
            text?: string;
            createdAt?: string;
            langs?: string[];
          };

          // Validate required fields
          if (!record.createdAt || typeof record.createdAt !== 'string') {
            this.logger.warn(
              `Skipping post ${post.uri} due to missing or invalid createdAt field`,
            );
            return acc;
          }

          // Validate text field
          if (record.text !== undefined && typeof record.text !== 'string') {
            this.logger.warn(
              `Skipping post ${post.uri} due to invalid text field type`,
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
    } finally {
      // Always clear the timeout to prevent keeping the Node.js process alive
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
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
    const segments = post.uri.split('/');
    const postId = segments[segments.length - 1];

    if (!postId) {
      this.logger.warn(
        `Unable to extract postId from URI "${post.uri}" for author "${post.author.handle}". Falling back to profile URL.`,
      );
      return `https://bsky.app/profile/${post.author.handle}`;
    }

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
