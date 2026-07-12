/**
 * Central app state — a tiny observable store. Kept deliberately small; the
 * workspace subscribes and repaints the affected pieces on change.
 */

import type { Annotation, AnnotationKind, LoadedDoc } from './types';
import type { SignatureImage } from './signature';

export interface AppState {
  doc: LoadedDoc | null;
  annotations: Annotation[];
  selectedId: string | null;
  /** Tool armed for the next click-to-place, or null. */
  armedTool: AnnotationKind | null;
  /** The user's current saved-in-memory signature / initials. */
  signature: SignatureImage | null;
  initials: SignatureImage | null;
  inkColor: string;
  exporting: boolean;
}

type Listener = (s: AppState) => void;

const state: AppState = {
  doc: null,
  annotations: [],
  selectedId: null,
  armedTool: null,
  signature: null,
  initials: null,
  inkColor: '#1a1a44',
  exporting: false,
};

const listeners = new Set<Listener>();

export function getState(): Readonly<AppState> {
  return state;
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify(): void {
  for (const fn of listeners) fn(state);
}

export function update(patch: Partial<AppState>): void {
  Object.assign(state, patch);
  notify();
}

export function addAnnotation(a: Annotation): void {
  state.annotations = [...state.annotations, a];
  state.selectedId = a.id;
  notify();
}

export function updateAnnotation(id: string, patch: Partial<Annotation>): void {
  state.annotations = state.annotations.map((a) => (a.id === id ? { ...a, ...patch } : a));
  notify();
}

/** Mutate an annotation's geometry without a full notify — used during drag for
 * smoothness. The caller is responsible for the visual update. */
export function patchAnnotationSilently(id: string, patch: Partial<Annotation>): void {
  state.annotations = state.annotations.map((a) => (a.id === id ? { ...a, ...patch } : a));
}

export function removeAnnotation(id: string): void {
  state.annotations = state.annotations.filter((a) => a.id !== id);
  if (state.selectedId === id) state.selectedId = null;
  notify();
}

export function select(id: string | null): void {
  if (state.selectedId === id) return;
  state.selectedId = id;
  notify();
}

export function annotationsForPage(index: number): Annotation[] {
  return state.annotations.filter((a) => a.pageIndex === index);
}

export function reset(): void {
  state.doc = null;
  state.annotations = [];
  state.selectedId = null;
  state.armedTool = null;
  state.exporting = false;
  notify();
}
