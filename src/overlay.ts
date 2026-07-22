// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
/**
 * The interactive annotation layer that sits directly over a rendered page.
 * Renders each annotation as an absolutely-positioned node and handles drag,
 * resize, selection, deletion and inline text editing via Pointer Events. All
 * positions are stored normalised (see types.ts) so they survive zoom/re-render.
 */

import type { Annotation } from './types';
import {
  annotationsForPage,
  getState,
  patchAnnotationSilently,
  removeAnnotation,
  select,
  updateAnnotation,
} from './state';
import { clampRect } from './coords';
import { icon, bytesToBlob } from './ui';

export class AnnotationLayer {
  private urls = new Map<string, string>();

  constructor(
    private el: HTMLElement,
    private pageIndex: number,
    private getSize: () => { w: number; h: number },
  ) {}

  private urlFor(a: Annotation): string {
    if (!a.imageBytes) return '';
    let url = this.urls.get(a.id);
    if (!url) {
      url = URL.createObjectURL(bytesToBlob(a.imageBytes, 'image/png'));
      this.urls.set(a.id, url);
    }
    return url;
  }

  render(): void {
    const { selectedId } = getState();
    const anns = annotationsForPage(this.pageIndex);
    const seen = new Set(anns.map((a) => a.id));

    // Drop nodes for removed annotations and revoke their URLs.
    for (const child of Array.from(this.el.children)) {
      const id = (child as HTMLElement).dataset.id;
      if (id && !seen.has(id)) {
        child.remove();
        const url = this.urls.get(id);
        if (url) {
          URL.revokeObjectURL(url);
          this.urls.delete(id);
        }
      }
    }

    for (const a of anns) {
      let node = this.el.querySelector<HTMLElement>(`[data-id="${a.id}"]`);
      if (!node) {
        node = this.buildNode(a);
        this.el.appendChild(node);
      }
      this.positionNode(node, a);
      node.classList.toggle('selected', a.id === selectedId);
    }
  }

  private positionNode(node: HTMLElement, a: Annotation): void {
    const { w, h } = this.getSize();
    node.style.left = `${a.xNorm * w}px`;
    node.style.top = `${a.yNorm * h}px`;
    node.style.width = `${a.wNorm * w}px`;
    node.style.height = `${a.hNorm * h}px`;
    if (a.kind === 'text' || a.kind === 'date') {
      const fontPx = Math.max(9, a.hNorm * h * 0.7);
      const inner = node.querySelector<HTMLElement>('.ann-field');
      if (inner) {
        inner.style.fontSize = `${fontPx}px`;
        inner.style.color = a.color ?? '#1a1a44';
      }
    }
  }

  private buildNode(a: Annotation): HTMLElement {
    const node = document.createElement('div');
    node.className = `ann ann-${a.kind}`;
    node.dataset.id = a.id;

    if (a.kind === 'text' || a.kind === 'date') {
      const inner = document.createElement('div');
      inner.className = 'ann-field';
      inner.contentEditable = 'true';
      inner.spellcheck = false;
      inner.textContent = a.text ?? '';
      inner.addEventListener('input', () => updateTextSilently(a.id, inner.textContent ?? ''));
      inner.addEventListener('focus', () => select(a.id));
      inner.addEventListener('pointerdown', (e) => e.stopPropagation());
      node.appendChild(inner);
    } else {
      const img = document.createElement('img');
      img.className = 'ann-img';
      img.alt = a.kind;
      img.draggable = false;
      img.src = this.urlFor(a);
      node.appendChild(img);
    }

    // Delete button
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'ann-del';
    del.title = 'Remove';
    del.appendChild(icon('trash'));
    del.addEventListener('pointerdown', (e) => e.stopPropagation());
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      removeAnnotation(a.id);
    });
    node.appendChild(del);

    // Resize handle
    const handle = document.createElement('div');
    handle.className = 'ann-handle';
    node.appendChild(handle);

    this.wireDrag(node, a.id);
    this.wireResize(handle, a.id);
    return node;
  }

  private wireDrag(node: HTMLElement, id: string): void {
    node.addEventListener('pointerdown', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('.ann-handle') || target.closest('.ann-del')) return;
      if (target.classList.contains('ann-field') && node.classList.contains('selected')) {
        // allow caret placement / editing when already selected
        return;
      }
      e.preventDefault();
      select(id);
      const { w, h } = this.getSize();
      const rect = node.getBoundingClientRect();
      const startX = e.clientX;
      const startY = e.clientY;
      const a = getState().annotations.find((x) => x.id === id);
      if (!a) return;
      const originX = a.xNorm;
      const originY = a.yNorm;
      node.setPointerCapture(e.pointerId);
      node.classList.add('dragging');

      const move = (ev: PointerEvent) => {
        const dxNorm = (ev.clientX - startX) / w;
        const dyNorm = (ev.clientY - startY) / h;
        const clamped = clampRect({ xNorm: originX + dxNorm, yNorm: originY + dyNorm, wNorm: a.wNorm, hNorm: a.hNorm });
        node.style.left = `${clamped.xNorm * w}px`;
        node.style.top = `${clamped.yNorm * h}px`;
        patchAnnotationSilently(id, { xNorm: clamped.xNorm, yNorm: clamped.yNorm });
      };
      const up = () => {
        node.classList.remove('dragging');
        node.removeEventListener('pointermove', move);
        node.removeEventListener('pointerup', up);
        const cur = getState().annotations.find((x) => x.id === id);
        if (cur) updateAnnotation(id, { xNorm: cur.xNorm, yNorm: cur.yNorm });
      };
      node.addEventListener('pointermove', move);
      node.addEventListener('pointerup', up);
      void rect;
    });
  }

  private wireResize(handle: HTMLElement, id: string): void {
    handle.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      select(id);
      const { w, h } = this.getSize();
      const a = getState().annotations.find((x) => x.id === id);
      if (!a) return;
      const startX = e.clientX;
      const startW = a.wNorm;
      const aspectPx = (a.hNorm * h) / (a.wNorm * w); // displayed px aspect
      const keepAspect = a.kind !== 'text' && a.kind !== 'date';
      handle.setPointerCapture(e.pointerId);
      const node = handle.parentElement as HTMLElement;

      const move = (ev: PointerEvent) => {
        const dwNorm = (ev.clientX - startX) / w;
        let wNorm = Math.max(0.03, startW + dwNorm);
        let hNorm = keepAspect ? (wNorm * w * aspectPx) / h : a.hNorm;
        const clamped = clampRect({ xNorm: a.xNorm, yNorm: a.yNorm, wNorm, hNorm });
        wNorm = clamped.wNorm;
        hNorm = clamped.hNorm;
        node.style.width = `${wNorm * w}px`;
        node.style.height = `${hNorm * h}px`;
        if (a.kind === 'text' || a.kind === 'date') {
          const inner = node.querySelector<HTMLElement>('.ann-field');
          if (inner) inner.style.fontSize = `${Math.max(9, hNorm * h * 0.7)}px`;
        }
        patchAnnotationSilently(id, { wNorm, hNorm });
      };
      const up = () => {
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', up);
        const cur = getState().annotations.find((x) => x.id === id);
        if (cur) updateAnnotation(id, { wNorm: cur.wNorm, hNorm: cur.hNorm });
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', up);
    });
  }

  destroy(): void {
    for (const url of this.urls.values()) URL.revokeObjectURL(url);
    this.urls.clear();
    this.el.innerHTML = '';
  }
}

/**
 * Update annotation text without notifying subscribers. The DOM already shows
 * the text (the user is typing into the node), and export reads straight from
 * the store, so a re-render would only risk disturbing the caret.
 */
function updateTextSilently(id: string, text: string): void {
  patchAnnotationSilently(id, { text });
}
