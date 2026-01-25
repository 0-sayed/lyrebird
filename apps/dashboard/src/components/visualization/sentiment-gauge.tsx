import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { polarToCartesian, describeArc } from '@/lib/svg-utils';
import { getNSSDescription, getNSSColorClass } from '@/lib/sentiment-utils';

// =============================================================================
// Types
// =============================================================================

export interface SentimentGaugeProps {
  /** Net Sentiment Score (-100 to +100) */
  nss: number;
  /** Chart title */
  title?: string;
  /** Size of the gauge */
  size?: 'sm' | 'md' | 'lg';
  /** Show numerical value */
  showValue?: boolean;
  /** Show description label */
  showLabel?: boolean;
  /** Additional class names */
  className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const SIZE_CONFIG = {
  sm: { width: 120, height: 70, strokeWidth: 8, fontSize: 'text-lg' },
  md: { width: 180, height: 100, strokeWidth: 10, fontSize: 'text-2xl' },
  lg: { width: 240, height: 130, strokeWidth: 12, fontSize: 'text-3xl' },
} as const;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Convert NSS (-100 to +100) to an angle (0 to 180 degrees)
 */
function nssToAngle(nss: number): number {
  // Clamp NSS to valid range
  const clampedNss = Math.max(-100, Math.min(100, nss));
  // Map -100..+100 to 0..180
  return ((clampedNss + 100) / 200) * 180;
}

/**
 * Get the color for a given NSS value
 */
function getNSSColor(nss: number): string {
  if (nss >= 50) return 'hsl(var(--chart-positive))';
  if (nss >= 20) return 'hsl(142.1 60% 50%)'; // Lighter green
  if (nss >= -20) return 'hsl(var(--chart-neutral))';
  if (nss >= -50) return 'hsl(0 60% 60%)'; // Lighter red
  return 'hsl(var(--chart-negative))';
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * Semi-circular gauge for displaying Net Sentiment Score
 *
 * Features:
 * - Visual representation of NSS from -100 to +100
 * - Color gradient from red (negative) through gray (neutral) to green (positive)
 * - Animated needle/indicator
 * - Accessible with ARIA labels
 */
export function SentimentGauge({
  nss,
  title = 'Net Sentiment Score',
  size = 'md',
  showValue = true,
  showLabel = true,
  className,
}: SentimentGaugeProps) {
  const config = SIZE_CONFIG[size];
  const { width, height, strokeWidth, fontSize } = config;

  const centerX = width / 2;
  const centerY = height - 10;
  const radius = Math.min(centerX, centerY) - strokeWidth;

  const angle = nssToAngle(nss);
  const color = getNSSColor(nss);
  const description = getNSSDescription(nss);

  // Calculate needle position
  const needleAngle = angle;
  const needleEnd = polarToCartesian(centerX, centerY, radius - 5, needleAngle);

  return (
    <Card className={cn('w-fit', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-center text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center pb-4">
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`Net Sentiment Score: ${nss}. ${description}`}
        >
          {/* Background arc segments */}
          <defs>
            <linearGradient
              id="gaugeGradient"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="0%"
            >
              <stop offset="0%" stopColor="hsl(var(--chart-negative))" />
              <stop offset="35%" stopColor="hsl(var(--chart-negative))" />
              <stop offset="50%" stopColor="hsl(var(--chart-neutral))" />
              <stop offset="65%" stopColor="hsl(var(--chart-positive))" />
              <stop offset="100%" stopColor="hsl(var(--chart-positive))" />
            </linearGradient>
          </defs>

          {/* Background track */}
          <path
            d={describeArc(centerX, centerY, radius, 0, 180)}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />

          {/* Colored arc up to current value */}
          {angle > 0 && (
            <path
              d={describeArc(centerX, centerY, radius, 0, angle)}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              className="transition-all duration-500"
            />
          )}

          {/* Needle */}
          <line
            x1={centerX}
            y1={centerY}
            x2={needleEnd.x}
            y2={needleEnd.y}
            stroke="hsl(var(--foreground))"
            strokeWidth={2}
            strokeLinecap="round"
            className="transition-all duration-500"
          />

          {/* Needle center dot */}
          <circle
            cx={centerX}
            cy={centerY}
            r={4}
            fill="hsl(var(--foreground))"
          />

          {/* Scale labels */}
          <text
            x={strokeWidth}
            y={centerY + 15}
            className="fill-muted-foreground text-xs"
            textAnchor="start"
          >
            -100
          </text>
          <text
            x={centerX}
            y={centerY - radius - 5}
            className="fill-muted-foreground text-xs"
            textAnchor="middle"
          >
            0
          </text>
          <text
            x={width - strokeWidth}
            y={centerY + 15}
            className="fill-muted-foreground text-xs"
            textAnchor="end"
          >
            +100
          </text>
        </svg>

        {/* Value display */}
        {showValue && (
          <p
            className={cn(
              'mt-2 font-bold transition-colors',
              fontSize,
              getNSSColorClass(nss),
            )}
          >
            {nss > 0 ? '+' : ''}
            {nss}
          </p>
        )}

        {/* Description label */}
        {showLabel && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

// Re-export SentimentGaugeInline for backward compatibility
export { SentimentGaugeInline } from './sentiment-gauge-inline';
