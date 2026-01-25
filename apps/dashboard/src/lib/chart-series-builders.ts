/**
 * Chart series builders for lightweight-charts
 *
 * Factory functions for creating chart series and price lines.
 */
import {
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  BaselineSeries,
  LineSeries,
  LineStyle,
  LineType,
} from 'lightweight-charts';

import {
  getThemeColors,
  PRICE_LINE_THRESHOLDS,
  SENTIMENT_SERIES_COLORS,
} from './chart-theme';

// =============================================================================
// Types
// =============================================================================

export interface PriceLineRefs {
  baseline: IPriceLine | null;
  maxPositive: IPriceLine | null;
  maxNegative: IPriceLine | null;
  strongPositive: IPriceLine | null;
  strongNegative: IPriceLine | null;
}

// =============================================================================
// Fixed Range Provider
// =============================================================================

/**
 * Visual padding ratio for the Y-axis.
 * This adds breathing room above +1 and below -1 for better UX.
 * 0.15 means the -1 to +1 range occupies 70% of the chart height,
 * with 15% padding above and below.
 */
const Y_AXIS_PADDING = 0.15;

/**
 * Fixed sentiment range provider to lock Y-axis around -1 to +1.
 *
 * Extends the range slightly beyond -1 and +1 to provide visual padding,
 * making the chart boundaries clearer and more aesthetically pleasing.
 * The actual sentiment data stays within -1 to +1, but the Y-axis shows
 * a bit of extra space above and below.
 */
export const fixedSentimentRangeProvider = () => {
  // Data range is -1 to +1, but we extend it for visual padding
  const dataRange = 2; // +1 - (-1)
  const padding = dataRange * Y_AXIS_PADDING;

  return {
    priceRange: {
      minValue: -1 - padding, // -1.3
      maxValue: 1 + padding, // +1.3
    },
  };
};

// =============================================================================
// Series Builders
// =============================================================================

/**
 * Create the main sentiment baseline series
 */
export function createSentimentSeries(
  chart: IChartApi,
): ISeriesApi<'Baseline'> {
  return chart.addSeries(BaselineSeries, {
    baseValue: { type: 'price', price: 0 },
    topLineColor: SENTIMENT_SERIES_COLORS.topLineColor,
    topFillColor1: SENTIMENT_SERIES_COLORS.topFillColor1,
    topFillColor2: SENTIMENT_SERIES_COLORS.topFillColor2,
    bottomLineColor: SENTIMENT_SERIES_COLORS.bottomLineColor,
    bottomFillColor1: SENTIMENT_SERIES_COLORS.bottomFillColor1,
    bottomFillColor2: SENTIMENT_SERIES_COLORS.bottomFillColor2,
    lineWidth: 2,
    lineType: LineType.Curved,
    priceFormat: {
      type: 'custom',
      formatter: (sentimentScore: number) => {
        const sign = sentimentScore >= 0 ? '+' : '';
        return `${sign}${sentimentScore.toFixed(2)}`;
      },
      minMove: 0.01,
    },
    crosshairMarkerVisible: true,
    crosshairMarkerRadius: 6,
    lastValueVisible: true,
    autoscaleInfoProvider: fixedSentimentRangeProvider,
  });
}

/**
 * Create the cumulative average line series
 */
export function createAverageSeries(
  chart: IChartApi,
  isDarkMode: boolean,
): ISeriesApi<'Line'> {
  const colors = getThemeColors(isDarkMode);

  return chart.addSeries(LineSeries, {
    color: colors.averageLine,
    lineWidth: 2,
    lineStyle: 2, // Dashed
    crosshairMarkerVisible: false,
    priceLineVisible: false,
    lastValueVisible: true,
    autoscaleInfoProvider: fixedSentimentRangeProvider,
  });
}

/**
 * Create reference price lines for sentiment thresholds.
 *
 * Shows key sentiment boundaries:
 * - 0: Neutral baseline (solid line with label)
 * - +1/-1: Maximum sentiment boundaries (solid lines with labels)
 * - +0.5/-0.5: Strong sentiment thresholds (dashed lines with labels)
 */
export function createPriceLines(
  sentimentSeries: ISeriesApi<'Baseline'>,
  isDarkMode: boolean,
): PriceLineRefs {
  const colors = getThemeColors(isDarkMode);

  const baseline = sentimentSeries.createPriceLine({
    price: PRICE_LINE_THRESHOLDS.baseline,
    color: colors.baseline,
    lineWidth: 1,
    lineStyle: LineStyle.Solid,
    axisLabelVisible: true,
  });

  const maxPositive = sentimentSeries.createPriceLine({
    price: PRICE_LINE_THRESHOLDS.maxPositive,
    color: colors.strongPositive,
    lineWidth: 1,
    lineStyle: LineStyle.Solid,
    axisLabelVisible: true,
  });

  const maxNegative = sentimentSeries.createPriceLine({
    price: PRICE_LINE_THRESHOLDS.maxNegative,
    color: colors.strongNegative,
    lineWidth: 1,
    lineStyle: LineStyle.Solid,
    axisLabelVisible: true,
  });

  const strongPositive = sentimentSeries.createPriceLine({
    price: PRICE_LINE_THRESHOLDS.strongPositive,
    color: colors.strongPositive,
    lineWidth: 1,
    lineStyle: LineStyle.Dashed,
    axisLabelVisible: false,
  });

  const strongNegative = sentimentSeries.createPriceLine({
    price: PRICE_LINE_THRESHOLDS.strongNegative,
    color: colors.strongNegative,
    lineWidth: 1,
    lineStyle: LineStyle.Dashed,
    axisLabelVisible: false,
  });

  return {
    baseline,
    maxPositive,
    maxNegative,
    strongPositive,
    strongNegative,
  };
}

/**
 * Update price line colors on theme change
 */
export function updatePriceLineColors(
  priceLines: PriceLineRefs,
  isDarkMode: boolean,
): void {
  const colors = getThemeColors(isDarkMode);

  priceLines.baseline?.applyOptions({ color: colors.baseline });
  priceLines.maxPositive?.applyOptions({ color: colors.strongPositive });
  priceLines.maxNegative?.applyOptions({ color: colors.strongNegative });
  priceLines.strongPositive?.applyOptions({ color: colors.strongPositive });
  priceLines.strongNegative?.applyOptions({ color: colors.strongNegative });
}

/**
 * Update average series color on theme change
 */
export function updateAverageSeriesColor(
  averageSeries: ISeriesApi<'Line'>,
  isDarkMode: boolean,
): void {
  const colors = getThemeColors(isDarkMode);
  averageSeries.applyOptions({ color: colors.averageLine });
}
