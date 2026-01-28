import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  Optional,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Subject, Observable } from 'rxjs';
import WebSocket from 'ws';
import {
  JetstreamEvent,
  JetstreamCommitEvent,
  JetstreamPostEvent,
  JetstreamConnectionStatus,
  JetstreamClientOptions,
  JetstreamMetrics,
} from './jetstream-types';
import { CursorPersistenceService } from './cursor-persistence.service';

/**
 * JetstreamClientService - WebSocket client for Bluesky Jetstream API
 *
 * This service manages a single WebSocket connection to Jetstream for real-time
 * post streaming. Key features:
 *
 * - Automatic reconnection with exponential backoff
 * - Cursor persistence for replay on reconnect (Phase 5)
 * - Observable-based post event emission
 * - Comprehensive metrics tracking
 * - Graceful degradation on connection failures
 *
 * The client subscribes to 'app.bsky.feed.post' collection by default,
 * filtering for new post creation events only.
 */
@Injectable()
export class JetstreamClientService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JetstreamClientService.name);

  // WebSocket connection
  private ws: WebSocket | null = null;

  // Configuration
  private readonly options: JetstreamClientOptions;

  // Reconnection state
  private reconnectAttempts = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  // Cursor for replay
  private lastCursor: string | null = null;

  // Connection status
  private connectionStatus: JetstreamConnectionStatus = 'disconnected';
  private readonly statusSubject = new Subject<JetstreamConnectionStatus>();
  public readonly status$ = this.statusSubject.asObservable();

  // Post event stream
  private readonly postSubject = new Subject<JetstreamPostEvent>();
  public readonly posts$: Observable<JetstreamPostEvent> =
    this.postSubject.asObservable();

  // Metrics
  private messagesReceived = 0;
  private postsProcessed = 0;
  private lastMessageAt: Date | null = null;
  private metricsWindowStart = Date.now();
  private messagesInWindow = 0;

  // Max reconnect exhausted flag - for graceful degradation
  private maxReconnectExhausted = false;

  // Constants
  private static readonly POST_COLLECTION = 'app.bsky.feed.post';
  private static readonly DEFAULT_ENDPOINT =
    'wss://jetstream2.us-east.bsky.network/subscribe';
  private static readonly DEFAULT_MAX_RECONNECT_ATTEMPTS = 10;
  private static readonly DEFAULT_INITIAL_BACKOFF_MS = 1000;
  private static readonly DEFAULT_MAX_BACKOFF_MS = 60000;

  constructor(
    private readonly configService: ConfigService,
    @Optional()
    @Inject(CursorPersistenceService)
    private readonly cursorPersistence?: CursorPersistenceService,
  ) {
    this.options = this.loadOptions();
    this.logger.log(
      `JetstreamClient initialized: endpoint=${this.options.endpoint}, cursorPersistence=${this.cursorPersistence ? 'enabled' : 'disabled'}`,
    );
  }

  /**
   * Module initialization - load persisted cursor
   */
  async onModuleInit(): Promise<void> {
    if (this.cursorPersistence) {
      const persistedCursor = await this.cursorPersistence.loadCursor();
      if (persistedCursor) {
        this.lastCursor = persistedCursor;
        this.logger.log(`Loaded persisted cursor: ${persistedCursor}`);
      }
    }
  }

  /**
   * Load configuration from environment
   */
  private loadOptions(): JetstreamClientOptions {
    return {
      endpoint: this.configService.get<string>(
        'JETSTREAM_ENDPOINT',
        JetstreamClientService.DEFAULT_ENDPOINT,
      ),
      maxReconnectAttempts: this.configService.get<number>(
        'JETSTREAM_RECONNECT_MAX_ATTEMPTS',
        JetstreamClientService.DEFAULT_MAX_RECONNECT_ATTEMPTS,
      ),
      initialBackoffMs: this.configService.get<number>(
        'JETSTREAM_RECONNECT_INITIAL_BACKOFF_MS',
        JetstreamClientService.DEFAULT_INITIAL_BACKOFF_MS,
      ),
      maxBackoffMs: this.configService.get<number>(
        'JETSTREAM_RECONNECT_MAX_BACKOFF_MS',
        JetstreamClientService.DEFAULT_MAX_BACKOFF_MS,
      ),
      compress: this.configService.get<boolean>('JETSTREAM_COMPRESS', false),
      wantedCollections: [JetstreamClientService.POST_COLLECTION],
    };
  }

  /**
   * Module cleanup - close WebSocket connection and persist cursor
   */
  async onModuleDestroy(): Promise<void> {
    this.isShuttingDown = true;

    // Flush any pending cursor before disconnecting
    if (this.cursorPersistence && this.lastCursor) {
      this.logger.log('Flushing cursor before shutdown');
      await this.cursorPersistence.flush();
    }

    this.disconnect();
  }

  /**
   * Connect to Jetstream WebSocket API
   *
   * @param cursor Optional cursor to resume from (Unix microseconds)
   */
  async connect(cursor?: string): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.logger.warn('Already connected to Jetstream');
      return;
    }

    if (this.ws?.readyState === WebSocket.CONNECTING) {
      this.logger.warn('Connection already in progress');
      return;
    }

    this.setConnectionStatus('connecting');

    // Build connection URL with query parameters
    const url = this.buildConnectionUrl(cursor);
    this.logger.log(`Connecting to Jetstream: ${url}`);

    try {
      await this.establishConnection(url);
    } catch (error) {
      this.logger.error(
        `Failed to connect to Jetstream: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.setConnectionStatus('error');
      this.scheduleReconnect();
    }
  }

  /**
   * Build WebSocket URL with subscription parameters
   */
  private buildConnectionUrl(cursor?: string): string {
    const url = new URL(this.options.endpoint);

    // Add wanted collections
    for (const collection of this.options.wantedCollections) {
      url.searchParams.append('wantedCollections', collection);
    }

    // Add compression if enabled
    if (this.options.compress) {
      url.searchParams.set('compress', 'true');
    }

    // Add cursor for replay if available
    const resumeCursor = cursor ?? this.lastCursor;
    if (resumeCursor) {
      url.searchParams.set('cursor', resumeCursor);
      this.logger.log(`Resuming from cursor: ${resumeCursor}`);
    }

    return url.toString();
  }

  /**
   * Establish WebSocket connection
   */
  private async establishConnection(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url);

        // Set up event handlers
        this.ws.on('open', () => {
          this.handleOpen();
          resolve();
        });

        this.ws.on('message', (data: Buffer) => {
          this.handleMessage(data);
        });

        this.ws.on('close', (code: number, reason: Buffer) => {
          this.handleClose(code, reason.toString());
        });

        this.ws.on('error', (error: Error) => {
          this.handleError(error);
          // Only reject if we're still connecting
          if (this.connectionStatus === 'connecting') {
            reject(error);
          }
        });
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  /**
   * Handle WebSocket open event
   */
  private handleOpen(): void {
    this.setConnectionStatus('connected');
    this.reconnectAttempts = 0;
    this.logger.log('Connected to Jetstream');
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(data: Buffer): void {
    this.messagesReceived++;
    this.messagesInWindow++;
    this.lastMessageAt = new Date();

    try {
      const event = JSON.parse(data.toString()) as JetstreamEvent;

      // Update cursor for replay capability
      if (event.time_us) {
        this.lastCursor = String(event.time_us);
        // Persist cursor (batched)
        this.persistCursor(this.lastCursor);
      }

      // Process only commit events for post creation
      if (
        event.kind === 'commit' &&
        event.commit?.operation === 'create' &&
        event.commit?.collection === JetstreamClientService.POST_COLLECTION &&
        event.commit?.record?.text
      ) {
        const postEvent = this.transformToPostEvent(event);
        if (postEvent) {
          this.postsProcessed++;
          this.postSubject.next(postEvent);
        }
      }
    } catch (error) {
      this.logger.warn(
        `Failed to parse Jetstream message: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Transform raw Jetstream commit event to normalized post event
   */
  private transformToPostEvent(
    event: JetstreamCommitEvent,
  ): JetstreamPostEvent | null {
    const commit = event.commit;
    const text = commit?.record?.text;
    const rkey = commit?.rkey;
    const cid = commit?.cid;
    const collection = commit?.collection;

    // All required fields must be present
    if (!text || !rkey || !cid || !collection || !commit.record) {
      return null;
    }

    const record = commit.record;

    return {
      did: event.did,
      rkey,
      text,
      createdAt: new Date(record.createdAt),
      uri: `at://${event.did}/${collection}/${rkey}`,
      cid,
      timestamp: event.time_us,
      langs: record.langs,
      isReply: Boolean(record.reply),
    };
  }

  /**
   * Handle WebSocket close event
   */
  private handleClose(code: number, reason: string): void {
    this.logger.warn(
      `Jetstream connection closed: code=${code}, reason=${reason}`,
    );
    this.setConnectionStatus('disconnected');
    this.ws = null;

    if (!this.isShuttingDown) {
      this.scheduleReconnect();
    }
  }

  /**
   * Handle WebSocket error event
   */
  private handleError(error: Error): void {
    this.logger.error(`Jetstream WebSocket error: ${error.message}`);
    this.setConnectionStatus('error');
  }

  /**
   * Schedule a reconnection attempt with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.isShuttingDown) {
      this.logger.log('Shutdown in progress, not reconnecting');
      return;
    }

    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      this.logger.error(
        `Max reconnection attempts (${this.options.maxReconnectAttempts}) reached. Giving up.`,
      );
      this.maxReconnectExhausted = true;
      this.setConnectionStatus('error');
      return;
    }

    // Calculate backoff with jitter
    const baseBackoff = Math.min(
      this.options.initialBackoffMs * Math.pow(2, this.reconnectAttempts),
      this.options.maxBackoffMs,
    );
    // Add 0-25% jitter
    const jitter = baseBackoff * 0.25 * Math.random();
    const backoffMs = Math.round(baseBackoff + jitter);

    this.reconnectAttempts++;
    this.setConnectionStatus('reconnecting');

    this.logger.log(
      `Scheduling reconnect attempt ${this.reconnectAttempts}/${this.options.maxReconnectAttempts} in ${backoffMs}ms`,
    );

    // Clear any existing reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect().catch((error) => {
        this.logger.error(
          `Reconnection attempt failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
    }, backoffMs);
  }

  /**
   * Disconnect from Jetstream
   */
  disconnect(): void {
    this.logger.log('Disconnecting from Jetstream');

    // Clear reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // Close WebSocket
    if (this.ws) {
      try {
        if (
          this.ws.readyState === WebSocket.OPEN ||
          this.ws.readyState === WebSocket.CONNECTING
        ) {
          this.ws.close(1000, 'Client disconnect');
        }
      } catch (error) {
        this.logger.warn(
          `Error closing WebSocket: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      this.ws = null;
    }

    this.setConnectionStatus('disconnected');
  }

  /**
   * Update and emit connection status
   */
  private setConnectionStatus(status: JetstreamConnectionStatus): void {
    if (this.connectionStatus !== status) {
      this.connectionStatus = status;
      this.statusSubject.next(status);
    }
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): JetstreamConnectionStatus {
    return this.connectionStatus;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return (
      this.ws?.readyState === WebSocket.OPEN &&
      this.connectionStatus === 'connected'
    );
  }

  /**
   * Get current metrics
   */
  getMetrics(): JetstreamMetrics {
    // Calculate messages per second
    const now = Date.now();
    const windowDurationSeconds = (now - this.metricsWindowStart) / 1000;
    const messagesPerSecond =
      windowDurationSeconds > 0
        ? this.messagesInWindow / windowDurationSeconds
        : 0;

    // Reset window if over 60 seconds
    if (windowDurationSeconds > 60) {
      this.metricsWindowStart = now;
      this.messagesInWindow = 0;
    }

    return {
      messagesReceived: this.messagesReceived,
      messagesPerSecond: Math.round(messagesPerSecond * 10) / 10,
      postsProcessed: this.postsProcessed,
      connectionStatus: this.connectionStatus,
      lastCursor: this.lastCursor ?? undefined,
      reconnectAttempts: this.reconnectAttempts,
      lastMessageAt: this.lastMessageAt ?? undefined,
    };
  }

  /**
   * Get the last cursor for external persistence
   */
  getLastCursor(): string | null {
    return this.lastCursor;
  }

  /**
   * Set cursor from external persistence (e.g., on startup)
   */
  setLastCursor(cursor: string): void {
    this.lastCursor = cursor;
    this.logger.log(`Cursor set from external source: ${cursor}`);
  }

  /**
   * Reset metrics counters
   */
  resetMetrics(): void {
    this.messagesReceived = 0;
    this.postsProcessed = 0;
    this.messagesInWindow = 0;
    this.metricsWindowStart = Date.now();
  }

  /**
   * Check if max reconnect attempts have been exhausted
   *
   * Useful for graceful degradation - the caller can switch to
   * polling mode if Jetstream is unavailable.
   */
  isMaxReconnectExhausted(): boolean {
    return this.maxReconnectExhausted;
  }

  /**
   * Reset reconnect exhausted flag
   *
   * Call this after successfully reconnecting or when retrying
   * after a period of time.
   */
  resetReconnectState(): void {
    this.maxReconnectExhausted = false;
    this.reconnectAttempts = 0;
  }

  /**
   * Persist cursor to storage (batched)
   *
   * Uses the CursorPersistenceService if available.
   * Cursors are batched to reduce I/O overhead.
   */
  private persistCursor(cursor: string): void {
    if (this.cursorPersistence) {
      this.cursorPersistence.saveCursor(cursor);
    }
  }

  /**
   * Flush persisted cursor immediately
   */
  async flushCursor(): Promise<void> {
    if (this.cursorPersistence) {
      await this.cursorPersistence.flush();
    }
  }

  /**
   * Start auto-save for cursor persistence
   */
  startCursorAutoSave(): void {
    if (this.cursorPersistence) {
      this.cursorPersistence.startAutoSave();
      this.logger.log('Cursor auto-save started');
    }
  }

  /**
   * Stop auto-save for cursor persistence
   */
  stopCursorAutoSave(): void {
    if (this.cursorPersistence) {
      this.cursorPersistence.stopAutoSave();
      this.logger.log('Cursor auto-save stopped');
    }
  }
}
