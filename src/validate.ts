// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
/** Input validation helpers. */

/** True if the bytes begin with the `%PDF-` signature (optionally after a small BOM/junk prefix). */
export function looksLikePdf(bytes: Uint8Array): boolean {
  // %PDF- == 0x25 0x50 0x44 0x46 0x2D. Some files have a few junk bytes first.
  const sig = [0x25, 0x50, 0x44, 0x46, 0x2d];
  const limit = Math.min(bytes.length - sig.length, 1024);
  for (let start = 0; start <= limit; start++) {
    let ok = true;
    for (let i = 0; i < sig.length; i++) {
      if (bytes[start + i] !== sig[i]) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

/** Accepted image MIME types for uploaded signatures. */
export function isSupportedSignatureImage(type: string): boolean {
  return /^image\/(png|jpeg|jpg|webp|gif)$/i.test(type);
}

/** Normalise a page /Rotate integer into one of the four canonical rotations. */
export function normaliseRotation(deg: number): 0 | 90 | 180 | 270 {
  const r = ((Math.round(deg / 90) * 90) % 360 + 360) % 360;
  return r as 0 | 90 | 180 | 270;
}
