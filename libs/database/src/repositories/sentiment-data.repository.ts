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
   */
  async create(data: NewSentimentData): Promise<SentimentData> {
    const [record] = await this.databaseService.db
      .insert(sentimentData)
      .values(data)
      .returning();

    this.logger.debug(`Created sentiment data: ${record.id}`);
    return record;
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
}
