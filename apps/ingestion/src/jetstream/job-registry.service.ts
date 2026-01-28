import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { RawDataMessage } from '@app/shared-types';
import {
  STOP_WORDS,
  WORD_BOUNDARY_CHARS,
  VALID_KEYWORD_PATTERN,
  HASHTAG_PATTERN,
  JETSTREAM_CONSTANTS,
} from './jetstream.constants';

/**
 * Configuration for registering a new job
 */
export interface RegisterJobConfig {
  /** Unique job identifier */
  jobId: string;
  /** Original user search prompt */
  prompt: string;
  /** Correlation ID for distributed tracing */
  correlationId: string;
  /** Maximum job duration in milliseconds */
  maxDurationMs: number;
  /** Callback for each matching data item */
  onData: (data: RawDataMessage) => Promise<void>;
  /** Callback when job completes */
  onComplete: (count: number) => void;
}

/**
 * Represents an active job in the registry
 */
export interface RegisteredJob {
  /** Unique job identifier */
  jobId: string;
  /** Original user search prompt */
  prompt: string;
  /** Extracted keywords for matching */
  keywords: string[];
  /** Compiled regex pattern for fast matching */
  regexPattern: RegExp;
  /** Correlation ID for distributed tracing */
  correlationId: string;
  /** When the job was registered */
  startedAt: Date;
  /** Maximum job duration in milliseconds */
  maxDurationMs: number;
  /** Timeout handle for duration limit */
  durationTimeout?: NodeJS.Timeout;
  /** Callback for each matching data item */
  onData: (data: RawDataMessage) => Promise<void>;
  /** Callback when job completes */
  onComplete: (count: number) => void;
  /** Number of posts matched to this job */
  matchedCount: number;
}

/**
 * JobRegistryService - Manages active Jetstream jobs
 *
 * This service maintains a registry of active jobs, each with:
 * - Extracted keywords from the user's prompt
 * - Compiled regex patterns for fast matching
 * - Callbacks for data delivery and completion
 *
 * The registry enables efficient multi-job matching against a single
 * Jetstream connection.
 */
@Injectable()
export class JobRegistryService implements OnModuleDestroy {
  private readonly logger = new Logger(JobRegistryService.name);
  private readonly activeJobs = new Map<string, RegisteredJob>();

  /**
   * Cleanup all active jobs and their timeouts on module destruction
   */
  onModuleDestroy(): void {
    for (const job of this.activeJobs.values()) {
      if (job.durationTimeout) {
        clearTimeout(job.durationTimeout);
      }
    }
    this.activeJobs.clear();
    this.logger.log('JobRegistry destroyed, cleared all active jobs');
  }

  /**
   * Register a new job for keyword matching
   */
  registerJob(config: RegisterJobConfig): void {
    const { jobId, prompt, correlationId, maxDurationMs, onData, onComplete } =
      config;

    // Check for duplicate registration
    if (this.activeJobs.has(jobId)) {
      this.logger.warn(
        `[${correlationId}] Job ${jobId} already registered, replacing`,
      );
      this.unregisterJob(jobId);
    }

    // Extract keywords from prompt
    const keywords = this.extractKeywords(prompt);
    if (keywords.length === 0) {
      this.logger.warn(
        `[${correlationId}] No keywords extracted from prompt: "${prompt}"`,
      );
    }

    // Build regex pattern for matching
    const regexPattern = this.buildRegexPattern(keywords);

    // Create registered job
    const job: RegisteredJob = {
      jobId,
      prompt,
      keywords,
      regexPattern,
      correlationId,
      startedAt: new Date(),
      maxDurationMs,
      onData,
      onComplete,
      matchedCount: 0,
    };

    // Set up duration timeout
    if (maxDurationMs > 0) {
      job.durationTimeout = setTimeout(() => {
        this.logger.log(
          `[${correlationId}] Job ${jobId} reached max duration (${maxDurationMs}ms)`,
        );
        this.completeJob(jobId);
      }, maxDurationMs);
    }

    this.activeJobs.set(jobId, job);

    this.logger.log(
      `[${correlationId}] Registered job ${jobId}: keywords=[${keywords.join(', ')}]`,
    );
  }

  /**
   * Unregister a job without triggering completion callback
   */
  unregisterJob(jobId: string): void {
    const job = this.activeJobs.get(jobId);
    if (job) {
      // Clear duration timeout
      if (job.durationTimeout) {
        clearTimeout(job.durationTimeout);
      }
      this.activeJobs.delete(jobId);
      this.logger.log(
        `[${job.correlationId}] Unregistered job ${jobId} (matched ${job.matchedCount} posts)`,
      );
    }
  }

  /**
   * Complete a job and trigger completion callback
   */
  completeJob(jobId: string): void {
    const job = this.activeJobs.get(jobId);
    if (job) {
      // Clear duration timeout
      if (job.durationTimeout) {
        clearTimeout(job.durationTimeout);
      }

      // Remove from registry
      this.activeJobs.delete(jobId);

      this.logger.log(
        `[${job.correlationId}] Completed job ${jobId}: ${job.matchedCount} posts matched`,
      );

      // Trigger completion callback
      job.onComplete(job.matchedCount);
    }
  }

  /**
   * Get a job by ID
   */
  getJob(jobId: string): RegisteredJob | undefined {
    return this.activeJobs.get(jobId);
  }

  /**
   * Get all active jobs
   */
  getActiveJobs(): RegisteredJob[] {
    return Array.from(this.activeJobs.values());
  }

  /**
   * Check if there are any active jobs
   */
  hasActiveJobs(): boolean {
    return this.activeJobs.size > 0;
  }

  /**
   * Get count of active jobs
   */
  getActiveJobCount(): number {
    return this.activeJobs.size;
  }

  /**
   * Check if a specific job exists in the registry
   */
  hasJob(jobId: string): boolean {
    return this.activeJobs.has(jobId);
  }

  /**
   * Increment matched count for a job
   */
  incrementMatchedCount(jobId: string): void {
    const job = this.activeJobs.get(jobId);
    if (job) {
      job.matchedCount++;
    }
  }

  /**
   * Extract keywords from a search prompt
   *
   * Strategy:
   * 1. Extract hashtags (preserve as-is)
   * 2. Split by word boundaries
   * 3. Filter stop words
   * 4. Filter by minimum length
   * 5. Limit to maximum count
   */
  extractKeywords(prompt: string): string[] {
    const keywords: string[] = [];

    // Extract hashtags first (they're high-signal)
    const hashtags: string[] = [];
    const hashtagMatches = prompt.matchAll(HASHTAG_PATTERN);
    for (const match of hashtagMatches) {
      if (match[1]) {
        hashtags.push(match[1].toLowerCase());
      }
    }
    keywords.push(...hashtags);

    // Split remaining text by word boundaries
    const words = prompt
      .toLowerCase()
      .split(WORD_BOUNDARY_CHARS)
      .filter((word) => {
        // Must have content
        if (!word || word.length < JETSTREAM_CONSTANTS.MIN_KEYWORD_LENGTH) {
          return false;
        }
        // Must not be a stop word
        if (STOP_WORDS.has(word)) {
          return false;
        }
        // Must contain only valid characters
        if (!VALID_KEYWORD_PATTERN.test(word)) {
          return false;
        }
        // Must not already be included (from hashtags)
        if (keywords.includes(word)) {
          return false;
        }
        return true;
      });

    keywords.push(...words);

    // Limit to maximum keywords
    return keywords.slice(0, JETSTREAM_CONSTANTS.MAX_KEYWORDS_PER_PROMPT);
  }

  /**
   * Build a case-insensitive regex pattern for keyword matching
   *
   * Creates a pattern that matches any of the keywords as whole words.
   */
  buildRegexPattern(keywords: string[]): RegExp {
    if (keywords.length === 0) {
      // Match nothing if no keywords
      return /(?!)/;
    }

    // Escape special regex characters in keywords
    const escapedKeywords = keywords.map((keyword) =>
      keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    );

    // Build alternation pattern with word boundaries
    // Using \b for word boundary matching
    const pattern = `\\b(${escapedKeywords.join('|')})\\b`;

    return new RegExp(pattern, 'i');
  }

  /**
   * Test if text matches a job's keyword pattern
   */
  matchesJob(text: string, job: RegisteredJob): boolean {
    return job.regexPattern.test(text);
  }
}
