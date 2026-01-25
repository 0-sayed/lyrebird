/**
 * Chart theme configuration for lightweight-charts
 *
 * Centralized theme colors and configurations for sentiment charts.
 */
import {
  ColorType,
  CrosshairMode,
  type DeepPartial,
  type ChartOptions,
} from 'lightweight-charts';

// =============================================================================
// Types
// =============================================================================

export interface ChartThemeColors {
  text: string;
  labelBg: string;
  gridLine: string;
  crosshair: string;
  border: string;
  baseline: string;
  baselineLight: string;
  strongPositive: string;
  strongNegative: string;
  neutralBoundary: string;
  averageLine: string;
}

// =============================================================================
// Theme Colors
// =============================================================================

export const CHART_THEME_COLORS = {
  dark: {
    text: '#a1a1aa',
    labelBg: '#374151',
    gridLine: 'rgba(255, 255, 255, 0.1)',
    crosshair: '#6b7280',
    border: 'rgba(255, 255, 255, 0.1)',
    baseline: 'rgba(148, 163, 184, 0.6)',
    baselineLight: 'rgba(148, 163, 184, 0.25)',
    strongPositive: 'rgba(34, 197, 94, 0.15)',
    strongNegative: 'rgba(239, 68, 68, 0.15)',
    neutralBoundary: 'rgba(148, 163, 184, 0.25)',
    averageLine: 'rgba(161, 161, 170, 0.8)',
  },
  light: {
    text: '#71717a',
    labelBg: '#f3f4f6',
    gridLine: 'rgba(0, 0, 0, 0.1)',
    crosshair: '#9ca3af',
    border: 'rgba(0, 0, 0, 0.1)',
    baseline: 'rgba(100, 116, 139, 0.6)',
    baselineLight: 'rgba(100, 116, 139, 0.25)',
    strongPositive: 'rgba(22, 163, 74, 0.15)',
    strongNegative: 'rgba(220, 38, 38, 0.15)',
    neutralBoundary: 'rgba(100, 116, 139, 0.25)',
    averageLine: 'rgba(113, 113, 122, 0.8)',
  },
} as const;

// =============================================================================
// Price Line Thresholds
// =============================================================================

/**
 * Y-axis reference line thresholds for sentiment visualization.
 * These create visual guides at key sentiment values:
 * - +1/-1: Maximum sentiment boundaries
 * - +0.5/-0.5: Strong positive/negative thresholds
 * - +0.1/-0.1: Neutral zone boundaries (not displayed as lines)
 */
export const PRICE_LINE_THRESHOLDS = {
  baseline: 0,
  maxPositive: 1,
  maxNegative: -1,
  strongPositive: 0.5,
  strongNegative: -0.5,
  neutralUpper: 0.1,
  neutralLower: -0.1,
} as const;

// =============================================================================
// Sentiment Series Colors
// =============================================================================

export const SENTIMENT_SERIES_COLORS = {
  // Top area (above baseline) - GREEN for positive sentiment
  topLineColor: 'rgba(34, 197, 94, 1)',
  topFillColor1: 'rgba(34, 197, 94, 0.4)',
  topFillColor2: 'rgba(34, 197, 94, 0.05)',
  // Bottom area (below baseline) - RED for negative sentiment
  bottomLineColor: 'rgba(239, 68, 68, 1)',
  bottomFillColor1: 'rgba(239, 68, 68, 0.05)',
  bottomFillColor2: 'rgba(239, 68, 68, 0.4)',
} as const;

// =============================================================================
// Chart Options Builder
// =============================================================================

/**
 * Get chart options based on current theme
 */
export function getChartOptions(
  isDarkMode: boolean,
): DeepPartial<ChartOptions> {
  const colors = isDarkMode
    ? CHART_THEME_COLORS.dark
    : CHART_THEME_COLORS.light;

  return {
    layout: {
      background: { type: ColorType.Solid, color: 'transparent' },
      textColor: colors.text,
      fontFamily: 'system-ui, -apple-system, sans-serif',
      attributionLogo: false,
    },
    grid: {
      vertLines: { color: colors.gridLine },
      horzLines: { color: colors.gridLine },
    },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: {
        color: colors.crosshair,
        width: 1,
        style: 2, // Dashed
        labelBackgroundColor: colors.labelBg,
      },
      horzLine: {
        color: colors.crosshair,
        width: 1,
        style: 2,
        labelBackgroundColor: colors.labelBg,
      },
    },
    timeScale: {
      timeVisible: true,
      secondsVisible: true,
      borderColor: colors.border,
      rightOffset: 5,
      barSpacing: 50,
      minBarSpacing: 8,
    },
    rightPriceScale: {
      borderColor: colors.border,
      scaleMargins: {
        top: 0,
        bottom: 0,
      },
    },
    handleScroll: {
      mouseWheel: true,
      pressedMouseMove: true,
      horzTouchDrag: true,
      vertTouchDrag: false,
    },
    handleScale: {
      mouseWheel: true,
      pinch: true,
      axisPressedMouseMove: {
        time: true,
        price: false, // Lock sentiment Y-axis scaling
      },
    },
  };
}

/**
 * Get theme colors for a given mode
 */
export function getThemeColors(isDarkMode: boolean): ChartThemeColors {
  return isDarkMode ? CHART_THEME_COLORS.dark : CHART_THEME_COLORS.light;
}
