// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
/**
 * PDF export via pdf-lib. Takes the original bytes plus the placed annotations
 * and writes each one into the correct page at the correct PDF coordinate,
 * using the pure geometry in coords.ts.
 */

import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import type { Annotation, Rotation } from './types';
import { normRectToDraw, displayedDims, displayedUpVector } from './coords';
import { normaliseRotation } from './validate';

export interface ExportProgress {
  done: number;
  total: number;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return { r: 0.1, g: 0.1, b: 0.27 };
  const n = parseInt(m[1], 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

/**
 * Produce the signed PDF bytes. `annotations` may reference any page; each is
 * drawn onto its page. Progress is reported per annotation.
 */
export async function exportSignedPdf(
  originalBytes: Uint8Array,
  annotations: Annotation[],
  onProgress?: (p: ExportProgress) => void,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(originalBytes, { ignoreEncryption: true });
  const pages = pdf.getPages();
  const helv = await pdf.embedFont(StandardFonts.Helvetica);

  // Cache embedded images by identity so a reused signature is embedded once.
  const imageCache = new Map<Uint8Array, Awaited<ReturnType<typeof pdf.embedPng>>>();

  let done = 0;
  const total = annotations.length;

  for (const ann of annotations) {
    const page = pages[ann.pageIndex];
    if (!page) {
      onProgress?.({ done: ++done, total });
      continue;
    }
    const size = page.getSize();
    const rotation: Rotation = normaliseRotation(page.getRotation().angle);
    const widthPt = size.width;
    const heightPt = size.height;

    const draw = normRectToDraw(
      { xNorm: ann.xNorm, yNorm: ann.yNorm, wNorm: ann.wNorm, hNorm: ann.hNorm },
      widthPt,
      heightPt,
      rotation,
    );

    if (ann.kind === 'text' || ann.kind === 'date') {
      const text = ann.text ?? '';
      if (text.trim()) {
        const { hd } = displayedDims(widthPt, heightPt, rotation);
        // Font size ~ 70% of the box height (in displayed points).
        const fontSize = Math.max(6, ann.hNorm * hd * 0.7);
        const color = hexToRgb(ann.color ?? '#1a1a44');
        // Nudge baseline up from the box's bottom edge along displayed "up".
        const up = displayedUpVector(rotation);
        const lift = fontSize * 0.28;
        page.drawText(text, {
          x: draw.x + up.dx * lift,
          y: draw.y + up.dy * lift,
          size: fontSize,
          font: helv,
          color: rgb(color.r, color.g, color.b),
          rotate: degrees(draw.rotate),
        });
      }
    } else if (ann.imageBytes) {
      let img = imageCache.get(ann.imageBytes);
      if (!img) {
        img = await pdf.embedPng(ann.imageBytes);
        imageCache.set(ann.imageBytes, img);
      }
      page.drawImage(img, {
        x: draw.x,
        y: draw.y,
        width: draw.width,
        height: draw.height,
        rotate: degrees(draw.rotate),
      });
    }
    onProgress?.({ done: ++done, total });
  }

  return pdf.save();
}

/** Quick page-geometry probe used by the loader without rendering. */
export async function readPageGeometry(
  bytes: Uint8Array,
): Promise<Array<{ widthPt: number; heightPt: number; rotation: Rotation }>> {
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
  return pdf.getPages().map((p) => {
    const s = p.getSize();
    return { widthPt: s.width, heightPt: s.height, rotation: normaliseRotation(p.getRotation().angle) };
  });
}
