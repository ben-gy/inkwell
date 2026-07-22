// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
/** Shared types for inkwell. */

export type Rotation = 0 | 90 | 180 | 270;

/** The kind of thing a user can stamp onto a page. */
export type AnnotationKind = 'signature' | 'initials' | 'text' | 'date' | 'check';

/**
 * A placed annotation. Position and size are stored *normalised* to the
 * displayed (rotation-aware) page: 0..1 fractions of the visible page width and
 * height, with the origin at the top-left — exactly how the user sees it. This
 * keeps annotations correct at any zoom and is converted to PDF points only at
 * export time (see coords.ts).
 */
export interface Annotation {
  id: string;
  kind: AnnotationKind;
  pageIndex: number;
  /** Left edge, fraction of displayed page width (0..1). */
  xNorm: number;
  /** Top edge, fraction of displayed page height (0..1). */
  yNorm: number;
  /** Width, fraction of displayed page width (0..1). */
  wNorm: number;
  /** Height, fraction of displayed page height (0..1). */
  hNorm: number;
  /** For image annotations (signature/initials/check): the PNG bytes. */
  imageBytes?: Uint8Array;
  /** Natural pixel size of the source image, used to keep aspect ratio. */
  imageW?: number;
  imageH?: number;
  /** For text/date annotations. */
  text?: string;
  /** Ink colour for text, hex string. */
  color?: string;
}

/** Metadata for a rendered page. */
export interface PageInfo {
  index: number;
  /** Unrotated PDF media-box size, in points, from pdf-lib. */
  widthPt: number;
  heightPt: number;
  rotation: Rotation;
}

export interface LoadedDoc {
  name: string;
  bytes: Uint8Array;
  pageCount: number;
}
