import { describe, expect, it } from 'vitest';
import {
  displayedDims,
  displayedPointToPage,
  displayedUpVector,
  normRectToDraw,
  clamp,
  clampRect,
} from '../src/coords';

describe('displayedDims', () => {
  it('keeps dimensions for 0 and 180', () => {
    expect(displayedDims(100, 200, 0)).toEqual({ wd: 100, hd: 200 });
    expect(displayedDims(100, 200, 180)).toEqual({ wd: 100, hd: 200 });
  });
  it('swaps dimensions for 90 and 270', () => {
    expect(displayedDims(100, 200, 90)).toEqual({ wd: 200, hd: 100 });
    expect(displayedDims(100, 200, 270)).toEqual({ wd: 200, hd: 100 });
  });
});

describe('displayedPointToPage', () => {
  const W = 100;
  const H = 200;
  it('maps top-left corner to the correct PDF corner for each rotation', () => {
    // displayed top-left (0,0) -> ...
    expect(displayedPointToPage(0, 0, W, H, 0)).toEqual({ x: 0, y: 200 });
    expect(displayedPointToPage(0, 0, W, H, 90)).toEqual({ x: 0, y: 0 });
    expect(displayedPointToPage(0, 0, W, H, 180)).toEqual({ x: 100, y: 0 });
    expect(displayedPointToPage(0, 0, W, H, 270)).toEqual({ x: 100, y: 200 });
  });
  it('maps an interior point (rotation 0) with the y-flip', () => {
    expect(displayedPointToPage(10, 120, W, H, 0)).toEqual({ x: 10, y: 80 });
  });
});

describe('normRectToDraw', () => {
  it('rotation 0: y-flips and keeps size', () => {
    const draw = normRectToDraw({ xNorm: 0.1, yNorm: 0.2, wNorm: 0.3, hNorm: 0.4 }, 100, 200, 0);
    expect(draw).toEqual({ x: 10, y: 80, width: 30, height: 80, rotate: 0 });
  });

  it('rotation 90: derives the pivot at the displayed bottom-left corner', () => {
    // Worked example from coords.ts: page 100x200, box at displayed TL (10,20) 30x40.
    // Normalised against displayed dims (200x100):
    const rect = { xNorm: 10 / 200, yNorm: 20 / 100, wNorm: 30 / 200, hNorm: 40 / 100 };
    const draw = normRectToDraw(rect, 100, 200, 90);
    expect(draw).toEqual({ x: 60, y: 10, width: 30, height: 40, rotate: 90 });
  });

  it('rotation 180: box maps to the opposite corner', () => {
    const draw = normRectToDraw({ xNorm: 0.1, yNorm: 0.2, wNorm: 0.3, hNorm: 0.4 }, 100, 200, 180);
    // dx=10,dy=40,dw=30,dh=80; BL displayed=(10,120) -> page {x:100-10=90, y:120}
    expect(draw).toEqual({ x: 90, y: 120, width: 30, height: 80, rotate: 180 });
  });

  it('produces a box that stays within the page bounds for a full-page rect', () => {
    const draw = normRectToDraw({ xNorm: 0, yNorm: 0, wNorm: 1, hNorm: 1 }, 100, 200, 0);
    expect(draw.x).toBeGreaterThanOrEqual(0);
    expect(draw.y).toBeGreaterThanOrEqual(0);
    expect(draw.x + draw.width).toBeLessThanOrEqual(100 + 1e-9);
    expect(draw.y + draw.height).toBeLessThanOrEqual(200 + 1e-9);
  });

  it('round-trips the displayed bottom-left corner through the pivot for all rotations', () => {
    const rots = [0, 90, 180, 270] as const;
    for (const r of rots) {
      const { wd, hd } = displayedDims(120, 300, r);
      const rect = { xNorm: 0.25, yNorm: 0.3, wNorm: 0.2, hNorm: 0.15 };
      const draw = normRectToDraw(rect, 120, 300, r);
      const expectedPivot = displayedPointToPage(
        rect.xNorm * wd,
        (rect.yNorm + rect.hNorm) * hd,
        120,
        300,
        r,
      );
      expect(draw.x).toBeCloseTo(expectedPivot.x, 6);
      expect(draw.y).toBeCloseTo(expectedPivot.y, 6);
      expect(draw.rotate).toBe(r);
    }
  });
});

describe('displayedUpVector', () => {
  it('points along +y for rotation 0 and +x for 90', () => {
    expect(displayedUpVector(0)).toEqual({ dx: 0, dy: 1 });
    expect(displayedUpVector(90)).toEqual({ dx: 1, dy: 0 });
    expect(displayedUpVector(180)).toEqual({ dx: 0, dy: -1 });
    expect(displayedUpVector(270)).toEqual({ dx: -1, dy: 0 });
  });
});

describe('clamp / clampRect', () => {
  it('clamps scalars', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(20, 0, 10)).toBe(10);
  });
  it('keeps a rect inside the page', () => {
    const r = clampRect({ xNorm: 0.9, yNorm: 0.95, wNorm: 0.3, hNorm: 0.2 });
    expect(r.xNorm + r.wNorm).toBeLessThanOrEqual(1 + 1e-9);
    expect(r.yNorm + r.hNorm).toBeLessThanOrEqual(1 + 1e-9);
    expect(r.xNorm).toBeGreaterThanOrEqual(0);
    expect(r.yNorm).toBeGreaterThanOrEqual(0);
  });
  it('enforces a minimum size', () => {
    const r = clampRect({ xNorm: 0.5, yNorm: 0.5, wNorm: 0, hNorm: -1 });
    expect(r.wNorm).toBeGreaterThan(0);
    expect(r.hNorm).toBeGreaterThan(0);
  });
});
