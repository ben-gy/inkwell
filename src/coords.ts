/**
 * Coordinate mapping — the mathematical heart of inkwell.
 *
 * The user places annotations on the *displayed* page (what pdf.js draws, which
 * already accounts for the page's /Rotate flag), using a top-left origin with y
 * pointing down. PDF drawing, on the other hand, happens in the page's
 * *unrotated* coordinate system with a bottom-left origin and y pointing up, and
 * a separate rotation applied at draw time.
 *
 * This module converts a normalised displayed rectangle into concrete pdf-lib
 * draw parameters: an (x, y) pivot in unrotated PDF points, a width/height in
 * points, and a CCW rotation in degrees. It is pure and fully unit-tested — no
 * DOM, no pdf-lib import — so the tricky geometry can be verified in isolation.
 *
 * Derivation (see coords.test.ts for the worked numeric example):
 *   - pdf-lib draws an image occupying local [0,width]×[0,height], rotates it
 *     CCW about its local origin (0,0), then translates so (0,0) lands at (x,y).
 *   - The image content is upright in the displayed view, so its local origin
 *     (0,0) is always the *displayed bottom-left corner* of the annotation.
 *   - Therefore: rotate = R (the page /Rotate value, which is CCW in pdf-lib's
 *     positive convention), and the pivot is the displayed bottom-left corner
 *     mapped into unrotated PDF point space.
 */

import type { Rotation } from './types';

export interface NormRect {
  xNorm: number;
  yNorm: number;
  wNorm: number;
  hNorm: number;
}

export interface DrawParams {
  x: number;
  y: number;
  width: number;
  height: number;
  rotate: Rotation;
}

/** Visible (displayed) page dimensions in points given the unrotated size. */
export function displayedDims(
  widthPt: number,
  heightPt: number,
  rotation: Rotation,
): { wd: number; hd: number } {
  return rotation === 90 || rotation === 270
    ? { wd: heightPt, hd: widthPt }
    : { wd: widthPt, hd: heightPt };
}

/**
 * Map a point given in the displayed frame (origin top-left, y down, in points)
 * to a point in unrotated PDF space (origin bottom-left, y up, in points).
 */
export function displayedPointToPage(
  a: number,
  b: number,
  widthPt: number,
  heightPt: number,
  rotation: Rotation,
): { x: number; y: number } {
  switch (rotation) {
    case 0:
      return { x: a, y: heightPt - b };
    case 90:
      return { x: b, y: a };
    case 180:
      return { x: widthPt - a, y: b };
    case 270:
      return { x: widthPt - b, y: heightPt - a };
  }
}

/**
 * Convert a normalised displayed rectangle into pdf-lib draw parameters.
 *
 * @param rect normalised rect on the displayed page (0..1, top-left origin)
 * @param widthPt unrotated PDF page width in points
 * @param heightPt unrotated PDF page height in points
 * @param rotation the page /Rotate value
 */
export function normRectToDraw(
  rect: NormRect,
  widthPt: number,
  heightPt: number,
  rotation: Rotation,
): DrawParams {
  const { wd, hd } = displayedDims(widthPt, heightPt, rotation);
  const dx = rect.xNorm * wd;
  const dy = rect.yNorm * hd;
  const dw = rect.wNorm * wd;
  const dh = rect.hNorm * hd;

  // Displayed bottom-left corner (top-left frame, y down).
  const blX = dx;
  const blY = dy + dh;
  const pivot = displayedPointToPage(blX, blY, widthPt, heightPt, rotation);

  return { x: pivot.x, y: pivot.y, width: dw, height: dh, rotate: rotation };
}

/**
 * A unit vector, in unrotated PDF space, pointing along the displayed "up"
 * direction for a given page rotation. Used to nudge a text baseline up from the
 * bottom of its box so descenders sit correctly, at any rotation.
 */
export function displayedUpVector(rotation: Rotation): { dx: number; dy: number } {
  switch (rotation) {
    case 0:
      return { dx: 0, dy: 1 };
    case 90:
      return { dx: 1, dy: 0 };
    case 180:
      return { dx: 0, dy: -1 };
    case 270:
      return { dx: -1, dy: 0 };
  }
}

/** Clamp a value into [min, max]. */
export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/**
 * Keep a normalised rectangle fully inside the [0,1] page, preserving its size
 * where possible (used while dragging).
 */
export function clampRect(rect: NormRect): NormRect {
  const wNorm = clamp(rect.wNorm, 0.01, 1);
  const hNorm = clamp(rect.hNorm, 0.01, 1);
  return {
    wNorm,
    hNorm,
    xNorm: clamp(rect.xNorm, 0, 1 - wNorm),
    yNorm: clamp(rect.yNorm, 0, 1 - hNorm),
  };
}
