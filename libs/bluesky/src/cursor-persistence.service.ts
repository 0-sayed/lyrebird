import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Persistence backend types supported by CursorPersistenceService
 */
export type CursorPersistenceBackend = 'memory' | 'file' | 'redis';

/**
 * Base configuration shared by all persistence backends
 */
interface CursorPersistenceConfigBase {
  /** Auto-save interval in milliseconds */
  autoSaveIntervalMs?: number;
}

/**
 * Configuration for in-memory cursor persistence (development/testing)
 */
interface MemoryPersistenceConfig extends CursorPersistenceConfigBase {
  backend: 'memory';
}

/**
 * Configuration for file-based cursor persistence
 */
interface FilePersistenceConfig extends CursorPersistenceConfigBase {
  backend: 'file';
  /** File path where cursor will be stored */
  filePath: string;
}

/**
 * Configuration for Redis-based cursor persistence (not yet implemented)
 */
interface RedisPersistenceConfig extends CursorPersistenceConfigBase {
  backend: 'redis';
  /** Redis connection URL */
  redisUrl: string;
  /** Redis key prefix */
  redisKeyPrefix?: string;
}

/**
 * Discriminated union for cursor persistence configuration.
 * Each backend type has exactly the required properties for that backend.
 */
export type CursorPersistenceConfig =
  | MemoryPersistenceConfig
  | FilePersistenceConfig
  | RedisPersistenceConfig;

/**
 * Cursor data structure
 */
export interface CursorData {
  /** Cursor value (Unix microseconds) */
  cursor: string;
  /** When the cursor was saved */
  savedAt: Date;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * CursorPersistenceService - Manages Jetstream cursor persistence
 *
 * This service provides cursor persistence across restarts to enable
 * "replay" of missed posts. It supports multiple backends:
 *
 * - **memory**: In-memory storage (for development/testing)
 * - **file**: File-based storage (simple, no external dependencies)
 * - **redis**: Redis-based storage (for production with multiple instances)
 *
 * The cursor represents the last processed event's timestamp in Unix
 * microseconds. On reconnect, this cursor is passed to Jetstream to
 * resume from where we left off.
 *
 * Usage:
 * ```typescript
 * // Save cursor periodically
 * await persistence.saveCursor('1737000000000000');
 *
 * // Load cursor on startup
 * const cursor = await persistence.loadCursor();
 * await jetstreamClient.connect(cursor);
 * ```
 */
@Injectable()
export class CursorPersistenceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CursorPersistenceService.name);

  // Configuration
  private readonly config: CursorPersistenceConfig;

  // In-memory storage
  private memoryCursor: CursorData | null = null;

  // Auto-save interval
  private autoSaveInterval: NodeJS.Timeout | null = null;
  private pendingCursor: string | null = null;
  private lastSavedCursor: string | null = null;

  // Redis client (lazy loaded)
  private redisClient: RedisLikeClient | null = null;

  // Constants
  private static readonly DEFAULT_BACKEND: CursorPersistenceBackend = 'memory';
  private static readonly DEFAULT_FILE_PATH = './data/jetstream-cursor.json';
  private static readonly DEFAULT_REDIS_KEY_PREFIX = 'lyrebird:jetstream:';
  private static readonly DEFAULT_AUTO_SAVE_INTERVAL_MS = 5000;

  constructor(private readonly configService: ConfigService) {
    this.config = this.loadConfig();
    this.logger.log(
      `CursorPersistence initialized: backend=${this.config.backend}`,
    );
  }

  /**
   * Load configuration from environment
   */
  private loadConfig(): CursorPersistenceConfig {
    const backend = this.configService.get<CursorPersistenceBackend>(
      'JETSTREAM_CURSOR_PERSISTENCE',
      CursorPersistenceService.DEFAULT_BACKEND,
    );

    const autoSaveIntervalMs = this.configService.get<number>(
      'JETSTREAM_CURSOR_AUTO_SAVE_MS',
      CursorPersistenceService.DEFAULT_AUTO_SAVE_INTERVAL_MS,
    );

    switch (backend) {
      case 'file':
        return {
          backend: 'file',
          filePath: this.configService.get<string>(
            'JETSTREAM_CURSOR_FILE_PATH',
            CursorPersistenceService.DEFAULT_FILE_PATH,
          ),
          autoSaveIntervalMs,
        };

      case 'redis':
        return {
          backend: 'redis',
          redisUrl: this.configService.get<string>(
            'REDIS_URL',
            'redis://localhost:6379',
          ),
          redisKeyPrefix: this.configService.get<string>(
            'JETSTREAM_CURSOR_REDIS_PREFIX',
            CursorPersistenceService.DEFAULT_REDIS_KEY_PREFIX,
          ),
          autoSaveIntervalMs,
        };

      case 'memory':
      default:
        return {
          backend: 'memory',
          autoSaveIntervalMs,
        };
    }
  }

  /**
   * Module initialization
   */
  async onModuleInit(): Promise<void> {
    // Initialize Redis client if needed
    if (this.config.backend === 'redis') {
      this.initializeRedis();
    }

    // Ensure file directory exists if using file backend
    if (this.config.backend === 'file') {
      const dir = path.dirname(this.config.filePath);
      try {
        await fs.promises.mkdir(dir, { recursive: true });
      } catch (error) {
        const nodeError = error as NodeJS.ErrnoException;
        if (nodeError.code !== 'EEXIST') {
          this.logger.error(
            `Failed to create cursor directory ${dir}: ${error instanceof Error ? error.message : String(error)}`,
          );
          throw error;
        }
      }
    }
  }

  /**
   * Module cleanup
   */
  async onModuleDestroy(): Promise<void> {
    // Stop auto-save
    this.stopAutoSave();

    // Final flush
    if (this.pendingCursor) {
      await this.flush();
    }

    // Close Redis connection
    if (this.redisClient) {
      try {
        await this.redisClient.quit();
      } catch (error) {
        this.logger.debug(
          `Redis quit during shutdown: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      this.redisClient = null;
    }
  }

  /**
   * Get current backend type
   */
  getBackend(): CursorPersistenceBackend {
    return this.config.backend;
  }

  /**
   * Save cursor (batched with auto-save interval)
   *
   * Cursors are batched to reduce I/O. Call flush() to immediately persist.
   *
   * @param cursor - Cursor value to save
   */
  saveCursor(cursor: string): void {
    this.pendingCursor = cursor;
  }

  /**
   * Save cursor immediately (no batching)
   *
   * @param cursor - Cursor value to save
   */
  async saveCursorImmediate(cursor: string): Promise<void> {
    this.pendingCursor = cursor;
    await this.flush();
  }

  /**
   * Load the last saved cursor
   *
   * @returns The cursor if found, null otherwise
   */
  async loadCursor(): Promise<string | null> {
    try {
      switch (this.config.backend) {
        case 'memory':
          return this.loadFromMemory();

        case 'file':
          return await this.loadFromFile();

        case 'redis':
          return await this.loadFromRedis();

        default:
          return null;
      }
    } catch (error) {
      this.logger.error(
        `Failed to load cursor: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /**
   * Load full cursor data with metadata
   */
  async loadCursorData(): Promise<CursorData | null> {
    try {
      switch (this.config.backend) {
        case 'memory':
          return this.memoryCursor;

        case 'file':
          return await this.loadDataFromFile();

        case 'redis':
          return await this.loadDataFromRedis();

        default:
          return null;
      }
    } catch (error) {
      this.logger.error(
        `Failed to load cursor data: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /**
   * Clear the saved cursor
   */
  async clearCursor(): Promise<void> {
    this.pendingCursor = null;
    this.lastSavedCursor = null;

    try {
      switch (this.config.backend) {
        case 'memory':
          this.memoryCursor = null;
          break;

        case 'file':
          await this.clearFile();
          break;

        case 'redis':
          await this.clearRedis();
          break;
      }

      this.logger.log('Cursor cleared');
    } catch (error) {
      this.logger.error(
        `Failed to clear cursor: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Start auto-save interval
   */
  startAutoSave(): void {
    if (this.autoSaveInterval) {
      return;
    }

    this.autoSaveInterval = setInterval(() => {
      void this.flush();
    }, this.config.autoSaveIntervalMs);

    this.logger.debug(
      `Auto-save started: interval=${this.config.autoSaveIntervalMs}ms`,
    );
  }

  /**
   * Stop auto-save interval
   */
  stopAutoSave(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
      this.logger.debug('Auto-save stopped');
    }
  }

  /**
   * Flush pending cursor to storage
   */
  async flush(): Promise<void> {
    if (!this.pendingCursor || this.pendingCursor === this.lastSavedCursor) {
      return;
    }

    const cursor = this.pendingCursor;

    try {
      switch (this.config.backend) {
        case 'memory':
          this.saveToMemory(cursor);
          break;

        case 'file':
          await this.saveToFile(cursor);
          break;

        case 'redis':
          await this.saveToRedis(cursor);
          break;
      }

      this.lastSavedCursor = cursor;
      this.logger.debug(`Cursor persisted: ${cursor}`);
    } catch (error) {
      this.logger.error(
        `Failed to persist cursor: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Check if auto-save is running
   */
  isAutoSaveRunning(): boolean {
    return this.autoSaveInterval !== null;
  }

  /**
   * Get the last saved cursor (from memory)
   */
  getLastSavedCursor(): string | null {
    return this.lastSavedCursor;
  }

  /**
   * Get the pending (unsaved) cursor
   */
  getPendingCursor(): string | null {
    return this.pendingCursor;
  }

  // ====================
  // Memory Backend
  // ====================

  private saveToMemory(cursor: string): void {
    this.memoryCursor = {
      cursor,
      savedAt: new Date(),
    };
  }

  private loadFromMemory(): string | null {
    return this.memoryCursor?.cursor ?? null;
  }

  // ====================
  // File Backend
  // ====================

  private async saveToFile(cursor: string): Promise<void> {
    // Type assertion: this method is only called when backend === 'file'
    const config = this.config as FilePersistenceConfig;

    const data: CursorData = {
      cursor,
      savedAt: new Date(),
    };

    await fs.promises.writeFile(
      config.filePath,
      JSON.stringify(data, null, 2),
      'utf-8',
    );
  }

  private async loadFromFile(): Promise<string | null> {
    const data = await this.loadDataFromFile();
    return data?.cursor ?? null;
  }

  private async loadDataFromFile(): Promise<CursorData | null> {
    // Type assertion: this method is only called when backend === 'file'
    const config = this.config as FilePersistenceConfig;

    try {
      const content = await fs.promises.readFile(config.filePath, 'utf-8');
      const data = JSON.parse(content) as CursorData;
      return {
        ...data,
        savedAt: new Date(data.savedAt),
      };
    } catch (error) {
      // File doesn't exist or is invalid
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  private async clearFile(): Promise<void> {
    // Type assertion: this method is only called when backend === 'file'
    const config = this.config as FilePersistenceConfig;

    try {
      await fs.promises.unlink(config.filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  // ====================
  // Redis Backend
  // ====================

  private initializeRedis(): void {
    // Redis backend is not yet implemented - fail fast rather than silently
    // using an in-memory mock that would give users false confidence
    throw new Error(
      'Redis cursor persistence is not yet implemented. ' +
        'Please use "file" or "memory" backend. ' +
        'Set CURSOR_PERSISTENCE_BACKEND=file or CURSOR_PERSISTENCE_BACKEND=memory in environment.',
    );
  }

  private async saveToRedis(cursor: string): Promise<void> {
    if (!this.redisClient) {
      throw new Error('Redis client not initialized');
    }

    // Type assertion: this method is only called when backend === 'redis'
    const config = this.config as RedisPersistenceConfig;
    const key = `${config.redisKeyPrefix ?? CursorPersistenceService.DEFAULT_REDIS_KEY_PREFIX}cursor`;
    const data: CursorData = {
      cursor,
      savedAt: new Date(),
    };

    await this.redisClient.set(key, JSON.stringify(data));
  }

  private async loadFromRedis(): Promise<string | null> {
    const data = await this.loadDataFromRedis();
    return data?.cursor ?? null;
  }

  private async loadDataFromRedis(): Promise<CursorData | null> {
    if (!this.redisClient) {
      return null;
    }

    // Type assertion: this method is only called when backend === 'redis'
    const config = this.config as RedisPersistenceConfig;
    const key = `${config.redisKeyPrefix ?? CursorPersistenceService.DEFAULT_REDIS_KEY_PREFIX}cursor`;
    const value = await this.redisClient.get(key);

    if (!value) {
      return null;
    }

    const data = JSON.parse(value) as CursorData;
    return {
      ...data,
      savedAt: new Date(data.savedAt),
    };
  }

  private async clearRedis(): Promise<void> {
    if (!this.redisClient) {
      return;
    }

    // Type assertion: this method is only called when backend === 'redis'
    const config = this.config as RedisPersistenceConfig;
    const key = `${config.redisKeyPrefix ?? CursorPersistenceService.DEFAULT_REDIS_KEY_PREFIX}cursor`;
    await this.redisClient.del(key);
  }
}

/**
 * Interface for Redis-like client
 *
 * Note: Redis backend is not yet implemented. This interface is kept
 * for future implementation with 'ioredis' or 'redis' package.
 */
interface RedisLikeClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  del(key: string): Promise<void>;
  quit(): Promise<void>;
}
