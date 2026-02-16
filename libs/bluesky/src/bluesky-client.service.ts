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

  // Conservative fallback session duration if JWT decoding fails
  private static readonly DEFAULT_SESSION_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours
  // API timeout for search requests
  private static readonly API_TIMEOUT_MS = 15000;

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
   * Extract expiry timestamp from a JWT's exp claim.
   * Falls back to a conservative default if parsing fails.
   *
   * @param jwt - The JWT string to parse
   * @returns Date when the session expires
   */
  private extractJwtExpiry(jwt: string | undefined): Date {
    if (!jwt) {
      this.logger.warn(
        'No JWT provided for expiry extraction, using default duration',
      );
      return new Date(
        Date.now() + BlueskyClientService.DEFAULT_SESSION_DURATION_MS,
      );
    }

    try {
      // JWT format: header.payload.signature
      // We only need the payload (second part)
      const parts = jwt.split('.');
      if (parts.length !== 3 || !parts[1]) {
        this.logger.warn('Invalid JWT format, using default session duration');
        return new Date(
          Date.now() + BlueskyClientService.DEFAULT_SESSION_DURATION_MS,
        );
      }

      // Decode base64url payload
      const payloadB64 = parts[1];
      // Handle base64url encoding (replace - with +, _ with /)
      const payloadJson = Buffer.from(
        payloadB64.replace(/-/g, '+').replace(/_/g, '/'),
        'base64',
      ).toString('utf-8');

      const payload = JSON.parse(payloadJson) as { exp?: number };

      if (typeof payload.exp !== 'number') {
        this.logger.warn(
          'JWT payload missing exp claim, using default session duration',
        );
        return new Date(
          Date.now() + BlueskyClientService.DEFAULT_SESSION_DURATION_MS,
        );
      }

      // JWT exp is in seconds since epoch, convert to milliseconds
      const expiryDate = new Date(payload.exp * 1000);

      // Sanity check: if expiry is in the past or too far in the future (>30 days),
      // use default duration instead
      const now = Date.now();
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      if (expiryDate.getTime() <= now) {
        this.logger.warn('JWT expiry is in the past, using default duration');
        return new Date(now + BlueskyClientService.DEFAULT_SESSION_DURATION_MS);
      }
      if (expiryDate.getTime() > now + thirtyDaysMs) {
        this.logger.warn(
          'JWT expiry is unexpectedly far in the future (>30 days), using default duration',
        );
        return new Date(now + BlueskyClientService.DEFAULT_SESSION_DURATION_MS);
      }

      this.logger.debug(
        `JWT expires at: ${expiryDate.toISOString()} (${Math.round((expiryDate.getTime() - now) / 60000)} minutes from now)`,
      );
      return expiryDate;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(
        `Failed to parse JWT expiry (${message}), using default session duration`,
      );
      return new Date(
        Date.now() + BlueskyClientService.DEFAULT_SESSION_DURATION_MS,
      );
    }
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

      // Extract session expiry from JWT's exp claim
      // AT Protocol JWTs contain a standard exp (expiration) claim
      this.sessionExpiresAt = this.extractJwtExpiry(
        this.agent.session?.accessJwt,
      );

      // Clear credentials from memory after successful authentication
      // Re-authentication will require re-reading from config
      this.password = '';

      this.logger.log(
        'Successfully authenticated with Bluesky (credentials cleared from memory)',
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Bluesky authentication failed: ${message}`);
      throw new Error(`Bluesky authentication failed: ${message}`, {
        cause: error,
      });
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

      // Use AbortSignal.timeout to properly cancel the underlying HTTP request
      // when the timeout expires, rather than just racing with the promise.
      const signal = AbortSignal.timeout(BlueskyClientService.API_TIMEOUT_MS);

      const response = await this.agent.app.bsky.feed.searchPosts(
        {
          q: query,
          limit: options.limit ?? 25,
          cursor: options.cursor,
          sort: options.sort,
          since: options.since,
          until: options.until,
          lang: options.lang,
        },
        { signal },
      );

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
      // Handle abort/timeout errors specifically
      if (error instanceof Error && error.name === 'TimeoutError') {
        const message = `Bluesky API request timed out after ${BlueskyClientService.API_TIMEOUT_MS}ms`;
        this.logger.error(message);
        throw new Error(message, { cause: error });
      }

      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Bluesky search failed: ${message}`);
      throw new Error(`Bluesky search failed: ${message}`, { cause: error });
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
   * Check if the client is ready to make API calls.
   * Returns true if either:
   * - Already authenticated with a valid session, OR
   * - Has credentials available for authentication
   *
   * Note: Password is cleared from memory after successful authentication
   * for security. Re-authentication fetches credentials from ConfigService.
   */
  isReady(): boolean {
    // If authenticated with a non-expired session, we're ready
    if (
      this.isAuthenticated &&
      this.sessionExpiresAt &&
      new Date() < this.sessionExpiresAt
    ) {
      return true;
    }
    // Otherwise, check if we can authenticate
    // Both identifier and password must be available (password is fetched from config if cleared)
    if (!this.identifier) {
      return false;
    }
    // Check if password is available (either in memory or in ConfigService)
    const hasPassword =
      !!this.password ||
      !!this.configService.get<string>('BLUESKY_APP_PASSWORD', '');
    return hasPassword;
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
