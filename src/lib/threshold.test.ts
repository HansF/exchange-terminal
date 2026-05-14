import { describe, it, expect } from 'vitest';
import {
  applyThreshold,
  luminance,
  thresholdPercent,
  LUMA_R,
  LUMA_G,
  LUMA_B,
  MIN_THRESHOLD,
  MAX_THRESHOLD,
} from './threshold';

// One RGBA pixel = 4 entries [R, G, B, A].
const pixel = (r: number, g: number, b: number, a = 255): number[] => [r, g, b, a];

const buf = (...pixels: number[][]): Uint8ClampedArray => new Uint8ClampedArray(pixels.flat());

describe('luminance', () => {
  it('uses Rec. 709 weights', () => {
    expect(luminance(255, 0, 0)).toBeCloseTo(LUMA_R * 255);
    expect(luminance(0, 255, 0)).toBeCloseTo(LUMA_G * 255);
    expect(luminance(0, 0, 255)).toBeCloseTo(LUMA_B * 255);
  });

  it('returns 0 for black and 255 for white', () => {
    expect(luminance(0, 0, 0)).toBe(0);
    expect(luminance(255, 255, 255)).toBeCloseTo(255);
  });

  it('weights sum to ~1 so mid-grey stays mid-grey', () => {
    expect(LUMA_R + LUMA_G + LUMA_B).toBeCloseTo(1);
    expect(luminance(128, 128, 128)).toBeCloseTo(128);
  });
});

describe('applyThreshold', () => {
  it('maps pixels brighter than threshold to white and darker to black', () => {
    const data = buf(pixel(10, 10, 10), pixel(200, 200, 200));
    applyThreshold(data, 128);
    expect(Array.from(data)).toEqual([0, 0, 0, 255, 255, 255, 255, 255]);
  });

  it('treats luma == threshold as white (>= boundary)', () => {
    // Pure grey 128: luma is exactly 128 (weights sum to 1).
    const data = buf(pixel(128, 128, 128));
    applyThreshold(data, 128);
    expect(Array.from(data).slice(0, 3)).toEqual([255, 255, 255]);
  });

  it('treats luma just below threshold as black', () => {
    const data = buf(pixel(127, 127, 127));
    applyThreshold(data, 128);
    expect(Array.from(data).slice(0, 3)).toEqual([0, 0, 0]);
  });

  it('preserves the alpha channel', () => {
    const data = buf(pixel(10, 10, 10, 42), pixel(250, 250, 250, 99));
    applyThreshold(data, 128);
    expect(data[3]).toBe(42);
    expect(data[7]).toBe(99);
  });

  it('threshold 0 maps every pixel (including pure black) to white', () => {
    const data = buf(pixel(0, 0, 0), pixel(1, 1, 1), pixel(255, 255, 255));
    applyThreshold(data, MIN_THRESHOLD);
    for (let i = 0; i < data.length; i += 4) {
      expect(data[i]).toBe(255);
      expect(data[i + 1]).toBe(255);
      expect(data[i + 2]).toBe(255);
    }
  });

  it('threshold > 255 maps every pixel (including pure white) to black', () => {
    const data = buf(pixel(0, 0, 0), pixel(128, 128, 128), pixel(255, 255, 255));
    applyThreshold(data, MAX_THRESHOLD + 1);
    for (let i = 0; i < data.length; i += 4) {
      expect(data[i]).toBe(0);
      expect(data[i + 1]).toBe(0);
      expect(data[i + 2]).toBe(0);
    }
  });

  it('threshold 255 maps every pixel to black (no luma exceeds 255 in float math)', () => {
    // Float weights make luma(255,255,255) come out as ~255 but the >= 255
    // comparison is not guaranteed to hold across platforms, so we treat the
    // top of the slider as effectively "everything black."
    const data = buf(pixel(254, 254, 254), pixel(255, 255, 255));
    applyThreshold(data, MAX_THRESHOLD);
    expect(Array.from(data).slice(0, 3)).toEqual([0, 0, 0]);
    expect(Array.from(data).slice(4, 7)).toEqual([0, 0, 0]);
  });

  it('uses luma, not per-channel comparisons (saturated red is dark)', () => {
    // Pure red has luma ~54 — well below mid threshold.
    const data = buf(pixel(255, 0, 0));
    applyThreshold(data, 128);
    expect(Array.from(data).slice(0, 3)).toEqual([0, 0, 0]);
  });

  it('uses luma (saturated green is bright)', () => {
    // Pure green has luma ~182.
    const data = buf(pixel(0, 255, 0));
    applyThreshold(data, 128);
    expect(Array.from(data).slice(0, 3)).toEqual([255, 255, 255]);
  });

  it('handles an empty buffer without throwing', () => {
    const data = new Uint8ClampedArray(0);
    expect(() => applyThreshold(data, 128)).not.toThrow();
    expect(data.length).toBe(0);
  });

  it('is idempotent — applying twice yields the same buffer', () => {
    const data = buf(pixel(10, 20, 30), pixel(200, 210, 220), pixel(128, 128, 128));
    applyThreshold(data, 128);
    const once = Array.from(data);
    applyThreshold(data, 128);
    expect(Array.from(data)).toEqual(once);
  });

  it('processes large buffers across many pixels', () => {
    const pixels: number[][] = [];
    for (let i = 0; i < 1000; i++) pixels.push(pixel(i % 256, i % 256, i % 256));
    const data = buf(...pixels);
    applyThreshold(data, 128);
    for (let i = 0; i < data.length; i += 4) {
      expect(data[i] === 0 || data[i] === 255).toBe(true);
      expect(data[i]).toBe(data[i + 1]);
      expect(data[i + 1]).toBe(data[i + 2]);
    }
  });

  it('also accepts a plain number[] (not just Uint8ClampedArray)', () => {
    const data = [...pixel(10, 10, 10), ...pixel(250, 250, 250)];
    applyThreshold(data, 128);
    expect(data.slice(0, 3)).toEqual([0, 0, 0]);
    expect(data.slice(4, 7)).toEqual([255, 255, 255]);
  });
});

describe('thresholdPercent', () => {
  it('maps the slider endpoints to 0% and 100%', () => {
    expect(thresholdPercent(MIN_THRESHOLD)).toBe(0);
    expect(thresholdPercent(MAX_THRESHOLD)).toBe(100);
  });

  it('maps the midpoint to ~50%', () => {
    expect(thresholdPercent(128)).toBe(50);
    expect(thresholdPercent(127)).toBe(50);
  });

  it('rounds to the nearest integer', () => {
    // 64/255 = 0.25098 → 25
    expect(thresholdPercent(64)).toBe(25);
    // 200/255 = 0.7843 → 78
    expect(thresholdPercent(200)).toBe(78);
  });
});
