import { NewSentimentData } from '../../schema';
import { SentimentLabel } from '@app/shared-types';

let sentimentIdCounter = 0;

/**
 * Factory for creating test sentiment data.
 * Uses deterministic values for reproducible tests.
 */
export function createTestSentimentData(
  jobId: string,
  overrides: Partial<NewSentimentData> = {},
): NewSentimentData {
  sentimentIdCounter++;
  const now = new Date();

  return {
    jobId,
    source: overrides.source ?? 'bluesky',
    sourceUrl:
      overrides.sourceUrl ?? `https://bsky.app/post/${sentimentIdCounter}`,
    authorName: overrides.authorName ?? `user${sentimentIdCounter}`,
    textContent: overrides.textContent ?? `Test content ${sentimentIdCounter}`,
    rawContent: overrides.rawContent ?? `Test content ${sentimentIdCounter}`,
    sentimentScore: overrides.sentimentScore ?? 0.5,
    sentimentLabel: overrides.sentimentLabel ?? SentimentLabel.NEUTRAL,
    confidence: overrides.confidence ?? 0.85,
    upvotes: overrides.upvotes ?? 0,
    commentCount: overrides.commentCount ?? 0,
    publishedAt: overrides.publishedAt ?? now,
    collectedAt: overrides.collectedAt ?? now,
    analyzedAt: overrides.analyzedAt ?? now,
  };
}

/**
 * Create a batch of sentiment data with specific distribution.
 * Uses deterministic scores for reliable aggregation testing.
 */
export function createSentimentBatch(
  jobId: string,
  distribution: { positive: number; neutral: number; negative: number },
): NewSentimentData[] {
  const batch: NewSentimentData[] = [];

  // Positive: scores from 0.6 to 0.9
  for (let i = 0; i < distribution.positive; i++) {
    batch.push(
      createTestSentimentData(jobId, {
        sentimentLabel: SentimentLabel.POSITIVE,
        sentimentScore: 0.6 + (i % 4) * 0.1, // 0.6, 0.7, 0.8, 0.9, 0.6...
      }),
    );
  }

  // Neutral: scores around 0.0
  for (let i = 0; i < distribution.neutral; i++) {
    batch.push(
      createTestSentimentData(jobId, {
        sentimentLabel: SentimentLabel.NEUTRAL,
        sentimentScore: -0.1 + (i % 3) * 0.1, // -0.1, 0.0, 0.1, -0.1...
      }),
    );
  }

  // Negative: scores from -0.6 to -0.9
  for (let i = 0; i < distribution.negative; i++) {
    batch.push(
      createTestSentimentData(jobId, {
        sentimentLabel: SentimentLabel.NEGATIVE,
        sentimentScore: -0.6 - (i % 4) * 0.1, // -0.6, -0.7, -0.8, -0.9...
      }),
    );
  }

  return batch;
}

export function resetSentimentFactory(): void {
  sentimentIdCounter = 0;
}
