import { describe, expect, it } from 'vitest';
import { formatBytes, signedFilename, formatDate, nextId } from '../src/format';

describe('formatBytes', () => {
  it('formats bytes, KB, MB', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });
  it('handles invalid input', () => {
    expect(formatBytes(-1)).toBe('—');
    expect(formatBytes(NaN)).toBe('—');
  });
});

describe('signedFilename', () => {
  it('appends -signed before the extension', () => {
    expect(signedFilename('contract.pdf')).toBe('contract-signed.pdf');
  });
  it('handles uppercase extension', () => {
    expect(signedFilename('Lease.PDF')).toBe('Lease-signed.pdf');
  });
  it('strips a path', () => {
    expect(signedFilename('/Users/me/Docs/nda.pdf')).toBe('nda-signed.pdf');
  });
  it('does not double-suffix', () => {
    expect(signedFilename('contract-signed.pdf')).toBe('contract-signed.pdf');
  });
  it('falls back for empty / weird names', () => {
    expect(signedFilename('')).toBe('document-signed.pdf');
    expect(signedFilename('noext')).toBe('noext-signed.pdf');
  });
});

describe('formatDate', () => {
  it('renders ISO-ish yyyy-mm-dd with padding', () => {
    expect(formatDate(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(formatDate(new Date(2026, 11, 31))).toBe('2026-12-31');
  });
});

describe('nextId', () => {
  it('produces unique ids with a prefix', () => {
    const a = nextId('sig');
    const b = nextId('sig');
    expect(a).not.toBe(b);
    expect(a.startsWith('sig')).toBe(true);
  });
});
