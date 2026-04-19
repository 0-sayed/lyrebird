import { SentimentLabel } from '@app/shared-types';
import {
  createSentimentBatch,
  createTestSentimentData,
  resetSentimentFactory,
} from './sentiment.factory';

describe('sentiment factory', () => {
  beforeEach(() => {
    resetSentimentFactory();
  });

  it('uses a neutral score of zero by default', () => {
    const sentiment = createTestSentimentData('job-1');

    expect(sentiment.sentimentLabel).toBe(SentimentLabel.NEUTRAL);
    expect(sentiment.sentimentScore).toBe(0);
  });

  it('keeps neutral batch scores centered near zero', () => {
    const batch = createSentimentBatch('job-1', {
      positive: 0,
      neutral: 3,
      negative: 0,
    });

    expect(batch.map((item) => item.sentimentScore)).toEqual([-0.1, 0, 0.1]);
  });
});
