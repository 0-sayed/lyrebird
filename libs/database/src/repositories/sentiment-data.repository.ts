import { Injectable, Logger } from '@nestjs/common';
import { eq, count, avg } from 'drizzle-orm';
import { DatabaseService } from '../database.service';
import { sentimentData, NewSentimentData, SentimentData } from '../schema';

@Injectable()
export class SentimentDataRepository {
  private readonly logger = new Logger(SentimentDataRepository.name);

  constructor(private databaseService: DatabaseService) {}

  /**
   * Create a new sentiment data record
   * Uses ON CONFLICT DO NOTHING to skip duplicate posts (same job_id + source_url + published_at)
   * Note: TimescaleDB hypertables require unique indexes to include the partitioning column
   * @returns The created record, or null if it was a duplicate
   */
  async create(data: NewSentimentData): Promise<SentimentData | null> {
    const result = await this.databaseService.db
      .insert(sentimentData)
      .values(data)
      .onConflictDoNothing({
        target: [
          sentimentData.jobId,
          sentimentData.sourceUrl,
          sentimentData.publishedAt,
        ],
      })
      .returning();

    const record = result[0];
    if (record) {
      this.logger.debug(`Created sentiment data: ${record.id}`);
      return record;
    } else {
      this.logger.debug(
        `Skipped duplicate sentiment data for job ${data.jobId}: ${data.sourceUrl}`,
      );
      return null;
    }
  }

  /**
   * Create multiple sentiment data records
   */
  async createMany(dataArray: NewSentimentData[]): Promise<SentimentData[]> {
    if (dataArray.length === 0) return [];

    const records = await this.databaseService.db
      .insert(sentimentData)
      .values(dataArray)
      .returning();

    this.logger.debug(`Created ${records.length} sentiment data records`);
    return records;
  }

  /**
   * Find all sentiment data for a job
   */
  async findByJobId(jobId: string): Promise<SentimentData[]> {
    return this.databaseService.db
      .select()
      .from(sentimentData)
      .where(eq(sentimentData.jobId, jobId));
  }

  /**
   * Count sentiment data records for a job
   */
  async countByJobId(jobId: string): Promise<number> {
    const [result] = await this.databaseService.db
      .select({ count: count() })
      .from(sentimentData)
      .where(eq(sentimentData.jobId, jobId));

    return result?.count ?? 0;
  }

  /**
   * Calculate average sentiment for a job
   */
  async getAverageSentimentByJobId(jobId: string): Promise<string | null> {
    const [result] = await this.databaseService.db
      .select({ avgSentiment: avg(sentimentData.sentimentScore) })
      .from(sentimentData)
      .where(eq(sentimentData.jobId, jobId));

    return result?.avgSentiment ?? null;
  }

  /**
   * Get sentiment distribution for a job
   */
  async getSentimentDistributionByJobId(
    jobId: string,
  ): Promise<{ label: string; count: number }[]> {
    const results = await this.databaseService.db
      .select({
        label: sentimentData.sentimentLabel,
        count: count(),
      })
      .from(sentimentData)
      .where(eq(sentimentData.jobId, jobId))
      .groupBy(sentimentData.sentimentLabel);

    return results;
  }

  /**
   * Delete all sentiment data for a job
   * @returns The number of deleted records
   */
  async deleteByJobId(jobId: string): Promise<number> {
    const deleted = await this.databaseService.db
      .delete(sentimentData)
      .where(eq(sentimentData.jobId, jobId))
      .returning();

    this.logger.debug(
      `Deleted ${deleted.length} sentiment data records for job ${jobId}`,
    );
    return deleted.length;
  }
}
