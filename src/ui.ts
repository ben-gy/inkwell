// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
/**
 * UI helpers — DOM construction, icons, toast and modal machinery.
 * Adapted from the Dropwell pattern.
 */

/**
 * Wrap raw bytes in a Blob. Copies into a fresh, ArrayBuffer-backed Uint8Array
 * so the type satisfies the DOM BlobPart signature regardless of the source
 * array's backing buffer.
 */
export function bytesToBlob(bytes: Uint8Array, type: string): Blob {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy], { type });
}

export function h(
  tag: string,
  attrs: Record<string, string | null> = {},
  ...kids: (Node | string)[]
): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v);
  }
  for (const kid of kids) {
    el.appendChild(typeof kid === 'string' ? document.createTextNode(kid) : kid);
  }
  return el;
}

const ICONS = {
  upload: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,
  signature: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17c3 0 3-9 6-9s2 6 4 6 2-4 4-4 1 3 4 3"/><path d="M3 21h18"/></svg>`,
  initials: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7V5h16v2"/><path d="M9 19h6"/><path d="M12 5v14"/></svg>`,
  text: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7V5h16v2"/><path d="M9 19h6"/><path d="M12 5v14"/></svg>`,
  date: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  download: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  share: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="11.49"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>`,
  file: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
  reset: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>`,
};

export function icon(name: keyof typeof ICONS, cls = ''): HTMLElement {
  const wrapper = document.createElement('span');
  wrapper.innerHTML = ICONS[name];
  const svg = wrapper.firstElementChild as SVGElement;
  if (cls) svg.setAttribute('class', cls);
  return svg as unknown as HTMLElement;
}

// ---------- toast ----------

let toastEl: HTMLElement | null = null;
let toastTimer: number | null = null;

export function toast(msg: string, kind: 'info' | 'ok' | 'err' = 'info'): void {
  if (!toastEl) {
    toastEl = h('div', { class: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = msg;
  toastEl.className = `toast visible ${kind}`;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl?.classList.remove('visible'), 2600);
}

// ---------- modal ----------

export function openModal(content: DocumentFragment | HTMLElement): HTMLElement {
  const closeBtn = h('button', { class: 'modal-close', type: 'button', 'aria-label': 'close' }, '×');
  const panel = h('div', { class: 'modal-panel', role: 'document' }, closeBtn);
  panel.appendChild(content as unknown as Node);
  const overlay = h('div', { class: 'modal-overlay', role: 'dialog', 'aria-modal': 'true' }, panel);

  const previouslyFocused = document.activeElement as HTMLElement | null;
  document.body.appendChild(overlay);
  document.body.classList.add('modal-open');

  const close = () => {
    overlay.remove();
    document.body.classList.remove('modal-open');
    document.removeEventListener('keydown', onKey);
    previouslyFocused?.focus?.();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  };
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  closeBtn.addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  requestAnimationFrame(() => closeBtn.focus());

  (overlay as HTMLElement & { close: () => void }).close = close;
  return overlay;
}

export function closeModal(overlay: HTMLElement): void {
  (overlay as HTMLElement & { close?: () => void }).close?.();
}

/** Wire every [data-modal="tmpl-id"] trigger to open the named <template>. */
export function initModalTriggers(): void {
  document.querySelectorAll<HTMLElement>('[data-modal]').forEach((trigger) => {
    const open = (e: Event) => {
      e.preventDefault();
      const id = trigger.dataset.modal;
      if (!id) return;
      const tmpl = document.getElementById(id) as HTMLTemplateElement | null;
      if (!tmpl) return;
      openModal(tmpl.content.cloneNode(true) as DocumentFragment);
    };
    trigger.addEventListener('click', open);
    trigger.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') open(e);
    });
  });
}

export function setStatus(label: string, tone: 'idle' | 'busy' | 'good' | 'bad' = 'idle'): void {
  const dot = document.getElementById('sb-status-dot');
  const text = document.getElementById('sb-status-label');
  if (dot) dot.className = `dot-mini ${tone}`;
  if (text) text.textContent = label;
}

export function setDocInfo(text: string): void {
  const el = document.getElementById('sb-doc');
  if (el) el.textContent = text;
}
