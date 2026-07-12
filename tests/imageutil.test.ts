import { describe, expect, it } from 'vitest';
import { contentBounds, paddedCrop, whiteToTransparent, type RawImage } from '../src/imageutil';

/** Build an RGBA image of given size, all transparent. */
function blank(width: number, height: number): RawImage {
  return { data: new Uint8ClampedArray(width * height * 4), width, height };
}

function setPixel(img: RawImage, x: number, y: number, r: number, g: number, b: number, a: number): void {
  const i = (y * img.width + x) * 4;
  img.data[i] = r;
  img.data[i + 1] = g;
  img.data[i + 2] = b;
  img.data[i + 3] = a;
}

describe('contentBounds', () => {
  it('returns null for a fully transparent image', () => {
    expect(contentBounds(blank(10, 10))).toBeNull();
  });

  it('finds a single opaque pixel', () => {
    const img = blank(10, 10);
    setPixel(img, 4, 6, 0, 0, 0, 255);
    expect(contentBounds(img)).toEqual({ left: 4, top: 6, right: 4, bottom: 6 });
  });

  it('finds the tight bounds of a cluster', () => {
    const img = blank(20, 20);
    setPixel(img, 3, 5, 0, 0, 0, 255);
    setPixel(img, 12, 15, 0, 0, 0, 255);
    expect(contentBounds(img)).toEqual({ left: 3, top: 5, right: 12, bottom: 15 });
  });

  it('ignores near-transparent pixels under the threshold', () => {
    const img = blank(10, 10);
    setPixel(img, 5, 5, 0, 0, 0, 4); // alpha 4 < default threshold 8
    expect(contentBounds(img)).toBeNull();
  });
});

describe('paddedCrop', () => {
  it('pads and clamps to the image edges', () => {
    const crop = paddedCrop({ left: 2, top: 2, right: 5, bottom: 5 }, 10, 10, 3);
    expect(crop).toEqual({ x: 0, y: 0, w: 9, h: 9 });
  });
  it('never exceeds the image', () => {
    const crop = paddedCrop({ left: 8, top: 8, right: 9, bottom: 9 }, 10, 10, 5);
    expect(crop.x + crop.w).toBeLessThanOrEqual(10);
    expect(crop.y + crop.h).toBeLessThanOrEqual(10);
  });
});

describe('whiteToTransparent', () => {
  it('makes white pixels transparent and leaves dark pixels opaque', () => {
    const img = blank(2, 1);
    setPixel(img, 0, 0, 255, 255, 255, 255); // white
    setPixel(img, 1, 0, 10, 10, 10, 255); // dark ink
    whiteToTransparent(img, 245);
    expect(img.data[3]).toBe(0); // white -> transparent
    expect(img.data[7]).toBe(255); // ink -> untouched
  });
});
