import { Test, TestingModule } from '@nestjs/testing';
import { SentimentDataRepository } from './sentiment-data.repository';
import { DatabaseService } from '../database.service';
import { SentimentLabel } from '@app/shared-types';
import { SentimentData } from '../schema';

describe('SentimentDataRepository', () => {
  let repository: SentimentDataRepository;
  let mockDatabaseService: Partial<DatabaseService>;

  const now = new Date();
  const mockSentimentData: SentimentData = {
    id: 'sentiment-123',
    jobId: '123e4567-e89b-12d3-a456-426614174000',
    source: 'reddit',
    sourceUrl: 'https://reddit.com/test',
    authorName: 'testuser',
    textContent: 'This product is amazing!',
    rawContent: 'This product is amazing!',
    sentimentScore: 0.85,
    sentimentLabel: SentimentLabel.POSITIVE,
    confidence: 0.92,
    upvotes: 10,
    commentCount: 5,
    publishedAt: now,
    collectedAt: now,
    analyzedAt: now,
  };

  beforeEach(async () => {
    // Mock the database service with chainable query builder
    const mockQueryBuilder = {
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValue([mockSentimentData]),
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue([mockSentimentData]),
      groupBy: jest
        .fn()
        .mockResolvedValue([{ label: SentimentLabel.POSITIVE, count: 1 }]),
    };

    mockDatabaseService = {
      db: mockQueryBuilder as unknown as DatabaseService['db'],
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SentimentDataRepository,
        { provide: DatabaseService, useValue: mockDatabaseService },
      ],
    }).compile();

    repository = module.get<SentimentDataRepository>(SentimentDataRepository);
  });

  describe('create', () => {
    it('should create sentiment data with valid payload', async () => {
      const payload = {
        jobId: mockSentimentData.jobId,
        source: 'reddit',
        textContent: 'This product is amazing!',
        rawContent: 'This product is amazing!',
        sentimentScore: 0.85,
        sentimentLabel: SentimentLabel.POSITIVE,
        confidence: 0.92,
        upvotes: 10,
        commentCount: 5,
        publishedAt: now,
        collectedAt: now,
        analyzedAt: now,
      };

      const result = await repository.create(payload);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.sentimentScore).toBe(0.85);
      expect(result.source).toBe('reddit');
      expect(result.sentimentLabel).toBe(SentimentLabel.POSITIVE);
    });
  });

  describe('findByJobId', () => {
    it('should return all sentiment data for a job', async () => {
      const results = await repository.findByJobId(mockSentimentData.jobId);

      expect(Array.isArray(results)).toBe(true);
      expect(results).toHaveLength(1);
    });

    it('should return empty array for non-existent job', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([]),
      };
      (mockDatabaseService as { db: unknown }).db = mockQueryBuilder;

      const fakeJobId = '00000000-0000-0000-0000-000000000999';
      const results = await repository.findByJobId(fakeJobId);

      expect(results).toHaveLength(0);
    });
  });

  describe('countByJobId', () => {
    it('should return count of records for job', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([{ count: 5 }]),
      };
      (mockDatabaseService as { db: unknown }).db = mockQueryBuilder;

      const count = await repository.countByJobId(mockSentimentData.jobId);

      expect(typeof count).toBe('number');
      expect(count).toBe(5);
    });

    it('should return 0 when no records exist', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([{ count: 0 }]),
      };
      (mockDatabaseService as { db: unknown }).db = mockQueryBuilder;

      const count = await repository.countByJobId('non-existent');

      expect(count).toBe(0);
    });
  });

  describe('getAverageSentimentByJobId', () => {
    it('should return average sentiment as string (Drizzle behavior)', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([{ avgSentiment: '0.75' }]),
      };
      (mockDatabaseService as { db: unknown }).db = mockQueryBuilder;

      const avg = await repository.getAverageSentimentByJobId(
        mockSentimentData.jobId,
      );

      expect(typeof avg).toBe('string');
      expect(avg).toBe('0.75');
    });

    it('should return null when no data exists', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([{ avgSentiment: null }]),
      };
      (mockDatabaseService as { db: unknown }).db = mockQueryBuilder;

      const avg = await repository.getAverageSentimentByJobId('non-existent');

      expect(avg).toBeNull();
    });
  });

  describe('getSentimentDistributionByJobId', () => {
    it('should return distribution array', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockResolvedValue([
          { label: SentimentLabel.POSITIVE, count: 10 },
          { label: SentimentLabel.NEUTRAL, count: 5 },
          { label: SentimentLabel.NEGATIVE, count: 2 },
        ]),
      };
      (mockDatabaseService as { db: unknown }).db = mockQueryBuilder;

      const distribution = await repository.getSentimentDistributionByJobId(
        mockSentimentData.jobId,
      );

      expect(Array.isArray(distribution)).toBe(true);
      expect(distribution).toHaveLength(3);
      distribution.forEach((item) => {
        expect(item).toHaveProperty('label');
        expect(item).toHaveProperty('count');
      });
    });
  });

  describe('createMany', () => {
    it('should create multiple sentiment data records', async () => {
      const mockRecords = [
        mockSentimentData,
        { ...mockSentimentData, id: 'sentiment-456' },
      ];
      const mockQueryBuilder = {
        insert: jest.fn().mockReturnThis(),
        values: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue(mockRecords),
      };
      (mockDatabaseService as { db: unknown }).db = mockQueryBuilder;

      const dataArray = [
        {
          jobId: mockSentimentData.jobId,
          source: 'twitter',
          textContent: 'Great product!',
          rawContent: 'Great product!',
          sentimentScore: 0.9,
          sentimentLabel: SentimentLabel.POSITIVE,
          confidence: 0.95,
          publishedAt: now,
          collectedAt: now,
          analyzedAt: now,
        },
        {
          jobId: mockSentimentData.jobId,
          source: 'twitter',
          textContent: 'Not bad',
          rawContent: 'Not bad',
          sentimentScore: 0.5,
          sentimentLabel: SentimentLabel.NEUTRAL,
          confidence: 0.7,
          publishedAt: now,
          collectedAt: now,
          analyzedAt: now,
        },
      ];

      const results = await repository.createMany(dataArray);

      expect(results).toHaveLength(2);
    });

    it('should return empty array when given empty array', async () => {
      const results = await repository.createMany([]);

      expect(results).toHaveLength(0);
    });
  });
});
