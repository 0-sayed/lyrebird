import { Test, TestingModule } from '@nestjs/testing';
import { SentimentDataRepository } from './sentiment-data.repository';
import { DatabaseService } from '../database.service';
import { SentimentLabel } from '@app/shared-types';
import { SentimentData, NewSentimentData } from '../schema';
import { createMockDrizzleQueryBuilder } from '@app/testing';

/**
 * Unit tests for SentimentDataRepository
 *
 * Uses mocked database service to test query builder logic.
 * For real database tests, see sentiment-data.repository.integration.spec.ts
 */
describe('SentimentDataRepository', () => {
  let repository: SentimentDataRepository;
  let mockDb: ReturnType<typeof createMockDrizzleQueryBuilder>;

  // Counter for unique IDs
  let idCounter = 0;

  /**
   * Helper to create mock sentiment data
   */
  function createMockSentimentData(
    overrides: Partial<SentimentData> = {},
  ): SentimentData {
    const now = new Date();
    idCounter++;
    return {
      id: overrides.id ?? `sentiment-${idCounter}`,
      jobId: overrides.jobId ?? '123e4567-e89b-12d3-a456-426614174000',
      source: overrides.source ?? 'bluesky',
      sourceUrl: overrides.sourceUrl ?? `https://bsky.app/post/${idCounter}`,
      authorName: overrides.authorName ?? `user${idCounter}`,
      textContent: overrides.textContent ?? 'Test sentiment content',
      rawContent: overrides.rawContent ?? 'Test sentiment content',
      sentimentScore: overrides.sentimentScore ?? 0.75,
      sentimentLabel: overrides.sentimentLabel ?? SentimentLabel.POSITIVE,
      confidence: overrides.confidence ?? 0.9,
      upvotes: overrides.upvotes ?? 0,
      commentCount: overrides.commentCount ?? 0,
      publishedAt: overrides.publishedAt ?? now,
      collectedAt: overrides.collectedAt ?? now,
      analyzedAt: overrides.analyzedAt ?? now,
    };
  }

  /**
   * Helper to create mock new sentiment data input
   */
  function createMockNewSentimentData(
    overrides: Partial<NewSentimentData> = {},
  ): NewSentimentData {
    const now = new Date();
    idCounter++;
    return {
      jobId: overrides.jobId ?? '123e4567-e89b-12d3-a456-426614174000',
      source: overrides.source ?? 'bluesky',
      sourceUrl: overrides.sourceUrl ?? `https://bsky.app/post/${idCounter}`,
      authorName: overrides.authorName ?? `user${idCounter}`,
      textContent: overrides.textContent ?? 'Test sentiment content',
      rawContent: overrides.rawContent ?? 'Test sentiment content',
      sentimentScore: overrides.sentimentScore ?? 0.75,
      sentimentLabel: overrides.sentimentLabel ?? SentimentLabel.POSITIVE,
      confidence: overrides.confidence ?? 0.9,
      publishedAt: overrides.publishedAt ?? now,
      collectedAt: overrides.collectedAt ?? now,
      analyzedAt: overrides.analyzedAt ?? now,
    };
  }

  beforeEach(async () => {
    idCounter = 0;
    mockDb = createMockDrizzleQueryBuilder();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SentimentDataRepository,
        {
          provide: DatabaseService,
          useValue: { db: mockDb },
        },
      ],
    }).compile();

    repository = module.get<SentimentDataRepository>(SentimentDataRepository);
  });

  describe('create', () => {
    it('should create sentiment data and return the created record', async () => {
      const newData = createMockNewSentimentData();
      const createdRecord = createMockSentimentData();
      mockDb.returning.mockResolvedValue([createdRecord]);

      const result = await repository.create(newData);

      expect(result).toBeDefined();
      expect(result?.id).toBe(createdRecord.id);
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalledWith(newData);
      expect(mockDb.onConflictDoNothing).toHaveBeenCalled();
    });

    it('should return null when duplicate record is skipped', async () => {
      const newData = createMockNewSentimentData();
      mockDb.returning.mockResolvedValue([]);

      const result = await repository.create(newData);

      expect(result).toBeNull();
    });

    it.each([
      ['positive', SentimentLabel.POSITIVE, 0.85],
      ['neutral', SentimentLabel.NEUTRAL, 0.0],
      ['negative', SentimentLabel.NEGATIVE, -0.75],
    ] as const)(
      'should create record with %s sentiment',
      async (_, label, score) => {
        const newData = createMockNewSentimentData({
          sentimentLabel: label,
          sentimentScore: score,
        });
        const createdRecord = createMockSentimentData({
          sentimentLabel: label,
          sentimentScore: score,
        });
        mockDb.returning.mockResolvedValue([createdRecord]);

        const result = await repository.create(newData);

        expect(result?.sentimentLabel).toBe(label);
        expect(result?.sentimentScore).toBe(score);
      },
    );
  });

  describe('createMany', () => {
    it('should create multiple sentiment data records', async () => {
      const dataArray = [
        createMockNewSentimentData({ textContent: 'First post' }),
        createMockNewSentimentData({ textContent: 'Second post' }),
        createMockNewSentimentData({ textContent: 'Third post' }),
      ];
      const createdRecords = dataArray.map((_, i) =>
        createMockSentimentData({ textContent: `Record ${i + 1}` }),
      );
      mockDb.returning.mockResolvedValue(createdRecords);

      const results = await repository.createMany(dataArray);

      expect(results).toHaveLength(3);
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalledWith(dataArray);
    });

    it('should return empty array when given empty array', async () => {
      const results = await repository.createMany([]);

      expect(results).toHaveLength(0);
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('should handle batch of 100 records', async () => {
      const dataArray = Array.from({ length: 100 }, (_, i) =>
        createMockNewSentimentData({ textContent: `Post ${i}` }),
      );
      const createdRecords = Array.from({ length: 100 }, (_, i) =>
        createMockSentimentData({ id: `sentiment-${i}` }),
      );
      mockDb.returning.mockResolvedValue(createdRecords);

      const results = await repository.createMany(dataArray);

      expect(results).toHaveLength(100);
    });
  });

  describe('findByJobId', () => {
    it('should return all sentiment data for a job', async () => {
      const jobId = '123e4567-e89b-12d3-a456-426614174000';
      const records = [
        createMockSentimentData({ jobId }),
        createMockSentimentData({ jobId }),
      ];
      mockDb.where.mockResolvedValue(records);

      const results = await repository.findByJobId(jobId);

      expect(Array.isArray(results)).toBe(true);
      expect(results).toHaveLength(2);
    });

    it('should return empty array for non-existent job', async () => {
      mockDb.where.mockResolvedValue([]);

      const results = await repository.findByJobId(
        '00000000-0000-0000-0000-000000000000',
      );

      expect(results).toHaveLength(0);
    });

    it('should handle job with many records', async () => {
      const records = Array.from({ length: 500 }, () =>
        createMockSentimentData(),
      );
      mockDb.where.mockResolvedValue(records);

      const results = await repository.findByJobId('large-job-id');

      expect(results).toHaveLength(500);
    });
  });

  describe('countByJobId', () => {
    it.each([
      [0, 0],
      [1, 1],
      [5, 5],
      [100, 100],
      [1000, 1000],
    ] as const)(
      'should return count of %d records',
      async (count, expected) => {
        mockDb.where.mockResolvedValue([{ count }]);

        const result = await repository.countByJobId('test-job-id');

        expect(result).toBe(expected);
      },
    );

    it('should return 0 when result is empty', async () => {
      mockDb.where.mockResolvedValue([]);

      const count = await repository.countByJobId('empty-job-id');

      expect(count).toBe(0);
    });

    it('should handle undefined count gracefully', async () => {
      mockDb.where.mockResolvedValue([{ count: undefined }]);

      const count = await repository.countByJobId('undefined-count-job');

      expect(count).toBe(0);
    });
  });

  describe('getAverageSentimentByJobId', () => {
    it.each([
      ['positive average', '0.75', '0.75'],
      ['negative average', '-0.50', '-0.50'],
      ['neutral average', '0.00', '0.00'],
      ['precise average', '0.123456', '0.123456'],
    ] as const)('should return %s as string', async (_, avgValue, expected) => {
      mockDb.where.mockResolvedValue([{ avgSentiment: avgValue }]);

      const avg = await repository.getAverageSentimentByJobId('test-job');

      expect(avg).toBe(expected);
    });

    it('should return null when no data exists', async () => {
      mockDb.where.mockResolvedValue([{ avgSentiment: null }]);

      const avg = await repository.getAverageSentimentByJobId('empty-job');

      expect(avg).toBeNull();
    });

    it('should return null when result array is empty', async () => {
      mockDb.where.mockResolvedValue([]);

      const avg = await repository.getAverageSentimentByJobId('missing-job');

      expect(avg).toBeNull();
    });
  });

  describe('getSentimentDistributionByJobId', () => {
    it('should return distribution array with all labels', async () => {
      const distribution = [
        { label: SentimentLabel.POSITIVE, count: 50 },
        { label: SentimentLabel.NEUTRAL, count: 30 },
        { label: SentimentLabel.NEGATIVE, count: 20 },
      ];
      mockDb.groupBy.mockResolvedValue(distribution);

      const result =
        await repository.getSentimentDistributionByJobId('distribution-job');

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(3);
      expect(result).toEqual(distribution);
    });

    it('should return partial distribution when some labels are missing', async () => {
      const distribution = [{ label: SentimentLabel.POSITIVE, count: 100 }];
      mockDb.groupBy.mockResolvedValue(distribution);

      const result =
        await repository.getSentimentDistributionByJobId('single-label-job');

      expect(result).toHaveLength(1);
      expect(result[0].label).toBe(SentimentLabel.POSITIVE);
    });

    it('should return empty array for job with no data', async () => {
      mockDb.groupBy.mockResolvedValue([]);

      const result =
        await repository.getSentimentDistributionByJobId('empty-job');

      expect(result).toHaveLength(0);
    });

    it('should handle large counts', async () => {
      const distribution = [
        { label: SentimentLabel.POSITIVE, count: 1000000 },
        { label: SentimentLabel.NEUTRAL, count: 500000 },
        { label: SentimentLabel.NEGATIVE, count: 250000 },
      ];
      mockDb.groupBy.mockResolvedValue(distribution);

      const result =
        await repository.getSentimentDistributionByJobId('large-data-job');

      expect(result[0].count).toBe(1000000);
    });
  });

  describe('deleteByJobId', () => {
    it.each([
      [1, 1],
      [3, 3],
      [100, 100],
    ] as const)(
      'should delete %d records and return count',
      async (recordCount, expected) => {
        const deletedRecords = Array.from({ length: recordCount }, (_, i) =>
          createMockSentimentData({ id: `deleted-${i}` }),
        );
        mockDb.returning.mockResolvedValue(deletedRecords);

        const count = await repository.deleteByJobId('delete-test-job');

        expect(count).toBe(expected);
        expect(mockDb.delete).toHaveBeenCalled();
      },
    );

    it('should return 0 when no records exist for job', async () => {
      mockDb.returning.mockResolvedValue([]);

      const count = await repository.deleteByJobId('non-existent-job');

      expect(count).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should propagate database errors on create', async () => {
      const dbError = new Error('Database connection failed');
      mockDb.returning.mockRejectedValue(dbError);

      await expect(
        repository.create(createMockNewSentimentData()),
      ).rejects.toThrow('Database connection failed');
    });

    it('should propagate database errors on findByJobId', async () => {
      const dbError = new Error('Query timeout');
      mockDb.where.mockRejectedValue(dbError);

      await expect(repository.findByJobId('test-job')).rejects.toThrow(
        'Query timeout',
      );
    });

    it('should propagate database errors on countByJobId', async () => {
      const dbError = new Error('Connection pool exhausted');
      mockDb.where.mockRejectedValue(dbError);

      await expect(repository.countByJobId('test-job')).rejects.toThrow(
        'Connection pool exhausted',
      );
    });

    it('should propagate database errors on getAverageSentimentByJobId', async () => {
      const dbError = new Error('Aggregation failed');
      mockDb.where.mockRejectedValue(dbError);

      await expect(
        repository.getAverageSentimentByJobId('test-job'),
      ).rejects.toThrow('Aggregation failed');
    });

    it('should propagate database errors on getSentimentDistributionByJobId', async () => {
      const dbError = new Error('Group by failed');
      mockDb.groupBy.mockRejectedValue(dbError);

      await expect(
        repository.getSentimentDistributionByJobId('test-job'),
      ).rejects.toThrow('Group by failed');
    });

    it('should propagate database errors on deleteByJobId', async () => {
      const dbError = new Error('Delete constraint violation');
      mockDb.returning.mockRejectedValue(dbError);

      await expect(repository.deleteByJobId('test-job')).rejects.toThrow(
        'Delete constraint violation',
      );
    });
  });
});
