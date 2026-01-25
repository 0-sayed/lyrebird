import { describe, expect, it } from 'vitest';

import {
  getSentimentLabel,
  getSentimentColorClass,
  getSentimentBgClass,
  formatSentimentScore,
  calculateNSS,
  getNSSDescription,
  preparePieChartData,
  calculatePostsPerMinute,
  calculateVolumeTrend,
  calculateSentimentBreakdown,
} from '@/lib/sentiment-utils';
import { SentimentLabel } from '@/types/api';

describe('Sentiment Utilities', () => {
  describe('getSentimentLabel', () => {
    it('should return NEGATIVE for scores below -0.1', () => {
      expect(getSentimentLabel(-1)).toBe(SentimentLabel.NEGATIVE);
      expect(getSentimentLabel(-0.5)).toBe(SentimentLabel.NEGATIVE);
      expect(getSentimentLabel(-0.11)).toBe(SentimentLabel.NEGATIVE);
    });

    it('should return NEUTRAL for scores between -0.1 and 0.1', () => {
      expect(getSentimentLabel(-0.1)).toBe(SentimentLabel.NEUTRAL);
      expect(getSentimentLabel(0)).toBe(SentimentLabel.NEUTRAL);
      expect(getSentimentLabel(0.1)).toBe(SentimentLabel.NEUTRAL);
    });

    it('should return POSITIVE for scores above 0.1', () => {
      expect(getSentimentLabel(0.11)).toBe(SentimentLabel.POSITIVE);
      expect(getSentimentLabel(0.5)).toBe(SentimentLabel.POSITIVE);
      expect(getSentimentLabel(1)).toBe(SentimentLabel.POSITIVE);
    });
  });

  describe('getSentimentColorClass', () => {
    it('should return correct color classes for each label', () => {
      expect(getSentimentColorClass(SentimentLabel.POSITIVE)).toContain(
        'green',
      );
      expect(getSentimentColorClass(SentimentLabel.NEGATIVE)).toContain('red');
      expect(getSentimentColorClass(SentimentLabel.NEUTRAL)).toContain('gray');
    });
  });

  describe('getSentimentBgClass', () => {
    it('should return correct background classes for each label', () => {
      expect(getSentimentBgClass(SentimentLabel.POSITIVE)).toContain('green');
      expect(getSentimentBgClass(SentimentLabel.NEGATIVE)).toContain('red');
      expect(getSentimentBgClass(SentimentLabel.NEUTRAL)).toContain('gray');
    });
  });

  describe('formatSentimentScore', () => {
    it('should format score with sign and two decimals', () => {
      // Zero is neutral and doesn't get a sign
      expect(formatSentimentScore(0)).toBe('0.00');
      expect(formatSentimentScore(0.5)).toBe('+0.50');
      expect(formatSentimentScore(1)).toBe('+1.00');
      expect(formatSentimentScore(-0.5)).toBe('-0.50');
      expect(formatSentimentScore(-1)).toBe('-1.00');
    });

    it('should format decimal values correctly', () => {
      expect(formatSentimentScore(0.666)).toBe('+0.67');
      expect(formatSentimentScore(-0.333)).toBe('-0.33');
      // Very small positive is still positive
      expect(formatSentimentScore(0.001)).toBe('+0.00');
    });
  });

  describe('calculateNSS', () => {
    it('should calculate correct NSS for balanced distribution', () => {
      const distribution = { positive: 10, neutral: 10, negative: 10 };
      expect(calculateNSS(distribution)).toBe(0);
    });

    it('should calculate positive NSS', () => {
      const distribution = { positive: 20, neutral: 5, negative: 5 };
      expect(calculateNSS(distribution)).toBe(50);
    });

    it('should calculate negative NSS', () => {
      const distribution = { positive: 5, neutral: 5, negative: 20 };
      expect(calculateNSS(distribution)).toBe(-50);
    });

    it('should handle all positive', () => {
      const distribution = { positive: 100, neutral: 0, negative: 0 };
      expect(calculateNSS(distribution)).toBe(100);
    });

    it('should handle all negative', () => {
      const distribution = { positive: 0, neutral: 0, negative: 100 };
      expect(calculateNSS(distribution)).toBe(-100);
    });

    it('should handle empty distribution', () => {
      const distribution = { positive: 0, neutral: 0, negative: 0 };
      expect(calculateNSS(distribution)).toBe(0);
    });
  });

  describe('getNSSDescription', () => {
    it('should return correct descriptions', () => {
      expect(getNSSDescription(100)).toBe('Very Positive');
      expect(getNSSDescription(50)).toBe('Very Positive');
      expect(getNSSDescription(30)).toBe('Positive');
      expect(getNSSDescription(0)).toBe('Neutral');
      expect(getNSSDescription(-30)).toBe('Negative');
      expect(getNSSDescription(-50)).toBe('Negative');
      expect(getNSSDescription(-60)).toBe('Very Negative');
      expect(getNSSDescription(-100)).toBe('Very Negative');
    });
  });

  describe('preparePieChartData', () => {
    it('should prepare data for Recharts pie chart', () => {
      const distribution = { positive: 10, neutral: 5, negative: 3 };
      const data = preparePieChartData(distribution);

      expect(data).toHaveLength(3);
      expect(data[0]).toEqual(
        expect.objectContaining({ name: 'Positive', value: 10 }),
      );
      expect(data[1]).toEqual(
        expect.objectContaining({ name: 'Neutral', value: 5 }),
      );
      expect(data[2]).toEqual(
        expect.objectContaining({ name: 'Negative', value: 3 }),
      );
    });

    it('should include fill colors', () => {
      const distribution = { positive: 1, neutral: 1, negative: 1 };
      const data = preparePieChartData(distribution);

      data.forEach((item) => {
        expect(item.fill).toBeDefined();
        expect(item.fill).toContain('hsl');
      });
    });
  });

  describe('calculatePostsPerMinute', () => {
    it('should return null when duration is below minimum threshold (5 seconds)', () => {
      expect(calculatePostsPerMinute(1, 0)).toBeNull();
      expect(calculatePostsPerMinute(1, 1000)).toBeNull();
      expect(calculatePostsPerMinute(10, 4999)).toBeNull();
    });

    it('should calculate rate correctly when duration meets minimum threshold', () => {
      // 10 posts in 5 seconds = 120 posts/minute
      expect(calculatePostsPerMinute(10, 5000)).toBe(120);

      // 60 posts in 60 seconds = 60 posts/minute
      expect(calculatePostsPerMinute(60, 60000)).toBe(60);

      // 30 posts in 30 seconds = 60 posts/minute
      expect(calculatePostsPerMinute(30, 30000)).toBe(60);

      // 1 post in 5 seconds = 12 posts/minute
      expect(calculatePostsPerMinute(1, 5000)).toBe(12);
    });

    it('should round to one decimal place', () => {
      // 7 posts in 10 seconds = 42 posts/minute
      expect(calculatePostsPerMinute(7, 10000)).toBe(42);

      // 11 posts in 30 seconds = 22 posts/minute
      expect(calculatePostsPerMinute(11, 30000)).toBe(22);
    });
  });

  describe('calculateVolumeTrend', () => {
    it('should return null when previous count is below minimum sample size (3)', () => {
      expect(calculateVolumeTrend(10, 0)).toBeNull();
      expect(calculateVolumeTrend(10, 1)).toBeNull();
      expect(calculateVolumeTrend(10, 2)).toBeNull();
    });

    it('should return null when recent count is below minimum sample size (3)', () => {
      expect(calculateVolumeTrend(0, 10)).toBeNull();
      expect(calculateVolumeTrend(1, 10)).toBeNull();
      expect(calculateVolumeTrend(2, 10)).toBeNull();
    });

    it('should calculate positive trend correctly', () => {
      // 10 recent, 5 previous = +100%
      expect(calculateVolumeTrend(10, 5)).toBe(100);

      // 6 recent, 3 previous = +100%
      expect(calculateVolumeTrend(6, 3)).toBe(100);
    });

    it('should calculate negative trend correctly', () => {
      // 5 recent, 10 previous = -50%
      expect(calculateVolumeTrend(5, 10)).toBe(-50);

      // 3 recent, 6 previous = -50%
      expect(calculateVolumeTrend(3, 6)).toBe(-50);
    });

    it('should return 0 for stable volume', () => {
      expect(calculateVolumeTrend(10, 10)).toBe(0);
      expect(calculateVolumeTrend(5, 5)).toBe(0);
    });
  });

  describe('calculateSentimentBreakdown', () => {
    it('should return zero breakdown for empty array', () => {
      const breakdown = calculateSentimentBreakdown([]);
      expect(breakdown.total).toBe(0);
      expect(breakdown.positivePercent).toBe(0);
      expect(breakdown.neutralPercent).toBe(0);
      expect(breakdown.negativePercent).toBe(0);
    });

    it('should calculate breakdown correctly', () => {
      const breakdown = calculateSentimentBreakdown([
        0.5,
        0.5,
        0.5, // 3 positive
        0,
        0, // 2 neutral
        -0.5,
        -0.5, // 2 negative
      ]);
      expect(breakdown.positive).toBe(3);
      expect(breakdown.neutral).toBe(2);
      expect(breakdown.negative).toBe(2);
      expect(breakdown.total).toBe(7);
    });

    it('should ensure percentages always sum to exactly 100%', () => {
      // Test various edge cases that might cause rounding issues
      const testCases = [
        [0.5, 0.5, 0.5, 0, 0, -0.5, -0.5], // 7 posts
        [0.5, 0.5, 0.5, 0.5, 0.5, 0, 0, 0, 0, -0.5, -0.5], // 11 posts
        [0.5, 0, -0.5], // 3 equal parts
      ];

      for (const scores of testCases) {
        const breakdown = calculateSentimentBreakdown(scores);
        const sum =
          breakdown.positivePercent +
          breakdown.neutralPercent +
          breakdown.negativePercent;
        expect(sum).toBe(100);
      }
    });

    it('should handle all positive scores', () => {
      const breakdown = calculateSentimentBreakdown([0.5, 0.5, 0.5]);
      expect(breakdown.positive).toBe(3);
      expect(breakdown.positivePercent).toBe(100);
      expect(breakdown.neutralPercent).toBe(0);
      expect(breakdown.negativePercent).toBe(0);
    });

    it('should handle all negative scores', () => {
      const breakdown = calculateSentimentBreakdown([-0.5, -0.5, -0.5]);
      expect(breakdown.negative).toBe(3);
      expect(breakdown.positivePercent).toBe(0);
      expect(breakdown.neutralPercent).toBe(0);
      expect(breakdown.negativePercent).toBe(100);
    });
  });
});
