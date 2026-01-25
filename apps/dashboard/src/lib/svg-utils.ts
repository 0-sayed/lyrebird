/**
 * SVG path and geometry utilities
 */

export interface Point {
  x: number;
  y: number;
}

/**
 * Convert polar coordinates to Cartesian coordinates
 *
 * @param centerX - Center X coordinate
 * @param centerY - Center Y coordinate
 * @param radius - Distance from center
 * @param angleInDegrees - Angle in degrees (0 = right, 90 = down)
 * @returns Cartesian point {x, y}
 */
export function polarToCartesian(
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number,
): Point {
  const angleInRadians = ((angleInDegrees - 180) * Math.PI) / 180;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

/**
 * Generate an SVG arc path string
 *
 * @param x - Center X coordinate
 * @param y - Center Y coordinate
 * @param radius - Arc radius
 * @param startAngle - Starting angle in degrees
 * @param endAngle - Ending angle in degrees
 * @returns SVG path 'd' attribute string
 */
export function describeArc(
  x: number,
  y: number,
  radius: number,
  startAngle: number,
  endAngle: number,
): string {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

  return [
    'M',
    start.x,
    start.y,
    'A',
    radius,
    radius,
    0,
    largeArcFlag,
    0,
    end.x,
    end.y,
  ].join(' ');
}
