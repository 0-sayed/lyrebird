import { describe, expect, it } from 'vitest';

import { describeArc, polarToCartesian } from '../svg-utils';

// =============================================================================
// polarToCartesian Tests
// =============================================================================

describe('polarToCartesian', () => {
  it('returns correct point at 0 degrees (right side)', () => {
    // 0 degrees points right, but with the -180 offset in the formula,
    // 0 degrees actually points left
    const result = polarToCartesian(100, 100, 50, 0);
    expect(result.x).toBeCloseTo(50, 5);
    expect(result.y).toBeCloseTo(100, 5);
  });

  it('returns correct point at 90 degrees (bottom)', () => {
    // 90 degrees with -180 offset points up
    const result = polarToCartesian(100, 100, 50, 90);
    expect(result.x).toBeCloseTo(100, 5);
    expect(result.y).toBeCloseTo(50, 5);
  });

  it('returns correct point at 180 degrees (left side)', () => {
    // 180 degrees with -180 offset points right
    const result = polarToCartesian(100, 100, 50, 180);
    expect(result.x).toBeCloseTo(150, 5);
    expect(result.y).toBeCloseTo(100, 5);
  });

  it('returns correct point at 270 degrees (top)', () => {
    // 270 degrees with -180 offset points down
    const result = polarToCartesian(100, 100, 50, 270);
    expect(result.x).toBeCloseTo(100, 5);
    expect(result.y).toBeCloseTo(150, 5);
  });

  it('handles zero radius', () => {
    const result = polarToCartesian(100, 100, 0, 45);
    expect(result.x).toBeCloseTo(100, 5);
    expect(result.y).toBeCloseTo(100, 5);
  });

  it('handles negative angles', () => {
    const result = polarToCartesian(100, 100, 50, -90);
    expect(result.x).toBeCloseTo(100, 5);
    expect(result.y).toBeCloseTo(150, 5);
  });

  it('handles angles greater than 360', () => {
    const result = polarToCartesian(100, 100, 50, 450);
    // 450 degrees = 90 degrees
    expect(result.x).toBeCloseTo(100, 5);
    expect(result.y).toBeCloseTo(50, 5);
  });

  it('handles different center coordinates', () => {
    const result = polarToCartesian(200, 300, 50, 0);
    expect(result.x).toBeCloseTo(150, 5);
    expect(result.y).toBeCloseTo(300, 5);
  });

  it('handles different radius values', () => {
    const result = polarToCartesian(100, 100, 100, 0);
    expect(result.x).toBeCloseTo(0, 5);
    expect(result.y).toBeCloseTo(100, 5);
  });
});

// =============================================================================
// describeArc Tests
// =============================================================================

describe('describeArc', () => {
  it('generates valid SVG path string format', () => {
    const result = describeArc(100, 100, 50, 0, 90);
    // Should start with M (moveto) and contain A (arc)
    expect(result).toMatch(/^M\s+[\d.]+\s+[\d.]+\s+A/);
  });

  it('contains all required arc parameters', () => {
    const result = describeArc(100, 100, 50, 0, 90);
    const parts = result.split(/\s+/);
    // M x y A rx ry rotation largeArcFlag sweepFlag x y
    expect(parts).toHaveLength(11);
    expect(parts[0]).toBe('M');
    expect(parts[3]).toBe('A');
  });

  it('uses correct radius in arc command', () => {
    const radius = 75;
    const result = describeArc(100, 100, radius, 0, 90);
    const parts = result.split(/\s+/);
    // Arc radii are parts[4] and parts[5]
    expect(parseFloat(parts[4]!)).toBe(radius);
    expect(parseFloat(parts[5]!)).toBe(radius);
  });

  it('sets large-arc-flag to 0 for arcs <= 180 degrees', () => {
    const result = describeArc(100, 100, 50, 0, 90);
    const parts = result.split(/\s+/);
    // largeArcFlag is parts[7]
    expect(parts[7]).toBe('0');
  });

  it('sets large-arc-flag to 1 for arcs > 180 degrees', () => {
    const result = describeArc(100, 100, 50, 0, 270);
    const parts = result.split(/\s+/);
    // largeArcFlag is parts[7]
    expect(parts[7]).toBe('1');
  });

  it('sets large-arc-flag to 0 for exactly 180 degrees', () => {
    const result = describeArc(100, 100, 50, 0, 180);
    const parts = result.split(/\s+/);
    expect(parts[7]).toBe('0');
  });

  it('handles small arc angles', () => {
    const result = describeArc(100, 100, 50, 0, 10);
    expect(result).toMatch(/^M\s+[\d.]+\s+[\d.]+\s+A/);
  });

  it('handles full circle arc (360 degrees)', () => {
    const result = describeArc(100, 100, 50, 0, 360);
    const parts = result.split(/\s+/);
    // 360 > 180, so large-arc-flag should be 1
    expect(parts[7]).toBe('1');
  });

  it('handles different center coordinates', () => {
    const result = describeArc(200, 300, 50, 0, 90);
    expect(result).toMatch(/^M\s+[\d.]+\s+[\d.]+\s+A/);
  });

  it('produces consistent output for same input', () => {
    const result1 = describeArc(100, 100, 50, 0, 90);
    const result2 = describeArc(100, 100, 50, 0, 90);
    expect(result1).toBe(result2);
  });
});
