import { SentimentLabel, type SentimentDistribution } from '@/types/api';
import { SENTIMENT_THRESHOLDS } from './constants';

// =============================================================================
// Sentiment Styles Configuration
// =============================================================================

/**
 * Consolidated sentiment style definitions.
 * Single source of truth for all sentiment-related CSS classes.
 */
export const SENTIMENT_STYLES = {
  [SentimentLabel.POSITIVE]: {
    text: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-100 dark:bg-green-900/30',
    hoverBg: 'hover:bg-green-50 dark:hover:bg-green-950/20',
    hoverBorder: 'hover:border-green-400/70 dark:hover:border-green-500/60',
    focusVisibleRing:
      'focus-visible:ring-green-500/40 dark:focus-visible:ring-green-500/35',
    focusRing: 'focus:ring-green-500/40 dark:focus:ring-green-500/35',
  },
  [SentimentLabel.NEGATIVE]: {
    text: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-100 dark:bg-red-900/30',
    hoverBg: 'hover:bg-red-50 dark:hover:bg-red-950/20',
    hoverBorder: 'hover:border-red-400/70 dark:hover:border-red-500/60',
    focusVisibleRing:
      'focus-visible:ring-red-500/40 dark:focus-visible:ring-red-500/35',
    focusRing: 'focus:ring-red-500/40 dark:focus:ring-red-500/35',
  },
  [SentimentLabel.NEUTRAL]: {
    text: 'text-gray-600 dark:text-gray-400',
    bg: 'bg-gray-100 dark:bg-gray-800',
    hoverBg: 'hover:bg-muted/40',
    hoverBorder: 'hover:border-border',
    focusVisibleRing:
      'focus-visible:ring-gray-400/60 dark:focus-visible:ring-gray-500/50',
    focusRing: 'focus:ring-gray-400/60 dark:focus:ring-gray-500/50',
  },
} as const;

export type SentimentStyles = (typeof SENTIMENT_STYLES)[SentimentLabel];

/**
 * Get all sentiment styles for a label.
 * Preferred over individual getter functions for cleaner code.
 *
 * @param label - The sentiment label
 * @returns Object containing all style variants
 */
export function getSentimentStyles(label: SentimentLabel): SentimentStyles {
  return SENTIMENT_STYLES[label] ?? SENTIMENT_STYLES[SentimentLabel.NEUTRAL];
}

// =============================================================================
// Sentiment Label Classification
// =============================================================================

/**
 * Get the sentiment label for a given score
 *
 * @param score - Sentiment score between -1 and +1 (industry standard)
 * @returns The sentiment label (negative, neutral, or positive)
 */
export function getSentimentLabel(score: number): SentimentLabel {
  if (score < SENTIMENT_THRESHOLDS.negative) {
    return SentimentLabel.NEGATIVE;
  }
  if (score > SENTIMENT_THRESHOLDS.positive) {
    return SentimentLabel.POSITIVE;
  }
  return SentimentLabel.NEUTRAL;
}

// =============================================================================
// Individual Style Getters (for backward compatibility)
// =============================================================================

/**
 * Get the CSS color class for a sentiment label
 */
export function getSentimentColorClass(label: SentimentLabel): string {
  return getSentimentStyles(label).text;
}

/**
 * Get the CSS background color class for a sentiment label
 */
export function getSentimentBgClass(label: SentimentLabel): string {
  return getSentimentStyles(label).bg;
}

/**
 * Format a sentiment score as a signed decimal string
 *
 * @param score - Sentiment score between -1 and +1
 * @returns Formatted score string (e.g., "+0.75", "-0.32", "0.00")
 */
export function formatSentimentScore(score: number): string {
  const sign = score > 0 ? '+' : '';
  return `${sign}${score.toFixed(2)}`;
}

/**
 * Calculate the Net Sentiment Score (NSS)
 *
 * NSS = (positive - negative) / total * 100
 * Range: -100 to +100
 *
 * @param distribution - Sentiment distribution object
 * @returns Net Sentiment Score
 */
export function calculateNSS(distribution: SentimentDistribution): number {
  const total =
    distribution.positive + distribution.neutral + distribution.negative;
  if (total === 0) return 0;

  return Math.round(
    ((distribution.positive - distribution.negative) / total) * 100,
  );
}

/**
 * Get a human-readable description for the NSS
 *
 * @param nss - Net Sentiment Score (-100 to +100)
 * @returns Human-readable sentiment description
 */
export function getNSSDescription(nss: number): string {
  if (nss >= 50) return 'Very Positive';
  if (nss >= 20) return 'Positive';
  if (nss >= -20) return 'Neutral';
  if (nss >= -50) return 'Negative';
  return 'Very Negative';
}

/**
 * Get NSS label using trading/market terminology
 *
 * @param nss - Net Sentiment Score (-100 to +100)
 * @returns Market-style label (Very Bullish, Bullish, Neutral, Bearish, Very Bearish)
 */
export function getNSSLabel(nss: number): string {
  if (nss >= 50) return 'Very Bullish';
  if (nss >= 20) return 'Bullish';
  if (nss > -20) return 'Neutral';
  if (nss > -50) return 'Bearish';
  return 'Very Bearish';
}

/**
 * Get sentiment emoji for a sentiment score
 *
 * @param score - Sentiment score between -1 and +1
 * @returns Emoji representing the sentiment
 */
export function getSentimentEmoji(score: number): string {
  if (score >= 0.4) return '\u{1F60A}'; // smiling face
  if (score >= 0.1) return '\u{1F642}'; // slightly smiling face
  if (score >= -0.1) return '\u{1F610}'; // neutral face
  if (score >= -0.4) return '\u{1F615}'; // confused face
  return '\u{1F61E}'; // disappointed face
}

/**
 * Get Tailwind color classes for NSS value
 * Threshold: +/-20 for positive/negative classification
 *
 * @param nss - Net Sentiment Score (-100 to +100)
 * @returns Tailwind CSS color class string
 */
export function getNSSColorClass(nss: number): string {
  if (nss >= 20) return 'text-green-600 dark:text-green-400';
  if (nss <= -20) return 'text-red-600 dark:text-red-400';
  return 'text-gray-600 dark:text-gray-400';
}

/**
 * Get HSL color for NSS value (for chart styling)
 * Threshold: +/-20 for positive/negative classification
 *
 * @param nss - Net Sentiment Score (-100 to +100)
 * @returns HSL color string using CSS custom properties
 */
export function getNSSChartColor(nss: number): string {
  if (nss >= 20) return 'hsl(var(--chart-positive))';
  if (nss <= -20) return 'hsl(var(--chart-negative))';
  return 'hsl(var(--chart-neutral))';
}

/**
 * Prepare sentiment distribution data for pie charts
 *
 * @param distribution - Sentiment distribution object
 * @returns Array formatted for Recharts pie chart
 */
export function preparePieChartData(distribution: SentimentDistribution) {
  return [
    {
      name: 'Positive',
      value: distribution.positive,
      fill: 'hsl(var(--chart-positive))',
    },
    {
      name: 'Neutral',
      value: distribution.neutral,
      fill: 'hsl(var(--chart-neutral))',
    },
    {
      name: 'Negative',
      value: distribution.negative,
      fill: 'hsl(var(--chart-negative))',
    },
  ];
}

// =============================================================================
// Sentiment Breakdown Utilities
// =============================================================================

/**
 * Sentiment breakdown with counts and percentages
 */
export interface SentimentBreakdown {
  positive: number;
  neutral: number;
  negative: number;
  positivePercent: number;
  neutralPercent: number;
  negativePercent: number;
  total: number;
}

/**
 * Calculate sentiment breakdown from raw scores
 *
 * @param scores - Array of sentiment scores (-1 to +1)
 * @returns Breakdown object with counts and percentages
 */
export function calculateSentimentBreakdown(
  scores: number[],
): SentimentBreakdown {
  if (scores.length === 0) {
    return {
      positive: 0,
      neutral: 0,
      negative: 0,
      positivePercent: 0,
      neutralPercent: 0,
      negativePercent: 0,
      total: 0,
    };
  }

  let positive = 0;
  let neutral = 0;
  let negative = 0;

  for (const score of scores) {
    const label = getSentimentLabel(score);
    if (label === SentimentLabel.POSITIVE) {
      positive++;
    } else if (label === SentimentLabel.NEGATIVE) {
      negative++;
    } else {
      neutral++;
    }
  }

  const total = scores.length;

  // Calculate exact percentages
  const positiveExact = (positive / total) * 100;
  const neutralExact = (neutral / total) * 100;
  const negativeExact = (negative / total) * 100;

  // Floor all percentages first
  let positivePercent = Math.floor(positiveExact);
  let neutralPercent = Math.floor(neutralExact);
  let negativePercent = Math.floor(negativeExact);

  // Calculate remainders
  const remainders = [
    { index: 0, remainder: positiveExact - positivePercent },
    { index: 1, remainder: neutralExact - neutralPercent },
    { index: 2, remainder: negativeExact - negativePercent },
  ];

  // Sort by remainder (descending) to distribute remaining percentage points
  remainders.sort((a, b) => b.remainder - a.remainder);

  // Distribute remaining percentage points to reach 100%
  let currentSum = positivePercent + neutralPercent + negativePercent;
  for (const item of remainders) {
    if (currentSum >= 100) break;
    if (item.index === 0) positivePercent++;
    else if (item.index === 1) neutralPercent++;
    else negativePercent++;
    currentSum++;
  }

  return {
    positive,
    neutral,
    negative,
    positivePercent,
    neutralPercent,
    negativePercent,
    total,
  };
}

// =============================================================================
// Sentiment Velocity Utilities
// =============================================================================

/**
 * Calculate sentiment velocity (trend direction)
 * Compares recent sentiment vs previous period
 *
 * @param recentScores - Scores from recent time window
 * @param previousScores - Scores from previous time window
 * @returns Velocity value (positive = improving, negative = deteriorating)
 */
export function calculateSentimentVelocity(
  recentScores: number[],
  previousScores: number[],
): number | null {
  if (recentScores.length === 0 || previousScores.length === 0) {
    return null;
  }

  const recentAvg =
    recentScores.reduce((sum, s) => sum + s, 0) / recentScores.length;
  const previousAvg =
    previousScores.reduce((sum, s) => sum + s, 0) / previousScores.length;

  return recentAvg - previousAvg;
}

/**
 * Get velocity trend label
 *
 * @param velocity - Velocity value from calculateSentimentVelocity
 * @returns Human-readable trend description
 */
export function getVelocityLabel(velocity: number): string {
  if (velocity >= 0.2) return 'Rapidly Improving';
  if (velocity >= 0.05) return 'Improving';
  if (velocity <= -0.2) return 'Rapidly Declining';
  if (velocity <= -0.05) return 'Declining';
  return 'Stable';
}

/**
 * Get velocity color class
 *
 * @param velocity - Velocity value
 * @returns Tailwind CSS color class
 */
export function getVelocityColorClass(velocity: number): string {
  if (velocity >= 0.05) return 'text-green-600 dark:text-green-400';
  if (velocity <= -0.05) return 'text-red-600 dark:text-red-400';
  return 'text-muted-foreground';
}

// =============================================================================
// Volume/Rate Utilities
// =============================================================================

/**
 * Minimum duration in milliseconds before rate calculation is meaningful.
 * Below this threshold, the extrapolated rate would be unreliable.
 * 5 seconds provides enough time for initial data collection.
 */
const MINIMUM_RATE_DURATION_MS = 5000;

/**
 * Minimum number of posts in each window for volume trend calculation.
 * With fewer posts, percentage changes are statistically unreliable.
 */
const MINIMUM_TREND_SAMPLE_SIZE = 3;

/**
 * Calculate posts per minute rate
 *
 * Returns null when insufficient time has elapsed to calculate a meaningful rate.
 * This prevents misleading values like "60000/min" when the first post arrives.
 *
 * @param postCount - Number of posts
 * @param durationMs - Duration in milliseconds
 * @returns Posts per minute rate, or null if insufficient data
 */
export function calculatePostsPerMinute(
  postCount: number,
  durationMs: number,
): number | null {
  // Require minimum time window to avoid extreme extrapolation
  // e.g., 1 post in 1ms would extrapolate to 60,000/min
  if (durationMs < MINIMUM_RATE_DURATION_MS) return null;

  const minutes = durationMs / 60000;
  return Math.round((postCount / minutes) * 10) / 10; // One decimal place
}

/**
 * Calculate volume trend (comparing recent vs previous period)
 *
 * Returns null when sample sizes are too small for reliable trend calculation.
 * With small samples, percentage changes can be extremely volatile and misleading
 * (e.g., 1→2 posts = +100%, 2→1 posts = -50%).
 *
 * @param recentCount - Posts in recent period
 * @param previousCount - Posts in previous period
 * @returns Percentage change (positive = increasing, negative = decreasing), or null if insufficient data
 */
export function calculateVolumeTrend(
  recentCount: number,
  previousCount: number,
): number | null {
  // Require minimum sample size in BOTH windows for statistical reliability
  if (
    previousCount < MINIMUM_TREND_SAMPLE_SIZE ||
    recentCount < MINIMUM_TREND_SAMPLE_SIZE
  ) {
    return null;
  }
  return Math.round(((recentCount - previousCount) / previousCount) * 100);
}
