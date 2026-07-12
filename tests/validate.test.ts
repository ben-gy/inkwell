import { describe, expect, it } from 'vitest';
import { looksLikePdf, isSupportedSignatureImage, normaliseRotation } from '../src/validate';

function bytes(str: string): Uint8Array {
  return new Uint8Array([...str].map((c) => c.charCodeAt(0)));
}

describe('looksLikePdf', () => {
  it('accepts a standard %PDF- header', () => {
    expect(looksLikePdf(bytes('%PDF-1.7\n...'))).toBe(true);
  });
  it('accepts a header after a few junk bytes', () => {
    const b = new Uint8Array([0x00, 0x0a, ...bytes('%PDF-1.4')]);
    expect(looksLikePdf(b)).toBe(true);
  });
  it('rejects a non-PDF', () => {
    expect(looksLikePdf(bytes('PK this is a zip'))).toBe(false);
    expect(looksLikePdf(bytes(''))).toBe(false);
  });
  it('rejects a header buried past the scan window', () => {
    const junk = new Uint8Array(2000);
    const b = new Uint8Array([...junk, ...bytes('%PDF-1.5')]);
    expect(looksLikePdf(b)).toBe(false);
  });
});

describe('isSupportedSignatureImage', () => {
  it('accepts common raster types', () => {
    expect(isSupportedSignatureImage('image/png')).toBe(true);
    expect(isSupportedSignatureImage('image/jpeg')).toBe(true);
    expect(isSupportedSignatureImage('image/webp')).toBe(true);
  });
  it('rejects unsupported types', () => {
    expect(isSupportedSignatureImage('image/svg+xml')).toBe(false);
    expect(isSupportedSignatureImage('application/pdf')).toBe(false);
    expect(isSupportedSignatureImage('')).toBe(false);
  });
});

describe('normaliseRotation', () => {
  it('snaps arbitrary angles to canonical rotations', () => {
    expect(normaliseRotation(0)).toBe(0);
    expect(normaliseRotation(90)).toBe(90);
    expect(normaliseRotation(-90)).toBe(270);
    expect(normaliseRotation(450)).toBe(90);
    expect(normaliseRotation(179)).toBe(180);
  });
});
