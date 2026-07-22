// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
/** Small pure formatting helpers. */

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let val = bytes / 1024;
  let i = 0;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(val >= 100 ? 0 : 1)} ${units[i]}`;
}

/**
 * Derive the output filename from the input: `contract.pdf` -> `contract-signed.pdf`.
 * Handles missing/odd extensions and strips path separators for safety.
 */
export function signedFilename(input: string): string {
  const base = (input || 'document.pdf').split(/[\\/]/).pop() || 'document.pdf';
  const dot = base.toLowerCase().lastIndexOf('.pdf');
  const stem = dot === base.length - 4 && dot > 0 ? base.slice(0, dot) : base.replace(/\.pdf$/i, '');
  const clean = (stem || 'document').replace(/-signed$/i, '');
  return `${clean}-signed.pdf`;
}

/** Human date in the user's locale, e.g. for the "date" stamp default. */
export function formatDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Short id for annotations without needing crypto in tests. */
let idCounter = 0;
export function nextId(prefix = 'a'): string {
  idCounter += 1;
  return `${prefix}${idCounter.toString(36)}`;
}
