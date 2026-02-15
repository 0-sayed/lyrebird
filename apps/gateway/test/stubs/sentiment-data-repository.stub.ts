import type {
  SentimentData,
  NewSentimentData,
  SentimentDataRepository,
} from '@app/database';

/**
 * Jest-free in-memory stub for SentimentDataRepository
 * Used in E2E tests where we need a standalone NestJS server
 */
export class SentimentDataRepositoryStub implements Partial<SentimentDataRepository> {
  private data: Map<string, SentimentData> = new Map();

  private filterByJobId(jobId: string): SentimentData[] {
    return Array.from(this.data.values()).filter((d) => d.jobId === jobId);
  }

  create(data: NewSentimentData): Promise<SentimentData | null> {
    // Check for duplicates (same jobId + sourceUrl + publishedAt)
    const existing = Array.from(this.data.values()).find(
      (d) =>
        d.jobId === data.jobId &&
        d.sourceUrl === data.sourceUrl &&
        d.publishedAt.getTime() === new Date(data.publishedAt).getTime(),
    );
    if (existing) {
      return Promise.resolve(null);
    }

    const record: SentimentData = {
      id: crypto.randomUUID(),
      jobId: data.jobId,
      source: data.source,
      sourceUrl: data.sourceUrl ?? null,
      authorName: data.authorName ?? null,
      textContent: data.textContent,
      rawContent: data.rawContent ?? null,
      sentimentScore: data.sentimentScore,
      sentimentLabel: data.sentimentLabel,
      confidence: data.confidence ?? null,
      upvotes: data.upvotes ?? 0,
      commentCount: data.commentCount ?? 0,
      publishedAt: new Date(data.publishedAt),
      collectedAt: data.collectedAt ? new Date(data.collectedAt) : new Date(),
      analyzedAt: data.analyzedAt ? new Date(data.analyzedAt) : new Date(),
    };
    this.data.set(record.id, record);
    return Promise.resolve(record);
  }

  async createMany(dataArray: NewSentimentData[]): Promise<SentimentData[]> {
    const results: SentimentData[] = [];
    for (const data of dataArray) {
      const result = await this.create(data);
      if (result) {
        results.push(result);
      }
    }
    return results;
  }

  findByJobId(jobId: string): Promise<SentimentData[]> {
    return Promise.resolve(this.filterByJobId(jobId));
  }

  countByJobId(jobId: string): Promise<number> {
    return Promise.resolve(this.filterByJobId(jobId).length);
  }

  getAverageSentimentByJobId(jobId: string): Promise<string | null> {
    const jobData = this.filterByJobId(jobId);
    if (jobData.length === 0) {
      return Promise.resolve(null);
    }
    const sum = jobData.reduce((acc, d) => acc + d.sentimentScore, 0);
    return Promise.resolve((sum / jobData.length).toString());
  }

  getSentimentDistributionByJobId(
    jobId: string,
  ): Promise<{ label: string; count: number }[]> {
    const jobData = this.filterByJobId(jobId);
    const distribution: Record<string, number> = {
      negative: 0,
      neutral: 0,
      positive: 0,
    };
    for (const d of jobData) {
      distribution[d.sentimentLabel]++;
    }
    return Promise.resolve(
      Object.entries(distribution).map(([label, count]) => ({
        label,
        count,
      })),
    );
  }

  deleteByJobId(jobId: string): Promise<number> {
    const toDelete = Array.from(this.data.entries()).filter(
      ([, d]) => d.jobId === jobId,
    );
    for (const [id] of toDelete) {
      this.data.delete(id);
    }
    return Promise.resolve(toDelete.length);
  }

  // Test helpers
  reset(): void {
    this.data.clear();
  }

  seed(records: SentimentData[]): void {
    records.forEach((record) => this.data.set(record.id, record));
  }

  getAll(): SentimentData[] {
    return Array.from(this.data.values());
  }
}
