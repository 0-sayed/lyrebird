import * as React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  preparePieChartData,
  calculateNSS,
  getNSSColorClass,
} from '@/lib/sentiment-utils';
import { ChartTooltip } from './chart-tooltip';
import { ChartCenterLabel } from './chart-center-label';
import { ChartCustomLegend } from './chart-custom-legend';
import type { SentimentDistribution } from '@/types/api';

// =============================================================================
// Types
// =============================================================================

export interface SentimentChartProps {
  /** Sentiment distribution data */
  distribution: SentimentDistribution;
  /** Chart title */
  title?: string;
  /** Show legend */
  showLegend?: boolean;
  /** Chart size (width and height) */
  size?: number;
  /** Additional class names */
  className?: string;
  /** Animate on mount */
  animate?: boolean;
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * Sentiment distribution pie/donut chart
 *
 * Features:
 * - Donut chart with NSS (Net Sentiment Score) in center
 * - Custom tooltip with post counts
 * - Responsive container
 * - Accessible with ARIA labels
 * - Animated on mount (optional)
 */
export function SentimentChart({
  distribution,
  title = 'Sentiment Distribution',
  showLegend = true,
  size = 200,
  className,
  animate = true,
}: SentimentChartProps) {
  const chartData = React.useMemo(() => {
    const data = preparePieChartData(distribution);
    const total =
      distribution.positive + distribution.neutral + distribution.negative;

    return data.map((item) => ({
      ...item,
      percentage: total > 0 ? Math.round((item.value / total) * 100) : 0,
    }));
  }, [distribution]);

  const total = React.useMemo(
    () => distribution.positive + distribution.neutral + distribution.negative,
    [distribution],
  );

  const nss = React.useMemo(() => calculateNSS(distribution), [distribution]);

  // Don't render if no data
  if (total === 0) {
    return (
      <Card className={cn('w-full', className)}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-sm text-muted-foreground">
            No sentiment data available
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className="mx-auto"
          style={{ width: size, height: size }}
          role="img"
          aria-label={`Sentiment distribution: ${distribution.positive} positive, ${distribution.neutral} neutral, ${distribution.negative} negative. Net Sentiment Score: ${nss}`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={size * 0.3}
                outerRadius={size * 0.45}
                paddingAngle={2}
                dataKey="value"
                animationDuration={animate ? 800 : 0}
                animationBegin={0}
                aria-hidden="true"
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.fill}
                    strokeWidth={0}
                  />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
              {/* Center label with NSS */}
              <text x="50%" y="50%" textAnchor="middle">
                <ChartCenterLabel cx={size / 2} cy={size / 2} nss={nss} />
              </text>
            </PieChart>
          </ResponsiveContainer>
        </div>

        {showLegend && (
          <div className="mt-4">
            <ChartCustomLegend data={chartData} total={total} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Compact version of the sentiment chart without card wrapper
 */
export function SentimentChartCompact({
  distribution,
  size = 120,
  className,
}: {
  distribution: SentimentDistribution;
  size?: number;
  className?: string;
}) {
  const chartData = React.useMemo(
    () => preparePieChartData(distribution),
    [distribution],
  );

  const total =
    distribution.positive + distribution.neutral + distribution.negative;
  const nss = calculateNSS(distribution);

  if (total === 0) return null;

  return (
    <div
      className={cn('flex items-center gap-4', className)}
      role="img"
      aria-label={`Sentiment: ${nss > 0 ? '+' : ''}${nss} NSS`}
    >
      <div style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={size * 0.3}
              outerRadius={size * 0.45}
              paddingAngle={2}
              dataKey="value"
              animationDuration={500}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} strokeWidth={0} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="text-center">
        <p className="text-xs text-muted-foreground">NSS</p>
        <p className={cn('text-2xl font-bold', getNSSColorClass(nss))}>
          {nss > 0 ? '+' : ''}
          {nss}
        </p>
      </div>
    </div>
  );
}
