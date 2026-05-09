// Pure thresholding helpers for ThresholdFilter.
// Kept side-effect-free so they can be unit tested without a canvas.

export const LUMA_R = 0.2126;
export const LUMA_G = 0.7152;
export const LUMA_B = 0.0722;

export const MIN_THRESHOLD = 0;
export const MAX_THRESHOLD = 255;

export function luminance(r: number, g: number, b: number): number {
  return LUMA_R * r + LUMA_G * g + LUMA_B * b;
}

// Mutates the RGBA buffer in place: each pixel becomes pure black or pure
// white based on the Rec. 709 luma against the threshold. Alpha is preserved.
// Pixels with luma >= threshold map to white; below map to black.
export function applyThreshold(
  data: Uint8ClampedArray | number[],
  threshold: number,
): void {
  for (let i = 0; i < data.length; i += 4) {
    const v = luminance(data[i], data[i + 1], data[i + 2]);
    const binary = v >= threshold ? 255 : 0;
    data[i] = binary;
    data[i + 1] = binary;
    data[i + 2] = binary;
  }
}

// Display percentage shown next to the slider. Rounded to nearest integer.
export function thresholdPercent(threshold: number): number {
  return Math.round((threshold / MAX_THRESHOLD) * 100);
}
