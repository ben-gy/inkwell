/**
 * PDF rendering via pdf.js. Parsing and rasterising happen in pdf.js's own
 * bundled Web Worker (no CDN, no network) so the main thread stays responsive.
 */

import * as pdfjs from 'pdfjs-dist';
// Bundle the worker locally as an asset URL — keeps everything same-origin.
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { PageInfo } from './types';
import { normaliseRotation } from './validate';

pdfjs.GlobalWorkerOptions.workerSrc = PdfWorker;

export interface RenderedPage {
  info: PageInfo;
  canvas: HTMLCanvasElement;
  /** CSS pixel size the canvas is displayed at (before any layout scaling). */
  cssWidth: number;
  cssHeight: number;
}

export class PdfPreview {
  private doc: PDFDocumentProxy | null = null;

  get pageCount(): number {
    return this.doc?.numPages ?? 0;
  }

  /** Load a document from bytes. A fresh copy is passed to pdf.js so the
   * original buffer stays intact for pdf-lib at export time. */
  async load(bytes: Uint8Array): Promise<void> {
    await this.destroy();
    const task = pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false });
    this.doc = await task.promise;
  }

  /**
   * Render one page to a canvas at a target on-screen width (CSS px), capped at
   * device pixel ratio for sharpness. Returns the canvas plus geometry.
   */
  async renderPage(index: number, targetCssWidth: number): Promise<RenderedPage> {
    if (!this.doc) throw new Error('no document loaded');
    const page = await this.doc.getPage(index + 1);
    const rotation = normaliseRotation(page.rotate);

    // viewport at scale 1 gives displayed (rotation-aware) size in points.
    const base = page.getViewport({ scale: 1 });
    const displayScale = targetCssWidth / base.width;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const viewport = page.getViewport({ scale: displayScale * dpr });

    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');

    const cssWidth = base.width * displayScale;
    const cssHeight = base.height * displayScale;
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;

    await page.render({ canvasContext: ctx, viewport }).promise;

    // Unrotated media-box size in points.
    const unrotated =
      rotation === 90 || rotation === 270
        ? { widthPt: base.height, heightPt: base.width }
        : { widthPt: base.width, heightPt: base.height };

    page.cleanup();

    return {
      info: { index, rotation, ...unrotated },
      canvas,
      cssWidth,
      cssHeight,
    };
  }

  async destroy(): Promise<void> {
    if (this.doc) {
      await this.doc.destroy();
      this.doc = null;
    }
  }
}
