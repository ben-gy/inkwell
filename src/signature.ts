// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
/**
 * Signature creation. Three sources, one output: a tightly-cropped transparent
 * PNG (bytes + natural size) that pdf-lib can embed.
 *
 *   - draw  : pressure-sensitive ink on a canvas via Pointer Events
 *   - type  : a name rendered in a handwriting-ish font
 *   - upload : an image file with its white background knocked out
 */

import { contentBounds, paddedCrop, whiteToTransparent, type RawImage } from './imageutil';

export interface SignatureImage {
  bytes: Uint8Array;
  width: number;
  height: number;
}

const INK = '#1a1a44';

/** Read a canvas, crop to its ink, and return transparent-PNG bytes. */
async function canvasToTrimmedPng(source: HTMLCanvasElement): Promise<SignatureImage | null> {
  const ctx = source.getContext('2d');
  if (!ctx) return null;
  const full = ctx.getImageData(0, 0, source.width, source.height);
  const raw: RawImage = { data: full.data, width: source.width, height: source.height };
  const bounds = contentBounds(raw, 8);
  if (!bounds) return null;
  const crop = paddedCrop(bounds, source.width, source.height, 8);

  const out = document.createElement('canvas');
  out.width = crop.w;
  out.height = crop.h;
  const octx = out.getContext('2d');
  if (!octx) return null;
  octx.drawImage(source, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h);

  const bytes = await canvasPngBytes(out);
  return bytes ? { bytes, width: crop.w, height: crop.h } : null;
}

function canvasPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        resolve(null);
        return;
      }
      blob.arrayBuffer().then((b) => resolve(new Uint8Array(b)));
    }, 'image/png');
  });
}

/**
 * A signature drawing pad bound to a canvas. Pressure (where the device reports
 * it) modulates stroke width for a natural feel; otherwise a fixed nib is used.
 */
export class SignaturePad {
  private ctx: CanvasRenderingContext2D;
  private drawing = false;
  private last: { x: number; y: number; p: number } | null = null;
  private dirty = false;
  private onFirstStroke: (() => void) | null;

  constructor(private canvas: HTMLCanvasElement, onFirstStroke?: () => void) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');
    this.ctx = ctx;
    this.onFirstStroke = onFirstStroke ?? null;
    this.resize();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = INK;

    canvas.addEventListener('pointerdown', this.down);
    canvas.addEventListener('pointermove', this.move);
    window.addEventListener('pointerup', this.up);
    canvas.style.touchAction = 'none';
  }

  /** Match the backing store to the CSS box at device pixel ratio. */
  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = Math.max(1, Math.round((rect.width || 480) * dpr));
    const h = Math.max(1, Math.round((rect.height || 200) * dpr));
    if (this.canvas.width === w && this.canvas.height === h) return;
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.strokeStyle = INK;
  }

  private pos(e: PointerEvent): { x: number; y: number; p: number } {
    const rect = this.canvas.getBoundingClientRect();
    const sx = this.canvas.width / rect.width;
    const sy = this.canvas.height / rect.height;
    const pressure = e.pressure && e.pressure > 0 && e.pressure !== 0.5 ? e.pressure : 0.5;
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy, p: pressure };
  }

  private down = (e: PointerEvent) => {
    e.preventDefault();
    this.canvas.setPointerCapture(e.pointerId);
    this.drawing = true;
    this.last = this.pos(e);
    if (!this.dirty && this.onFirstStroke) this.onFirstStroke();
    this.dirty = true;
    // a dot for a tap
    const { x, y, p } = this.last;
    this.ctx.beginPath();
    this.ctx.arc(x, y, this.width(p) / 2, 0, Math.PI * 2);
    this.ctx.fillStyle = INK;
    this.ctx.fill();
  };

  private move = (e: PointerEvent) => {
    if (!this.drawing || !this.last) return;
    e.preventDefault();
    const cur = this.pos(e);
    this.ctx.beginPath();
    this.ctx.moveTo(this.last.x, this.last.y);
    this.ctx.lineWidth = this.width((cur.p + this.last.p) / 2);
    this.ctx.lineTo(cur.x, cur.y);
    this.ctx.stroke();
    this.last = cur;
  };

  private up = () => {
    this.drawing = false;
    this.last = null;
  };

  private width(pressure: number): number {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    return (1.6 + pressure * 3.2) * dpr;
  }

  isEmpty(): boolean {
    return !this.dirty;
  }

  clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.dirty = false;
  }

  async toImage(): Promise<SignatureImage | null> {
    if (!this.dirty) return null;
    return canvasToTrimmedPng(this.canvas);
  }

  destroy(): void {
    this.canvas.removeEventListener('pointerdown', this.down);
    this.canvas.removeEventListener('pointermove', this.move);
    window.removeEventListener('pointerup', this.up);
  }
}

/** Render typed text in a handwriting style to a transparent PNG. */
export async function typedSignature(
  text: string,
  fontFamily = "'Segoe Script', 'Snell Roundhand', 'Brush Script MT', cursive",
): Promise<SignatureImage | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const fontPx = 96 * dpr;
  const pad = 24 * dpr;

  const measure = document.createElement('canvas').getContext('2d');
  if (!measure) return null;
  measure.font = `${fontPx}px ${fontFamily}`;
  const w = Math.ceil(measure.measureText(trimmed).width) + pad * 2;
  const h = Math.ceil(fontPx * 1.6) + pad;

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, w);
  canvas.height = Math.max(1, h);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.font = `${fontPx}px ${fontFamily}`;
  ctx.fillStyle = INK;
  ctx.textBaseline = 'middle';
  ctx.fillText(trimmed, pad, h / 2);
  return canvasToTrimmedPng(canvas);
}

/** Decode an uploaded image and optionally knock out its white background. */
export async function imageSignature(file: File, removeWhite: boolean): Promise<SignatureImage | null> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();

  if (removeWhite) {
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    whiteToTransparent({ data: imgData.data, width: canvas.width, height: canvas.height });
    ctx.putImageData(imgData, 0, 0);
  }
  return canvasToTrimmedPng(canvas);
}

/** A crisp checkmark as a transparent PNG. */
export async function checkmarkImage(): Promise<SignatureImage | null> {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const size = 64 * dpr;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 7 * dpr;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(size * 0.18, size * 0.55);
  ctx.lineTo(size * 0.42, size * 0.78);
  ctx.lineTo(size * 0.84, size * 0.22);
  ctx.stroke();
  return canvasToTrimmedPng(canvas);
}
