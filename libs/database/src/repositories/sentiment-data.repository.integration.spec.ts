import { SentimentLabel } from '@app/shared-types';
import {
  getTestDatabaseService,
  TestDatabaseService,
} from '../test/test-database.service';
import { createTestJob, resetJobFactory } from '../test/factories/job.factory';
import {
  createTestSentimentData,
  createSentimentBatch,
  resetSentimentFactory,
} from '../test/factories/sentiment.factory';
import { DatabaseService } from '../database.service';
import { JobsRepository } from './jobs.repository';
import { SentimentDataRepository } from './sentiment-data.repository';

describe('SentimentDataRepository Integration', () => {
  let testDb: TestDatabaseService;
  let jobsRepository: JobsRepository;
  let sentimentRepository: SentimentDataRepository;
  let testJobId: string;

  beforeAll(() => {
    testDb = getTestDatabaseService();
    testDb.connect();
    jobsRepository = new JobsRepository(testDb as unknown as DatabaseService);
    sentimentRepository = new SentimentDataRepository(
      testDb as unknown as DatabaseService,
    );
  });

  afterAll(async () => {
    await testDb.disconnect();
  });

  beforeEach(async () => {
    await testDb.cleanTables();
    resetJobFactory();
    resetSentimentFactory();

    // Create a test job (required: sentiment_data.jobId FK → jobs.id)
    const job = await jobsRepository.create(createTestJob());
    testJobId = job.id;
  });

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------
  describe('create', () => {
    it('should insert sentiment data and return it', async () => {
      const data = createTestSentimentData(testJobId);

      const result = await sentimentRepository.create(data);

      expect(result).not.toBeNull();
      expect(result!.jobId).toBe(testJobId);
      expect(result!.sourceUrl).toBe(data.sourceUrl);
      expect(result!.sentimentScore).toBe(data.sentimentScore);
      expect(result!.id).toBeDefined();
    });

    it('should return null for duplicate records (ON CONFLICT DO NOTHING)', async () => {
      const data = createTestSentimentData(testJobId);

      const first = await sentimentRepository.create(data);
      const second = await sentimentRepository.create(data);

      expect(first).not.toBeNull();
      expect(second).toBeNull();
    });

    it.each([
      [SentimentLabel.POSITIVE, 0.9],
      [SentimentLabel.NEUTRAL, 0.0],
      [SentimentLabel.NEGATIVE, -0.9],
    ])(
      'should store %s sentiment correctly',
      async (label: SentimentLabel, score: number) => {
        const data = createTestSentimentData(testJobId, {
          sentimentLabel: label,
          sentimentScore: score,
        });

        const result = await sentimentRepository.create(data);

        expect(result).not.toBeNull();
        expect(result!.sentimentLabel).toBe(label);
        expect(result!.sentimentScore).toBe(score);
      },
    );
  });

  // ---------------------------------------------------------------------------
  // createMany
  // ---------------------------------------------------------------------------
  describe('createMany', () => {
    it('should insert multiple records in a single call', async () => {
      const batch = [
        createTestSentimentData(testJobId),
        createTestSentimentData(testJobId),
        createTestSentimentData(testJobId),
      ];

      const results = await sentimentRepository.createMany(batch);

      expect(results).toHaveLength(3);
      results.forEach((r) => expect(r.jobId).toBe(testJobId));
    });

    it('should handle batch of 100 records', async () => {
      const batch = Array.from({ length: 100 }, () =>
        createTestSentimentData(testJobId),
      );

      const results = await sentimentRepository.createMany(batch);

      expect(results).toHaveLength(100);
    });

    it('should return empty array for empty input', async () => {
      const results = await sentimentRepository.createMany([]);

      expect(results).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // findByJobId
  // ---------------------------------------------------------------------------
  describe('findByJobId', () => {
    it('should return all sentiment data for a job', async () => {
      const batch = [
        createTestSentimentData(testJobId),
        createTestSentimentData(testJobId),
        createTestSentimentData(testJobId),
      ];
      await sentimentRepository.createMany(batch);

      const results = await sentimentRepository.findByJobId(testJobId);

      expect(results).toHaveLength(3);
      results.forEach((r) => expect(r.jobId).toBe(testJobId));
    });

    it('should NOT return data from other jobs', async () => {
      // Insert data for testJobId
      await sentimentRepository.createMany([
        createTestSentimentData(testJobId),
        createTestSentimentData(testJobId),
      ]);

      // Create a second job and insert data for it
      const otherJob = await jobsRepository.create(createTestJob());
      await sentimentRepository.createMany([
        createTestSentimentData(otherJob.id),
        createTestSentimentData(otherJob.id),
        createTestSentimentData(otherJob.id),
      ]);

      const results = await sentimentRepository.findByJobId(testJobId);

      expect(results).toHaveLength(2);
      results.forEach((r) => expect(r.jobId).toBe(testJobId));
    });

    it('should return empty array for job with no data', async () => {
      const results = await sentimentRepository.findByJobId(testJobId);

      expect(results).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // countByJobId
  // ---------------------------------------------------------------------------
  describe('countByJobId', () => {
    it.each([0, 1, 5, 100])(
      'should return %i when there are %i records',
      async (recordCount: number) => {
        if (recordCount > 0) {
          const batch = Array.from({ length: recordCount }, () =>
            createTestSentimentData(testJobId),
          );
          await sentimentRepository.createMany(batch);
        }

        const result = await sentimentRepository.countByJobId(testJobId);

        expect(result).toBe(recordCount);
        expect(typeof result).toBe('number');
      },
    );
  });

  // ---------------------------------------------------------------------------
  // getAverageSentimentByJobId
  // ---------------------------------------------------------------------------
  describe('getAverageSentimentByJobId', () => {
    it('should calculate correct average for known scores', async () => {
      // [0.8, 0.0, -0.6] → avg = 0.2 / 3 ≈ 0.0667
      const data = [
        createTestSentimentData(testJobId, { sentimentScore: 0.8 }),
        createTestSentimentData(testJobId, { sentimentScore: 0.0 }),
        createTestSentimentData(testJobId, { sentimentScore: -0.6 }),
      ];
      await sentimentRepository.createMany(data);

      const avg =
        await sentimentRepository.getAverageSentimentByJobId(testJobId);

      // PostgreSQL avg returns a string
      expect(avg).not.toBeNull();
      const numericAvg = parseFloat(avg!);
      expect(numericAvg).toBeCloseTo(0.0667, 3);
    });

    it('should return null for job with no data', async () => {
      const result =
        await sentimentRepository.getAverageSentimentByJobId(testJobId);

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // getSentimentDistributionByJobId
  // ---------------------------------------------------------------------------
  describe('getSentimentDistributionByJobId', () => {
    it('should group by sentiment label correctly (positive: 5, neutral: 3, negative: 2)', async () => {
      const batch = createSentimentBatch(testJobId, {
        positive: 5,
        neutral: 3,
        negative: 2,
      });
      await sentimentRepository.createMany(batch);

      const distribution =
        await sentimentRepository.getSentimentDistributionByJobId(testJobId);

      expect(distribution).toHaveLength(3);

      const positiveEntry = distribution.find(
        (d) => (d.label as SentimentLabel) === SentimentLabel.POSITIVE,
      );
      const neutralEntry = distribution.find(
        (d) => (d.label as SentimentLabel) === SentimentLabel.NEUTRAL,
      );
      const negativeEntry = distribution.find(
        (d) => (d.label as SentimentLabel) === SentimentLabel.NEGATIVE,
      );

      expect(positiveEntry).toBeDefined();
      expect(positiveEntry!.count).toBe(5);

      expect(neutralEntry).toBeDefined();
      expect(neutralEntry!.count).toBe(3);

      expect(negativeEntry).toBeDefined();
      expect(negativeEntry!.count).toBe(2);
    });

    it('should handle single-label distribution (10 positives → 1 result)', async () => {
      const batch = createSentimentBatch(testJobId, {
        positive: 10,
        neutral: 0,
        negative: 0,
      });
      await sentimentRepository.createMany(batch);

      const distribution =
        await sentimentRepository.getSentimentDistributionByJobId(testJobId);

      expect(distribution).toHaveLength(1);
      expect(distribution[0].label).toBe(SentimentLabel.POSITIVE);
      expect(distribution[0].count).toBe(10);
    });

    it('should return empty array for job with no data', async () => {
      const distribution =
        await sentimentRepository.getSentimentDistributionByJobId(testJobId);

      expect(distribution).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // deleteByJobId
  // ---------------------------------------------------------------------------
  describe('deleteByJobId', () => {
    it('should delete all sentiment data and return count (5 records)', async () => {
      const batch = Array.from({ length: 5 }, () =>
        createTestSentimentData(testJobId),
      );
      await sentimentRepository.createMany(batch);

      const deletedCount = await sentimentRepository.deleteByJobId(testJobId);

      expect(deletedCount).toBe(5);
      const remaining = await sentimentRepository.findByJobId(testJobId);
      expect(remaining).toHaveLength(0);
    });

    it('should NOT affect data from other jobs', async () => {
      // Data for testJobId
      await sentimentRepository.createMany([
        createTestSentimentData(testJobId),
        createTestSentimentData(testJobId),
      ]);

      // Data for a second job
      const otherJob = await jobsRepository.create(createTestJob());
      await sentimentRepository.createMany([
        createTestSentimentData(otherJob.id),
        createTestSentimentData(otherJob.id),
        createTestSentimentData(otherJob.id),
      ]);

      await sentimentRepository.deleteByJobId(testJobId);

      const otherJobData = await sentimentRepository.findByJobId(otherJob.id);
      expect(otherJobData).toHaveLength(3);
    });

    it('should return 0 for job with no data', async () => {
      const deletedCount = await sentimentRepository.deleteByJobId(testJobId);

      expect(deletedCount).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // cascade delete
  // ---------------------------------------------------------------------------
  describe('cascade delete', () => {
    it('should delete sentiment data when parent job is deleted (ON DELETE CASCADE)', async () => {
      const batch = Array.from({ length: 4 }, () =>
        createTestSentimentData(testJobId),
      );
      await sentimentRepository.createMany(batch);

      // Verify data exists before deletion
      const before = await sentimentRepository.findByJobId(testJobId);
      expect(before).toHaveLength(4);

      // Delete the parent job — CASCADE should remove sentiment data too
      await jobsRepository.delete(testJobId);

      // Sentiment data should be gone
      const after = await sentimentRepository.findByJobId(testJobId);
      expect(after).toHaveLength(0);
    });
  });
});
