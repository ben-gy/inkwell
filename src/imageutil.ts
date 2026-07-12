/**
 * Pure image helpers operating on raw RGBA buffers, so they can be unit-tested
 * without a real canvas. The DOM-bound wrappers live in signature.ts.
 */

export interface RawImage {
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
}

export interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Find the tight bounding box of non-transparent pixels. Returns null if the
 * image is fully transparent. `alphaThreshold` (0..255) treats near-transparent
 * pixels as empty.
 */
export function contentBounds(img: RawImage, alphaThreshold = 8): Bounds | null {
  const { data, width, height } = img;
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > alphaThreshold) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  if (right < 0) return null;
  return { left, top, right, bottom };
}

/**
 * Given a source image size and a bounding box, compute the padded crop rect,
 * clamped to the image. Padding is in pixels.
 */
export function paddedCrop(
  bounds: Bounds,
  width: number,
  height: number,
  pad = 6,
): { x: number; y: number; w: number; h: number } {
  const x = Math.max(0, bounds.left - pad);
  const y = Math.max(0, bounds.top - pad);
  const right = Math.min(width, bounds.right + 1 + pad);
  const bottom = Math.min(height, bounds.bottom + 1 + pad);
  return { x, y, w: Math.max(1, right - x), h: Math.max(1, bottom - y) };
}

/**
 * Turn a mostly-white uploaded signature into one with a transparent
 * background by making pixels brighter than `threshold` (0..255) transparent.
 * Mutates and returns the buffer. Pure over RGBA arrays.
 */
export function whiteToTransparent(img: RawImage, threshold = 245): RawImage {
  const { data } = img;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] >= threshold && data[i + 1] >= threshold && data[i + 2] >= threshold) {
      data[i + 3] = 0;
    }
  }
  return img;
}
