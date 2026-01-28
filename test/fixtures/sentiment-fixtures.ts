/**
 * Test fixtures for sentiment analysis testing
 *
 * Provides reusable test data and factory functions for consistent testing
 * across unit, integration, and E2E tests.
 */

import { RawDataMessage, SentimentLabel } from '@app/shared-types';

/**
 * Sentiment test cases organized by expected outcome
 * Uses industry-standard -1 to +1 scale:
 *   - Positive: > 0.1 (typically 0.5 to 1.0 for strong positive)
 *   - Neutral: -0.1 to +0.1
 *   - Negative: < -0.1 (typically -0.5 to -1.0 for strong negative)
 */
export const SENTIMENT_TEST_CASES = {
  positive: [
    {
      text: 'I absolutely love this product! It exceeded all my expectations.',
      minScore: 0.5,
      maxScore: 1.0,
    },
    {
      text: 'This is the best purchase I have ever made. Amazing quality!',
      minScore: 0.5,
      maxScore: 1.0,
    },
    {
      text: 'Fantastic experience, highly recommend to everyone.',
      minScore: 0.4,
      maxScore: 1.0,
    },
    {
      text: 'Great value for money, works perfectly!',
      minScore: 0.4,
      maxScore: 1.0,
    },
    {
      text: 'Excellent customer service and fast shipping.',
      minScore: 0.4,
      maxScore: 1.0,
    },
  ],
  negative: [
    {
      text: 'This is terrible. Complete waste of money.',
      minScore: -1.0,
      maxScore: -0.5,
    },
    {
      text: 'Worst product I have ever bought. Avoid at all costs.',
      minScore: -1.0,
      maxScore: -0.5,
    },
    {
      text: 'Horrible quality, broke within a day. Very disappointed.',
      minScore: -1.0,
      maxScore: -0.4,
    },
    {
      text: 'I hate this so much. Returning immediately.',
      minScore: -1.0,
      maxScore: -0.5,
    },
    {
      text: 'Awful experience, will never buy again.',
      minScore: -1.0,
      maxScore: -0.4,
    },
  ],
  neutral: [
    {
      text: 'The product arrived on time.',
      minScore: -0.2,
      maxScore: 0.2,
    },
    {
      text: 'It works as described in the manual.',
      minScore: -0.2,
      maxScore: 0.2,
    },
    {
      text: 'Average quality, nothing special.',
      minScore: -0.2,
      maxScore: 0.2,
    },
    {
      text: 'It is okay for the price.',
      minScore: -0.2,
      maxScore: 0.2,
    },
    {
      text: 'Standard product, meets basic expectations.',
      minScore: -0.2,
      maxScore: 0.2,
    },
  ],
} as const;

/**
 * Edge cases for robustness testing
 */
export const EDGE_CASE_TEXTS = {
  empty: '',
  whitespace: '   \n\t  ',
  singleWord: 'good',
  veryLong: 'I love this product. '.repeat(100), // ~2000 chars
  specialChars:
    "This is great! 🎉 #amazing @product <script>alert('xss')</script>",
  unicode: '这个产品非常好 (This product is very good)',
  mixedSentiment: 'I love the design but hate the battery life. Overall okay.',
  sarcasm: 'Oh great, another product that does not work. Just what I needed.',
  negation: 'This is not bad at all!',
  doubleNegation: 'I cannot say this is not good.',
} as const;

/**
 * Factory function to create RawDataMessage for testing
 *
 * Uses relative dates (1 day ago) to ensure test data remains valid
 * regardless of the current date and won't trigger far-future validation.
 */
export function createRawDataMessage(
  overrides: Partial<RawDataMessage> = {},
): RawDataMessage {
  // Use a date 1 day in the past to ensure it's always valid
  // and won't trigger far-future validation as time progresses
  const defaultDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

  return {
    jobId: overrides.jobId ?? '00000000-0000-0000-0000-000000000001',
    source: overrides.source ?? 'reddit',
    textContent: overrides.textContent ?? 'Default test content for analysis',
    publishedAt: overrides.publishedAt ?? defaultDate,
    collectedAt: overrides.collectedAt ?? defaultDate,
    sourceUrl: overrides.sourceUrl,
    authorName: overrides.authorName,
    upvotes: overrides.upvotes,
    commentCount: overrides.commentCount,
  };
}

/**
 * Factory for positive sentiment test messages
 */
export function createPositiveMessage(
  overrides: Partial<RawDataMessage> = {},
): RawDataMessage {
  return createRawDataMessage({
    textContent: 'I absolutely love this amazing product!',
    ...overrides,
  });
}

/**
 * Factory for negative sentiment test messages
 */
export function createNegativeMessage(
  overrides: Partial<RawDataMessage> = {},
): RawDataMessage {
  return createRawDataMessage({
    textContent: 'This is terrible and I hate it so much.',
    ...overrides,
  });
}

/**
 * Factory for neutral sentiment test messages
 */
export function createNeutralMessage(
  overrides: Partial<RawDataMessage> = {},
): RawDataMessage {
  return createRawDataMessage({
    textContent: 'The product exists and functions as described.',
    ...overrides,
  });
}

/**
 * Create a batch of test messages for load testing
 */
export function createMessageBatch(count: number): RawDataMessage[] {
  const allCases = [
    ...SENTIMENT_TEST_CASES.positive,
    ...SENTIMENT_TEST_CASES.negative,
    ...SENTIMENT_TEST_CASES.neutral,
  ];

  return Array.from({ length: count }, (_, i) => {
    const testCase = allCases[i % allCases.length];
    return createRawDataMessage({
      jobId: `batch-job-${Math.floor(i / 10)}`,
      textContent: testCase.text,
    });
  });
}

/**
 * Expected sentiment result type for test assertions
 */
export interface ExpectedSentimentResult {
  label: SentimentLabel;
  minScore: number;
  maxScore: number;
  minConfidence: number;
}

/**
 * Get expected result for a sentiment category
 * Uses -1 to +1 scale aligned with SENTIMENT_TEST_CASES
 */
export function getExpectedResult(
  category: 'positive' | 'negative' | 'neutral',
): ExpectedSentimentResult {
  switch (category) {
    case 'positive':
      return {
        label: SentimentLabel.POSITIVE,
        minScore: 0.4,
        maxScore: 1.0,
        minConfidence: 0.6,
      };
    case 'negative':
      return {
        label: SentimentLabel.NEGATIVE,
        minScore: -1.0,
        maxScore: -0.4,
        minConfidence: 0.6,
      };
    case 'neutral':
      return {
        label: SentimentLabel.NEUTRAL,
        minScore: -0.2,
        maxScore: 0.2,
        minConfidence: 0.3,
      };
  }
}

/**
 * Mock correlation ID generator for tests
 */
export function createTestCorrelationId(): string {
  return `test-correlation-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

/**
 * Wait helper for async tests
 */
export function waitFor(
  condition: () => boolean,
  timeout = 10000,
  interval = 100,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const check = () => {
      if (condition()) {
        resolve();
        return;
      }

      if (Date.now() - startTime > timeout) {
        reject(new Error(`Condition not met within ${timeout}ms`));
        return;
      }

      setTimeout(check, interval);
    };

    check();
  });
}
