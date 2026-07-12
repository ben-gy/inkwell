/**
 * The workspace — owns the app's main region. Two states: an empty drop zone,
 * and the loaded editor (tool rail + scrollable page column + export bar).
 */

import { PdfPreview, type RenderedPage } from './pdf-render';
import { AnnotationLayer } from './overlay';
import {
  addAnnotation,
  getState,
  reset,
  removeAnnotation,
  select,
  subscribe,
  update,
} from './state';
import {
  SignaturePad,
  typedSignature,
  imageSignature,
  checkmarkImage,
  type SignatureImage,
} from './signature';
import { exportSignedPdf } from './pdf-export';
import { emit } from './eventlog';
import { looksLikePdf, isSupportedSignatureImage } from './validate';
import { signedFilename, formatBytes, formatDate, nextId } from './format';
import { clamp } from './coords';
import type { Annotation, AnnotationKind } from './types';
import { h, icon, toast, openModal, closeModal, setStatus, setDocInfo, bytesToBlob } from './ui';

interface PageView {
  page: RenderedPage;
  overlay: HTMLElement;
  layer: AnnotationLayer;
  wrapper: HTMLElement;
}

const MAX_PAGE_WIDTH = 860;

export class Workspace {
  private preview = new PdfPreview();
  private views: PageView[] = [];
  private colEl: HTMLElement | null = null;
  private resizeTimer: number | null = null;

  constructor(private app: HTMLElement) {
    subscribe(() => this.onState());
    window.addEventListener('resize', () => this.onResize());
  }

  // ---------------------------------------------------------------- dropzone

  showDropzone(): void {
    this.teardownViews();
    this.app.innerHTML = '';
    const zone = h('div', { class: 'dropzone', tabindex: '0', role: 'button', 'aria-label': 'Choose a PDF to sign' });
    zone.appendChild(icon('upload', 'dropzone-icon'));
    zone.appendChild(h('div', { class: 'dropzone-title' }, 'Drop a PDF here to sign'));
    zone.appendChild(h('div', { class: 'dropzone-sub' }, 'or click to choose a file · it never leaves your device'));
    const hint = h('div', { class: 'dropzone-hint' });
    hint.appendChild(icon('file'));
    hint.appendChild(document.createTextNode('PDF documents · signed entirely in your browser'));
    zone.appendChild(hint);

    const input = h('input', { type: 'file', accept: 'application/pdf,.pdf', class: 'visually-hidden' }) as HTMLInputElement;
    zone.appendChild(input);

    const pick = () => input.click();
    zone.addEventListener('click', (e) => {
      if (e.target !== input) pick();
    });
    zone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        pick();
      }
    });
    input.addEventListener('change', () => {
      const f = input.files?.[0];
      if (f) void this.loadFile(f);
    });

    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('dragging');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragging'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('dragging');
      const f = e.dataTransfer?.files?.[0];
      if (f) void this.loadFile(f);
    });

    this.app.appendChild(zone);

    const reassure = h('div', { class: 'dropzone-trust' },
      '🔒 No uploads · no account · no watermark · works offline');
    this.app.appendChild(reassure);
    setStatus('ready', 'idle');
    setDocInfo('');
  }

  // ------------------------------------------------------------------- load

  async loadFile(file: File): Promise<void> {
    if (file.type && file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
      toast('That doesn’t look like a PDF.', 'err');
      emit('doc', 'err', 'Rejected non-PDF input', { name: file.name, type: file.type || 'unknown' });
      return;
    }
    setStatus('reading…', 'busy');
    emit('doc', 'info', 'Reading document', { name: file.name, size: formatBytes(file.size) });
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!looksLikePdf(bytes)) {
        toast('This file isn’t a valid PDF.', 'err');
        emit('doc', 'err', 'File is not a valid PDF', { name: file.name });
        setStatus('ready', 'idle');
        return;
      }
      await this.preview.load(bytes);
      reset();
      update({ doc: { name: file.name, bytes, pageCount: this.preview.pageCount } });
      emit('doc', 'ok', 'Document loaded', { pages: this.preview.pageCount });
      await this.renderEditor();
    } catch (err) {
      toast('Couldn’t open that PDF. It may be corrupted or password-protected.', 'err');
      emit('doc', 'err', 'Failed to open PDF', { error: (err as Error).message });
      setStatus('ready', 'idle');
      this.showDropzone();
    }
  }

  // ----------------------------------------------------------------- editor

  private async renderEditor(): Promise<void> {
    this.teardownViews();
    this.app.innerHTML = '';
    const doc = getState().doc;
    if (!doc) return;

    const layout = h('div', { class: 'editor' });

    // Tool rail
    const rail = this.buildRail();
    layout.appendChild(rail);

    // Page column
    const col = h('div', { class: 'page-col' });
    this.colEl = col;
    layout.appendChild(col);

    this.app.appendChild(layout);

    setStatus('rendering…', 'busy');
    setDocInfo(`${doc.name} · ${doc.pageCount} page${doc.pageCount === 1 ? '' : 's'}`);
    await this.renderPages();
    setStatus('ready to sign', 'good');
    this.updateExportButton();
  }

  private targetWidth(): number {
    const avail = (this.colEl?.clientWidth ?? this.app.clientWidth ?? 900) - 8;
    return clamp(avail, 280, MAX_PAGE_WIDTH);
  }

  private async renderPages(): Promise<void> {
    if (!this.colEl) return;
    const doc = getState().doc;
    if (!doc) return;
    const width = this.targetWidth();
    const total = doc.pageCount;

    for (let i = 0; i < total; i++) {
      emit('doc', 'info', 'Rendering page', { page: `${i + 1}/${total}` });
      setStatus(`rendering ${i + 1}/${total}…`, 'busy');
      const page = await this.preview.renderPage(i, width);

      const wrapper = h('div', { class: 'page-wrap' });
      const badge = h('div', { class: 'page-badge' }, `${i + 1}`);
      const canvasHost = h('div', { class: 'page-canvas' });
      canvasHost.style.width = `${page.cssWidth}px`;
      canvasHost.style.height = `${page.cssHeight}px`;
      canvasHost.appendChild(page.canvas);

      const overlay = h('div', { class: 'page-overlay' });
      overlay.style.width = `${page.cssWidth}px`;
      overlay.style.height = `${page.cssHeight}px`;
      canvasHost.appendChild(overlay);

      wrapper.appendChild(badge);
      wrapper.appendChild(canvasHost);
      this.colEl.appendChild(wrapper);

      const layer = new AnnotationLayer(overlay, i, () => ({
        w: overlay.clientWidth,
        h: overlay.clientHeight,
      }));
      layer.render();

      this.wireOverlayPlacement(overlay, i);
      this.views.push({ page, overlay, layer, wrapper });
    }
  }

  private wireOverlayPlacement(overlay: HTMLElement, pageIndex: number): void {
    overlay.addEventListener('pointerdown', (e) => {
      if (e.target !== overlay) return; // clicked an annotation, not empty space
      const { armedTool } = getState();
      if (!armedTool) {
        select(null);
        return;
      }
      const rect = overlay.getBoundingClientRect();
      const xNorm = (e.clientX - rect.left) / rect.width;
      const yNorm = (e.clientY - rect.top) / rect.height;
      void this.placeTool(armedTool, pageIndex, xNorm, yNorm, overlay);
    });
  }

  // ------------------------------------------------------------- placement

  private async placeTool(
    kind: AnnotationKind,
    pageIndex: number,
    xNorm: number,
    yNorm: number,
    overlay: HTMLElement,
  ): Promise<void> {
    const st = getState();
    const cssW = overlay.clientWidth;
    const cssH = overlay.clientHeight;

    let ann: Annotation | null = null;

    if (kind === 'signature' || kind === 'initials') {
      const img = kind === 'signature' ? st.signature : st.initials;
      if (!img) {
        this.openSignatureModal(kind, (created) => {
          void this.placeImageAnnotation(kind, created, pageIndex, xNorm, yNorm, cssW, cssH);
        });
        return;
      }
      await this.placeImageAnnotation(kind, img, pageIndex, xNorm, yNorm, cssW, cssH);
      return;
    }

    if (kind === 'check') {
      const img = await checkmarkImage();
      if (!img) {
        toast('Couldn’t create the checkmark.', 'err');
        return;
      }
      await this.placeImageAnnotation(kind, img, pageIndex, xNorm, yNorm, cssW, cssH, 0.05);
      return;
    }

    // text / date
    const wNorm = kind === 'date' ? 0.2 : 0.34;
    const hNorm = 0.05;
    ann = {
      id: nextId(kind),
      kind,
      pageIndex,
      xNorm: clamp(xNorm - wNorm / 2, 0, 1 - wNorm),
      yNorm: clamp(yNorm - hNorm / 2, 0, 1 - hNorm),
      wNorm,
      hNorm,
      text: kind === 'date' ? formatDate(new Date()) : 'Type here',
      color: st.inkColor,
    };
    addAnnotation(ann);
    emit('place', 'ok', `Placed ${kind}`, { page: pageIndex + 1 });
    this.disarm();
    // focus the text for immediate editing
    requestAnimationFrame(() => {
      const node = overlay.querySelector<HTMLElement>(`[data-id="${ann!.id}"] .ann-field`);
      node?.focus();
      if (node) selectAll(node);
    });
  }

  private async placeImageAnnotation(
    kind: AnnotationKind,
    img: SignatureImage,
    pageIndex: number,
    xNorm: number,
    yNorm: number,
    cssW: number,
    cssH: number,
    forcedWNorm?: number,
  ): Promise<void> {
    const wNorm = forcedWNorm ?? (kind === 'initials' ? 0.12 : 0.26);
    // preserve the image's visual aspect ratio on the displayed page
    const hNorm = clamp((wNorm * cssW * (img.height / img.width)) / cssH, 0.01, 0.9);
    const ann: Annotation = {
      id: nextId(kind),
      kind,
      pageIndex,
      xNorm: clamp(xNorm - wNorm / 2, 0, 1 - wNorm),
      yNorm: clamp(yNorm - hNorm / 2, 0, 1 - hNorm),
      wNorm,
      hNorm,
      imageBytes: img.bytes,
      imageW: img.width,
      imageH: img.height,
    };
    addAnnotation(ann);
    emit('place', 'ok', `Placed ${kind}`, { page: pageIndex + 1 });
    this.disarm();
  }

  // -------------------------------------------------------------- tool rail

  private buildRail(): HTMLElement {
    const rail = h('div', { class: 'tool-rail' });

    const group = h('div', { class: 'rail-group' });
    const tools: Array<{ kind: AnnotationKind; label: string; ic: Parameters<typeof icon>[0] }> = [
      { kind: 'signature', label: 'Signature', ic: 'signature' },
      { kind: 'initials', label: 'Initials', ic: 'initials' },
      { kind: 'text', label: 'Text', ic: 'text' },
      { kind: 'date', label: 'Date', ic: 'date' },
      { kind: 'check', label: 'Checkmark', ic: 'check' },
    ];
    for (const t of tools) {
      const btn = h('button', { type: 'button', class: 'tool-btn', 'data-kind': t.kind });
      btn.appendChild(icon(t.ic, 'tool-ic'));
      btn.appendChild(h('span', { class: 'tool-label' }, t.label));
      btn.addEventListener('click', () => this.armTool(t.kind));
      group.appendChild(btn);
    }
    rail.appendChild(h('div', { class: 'rail-heading' }, 'Add to document'));
    rail.appendChild(group);

    const hintRow = h('div', { class: 'rail-hint' }, 'Pick a tool, then click where you want it on the page.');
    rail.appendChild(hintRow);

    // Signature preview / manage
    const sigBox = h('div', { class: 'rail-sig' });
    sigBox.id = 'rail-sig';
    rail.appendChild(sigBox);
    this.renderSigPreview(sigBox);

    // Actions
    const actions = h('div', { class: 'rail-actions' });
    const exportBtn = h('button', { type: 'button', class: 'btn btn-primary', id: 'btn-export' });
    exportBtn.appendChild(icon('download'));
    exportBtn.appendChild(h('span', {}, 'Download signed PDF'));
    exportBtn.addEventListener('click', () => void this.doExport());
    actions.appendChild(exportBtn);

    if (canShareFiles()) {
      const shareBtn = h('button', { type: 'button', class: 'btn btn-ghost', id: 'btn-share' });
      shareBtn.appendChild(icon('share'));
      shareBtn.appendChild(h('span', {}, 'Share'));
      shareBtn.addEventListener('click', () => void this.doExport(true));
      actions.appendChild(shareBtn);
    }

    const resetBtn = h('button', { type: 'button', class: 'btn btn-ghost btn-reset' });
    resetBtn.appendChild(icon('reset'));
    resetBtn.appendChild(h('span', {}, 'New document'));
    resetBtn.addEventListener('click', () => {
      void this.preview.destroy();
      reset();
      this.showDropzone();
    });
    actions.appendChild(resetBtn);
    rail.appendChild(actions);

    return rail;
  }

  private renderSigPreview(box: HTMLElement): void {
    box.innerHTML = '';
    const st = getState();
    box.appendChild(h('div', { class: 'rail-heading' }, 'Your signature'));
    const row = h('div', { class: 'sig-preview-row' });
    if (st.signature) {
      const img = h('img', { class: 'sig-thumb', alt: 'your signature' }) as HTMLImageElement;
      img.src = URL.createObjectURL(bytesToBlob(st.signature.bytes, 'image/png'));
      row.appendChild(img);
    } else {
      row.appendChild(h('div', { class: 'sig-empty' }, 'none yet'));
    }
    const make = h('button', { type: 'button', class: 'btn btn-ghost btn-sm' }, st.signature ? 'Change' : 'Create signature');
    make.addEventListener('click', () => this.openSignatureModal('signature'));
    row.appendChild(make);
    box.appendChild(row);
  }

  private armTool(kind: AnnotationKind): void {
    const cur = getState().armedTool;
    update({ armedTool: cur === kind ? null : kind });
    this.reflectArmed();
    if (getState().armedTool) {
      emit('ui', 'info', `Tool armed: ${kind}`);
      toast(`Click on the page to place your ${kind}.`);
    }
  }

  private disarm(): void {
    update({ armedTool: null });
    this.reflectArmed();
  }

  private reflectArmed(): void {
    const armed = getState().armedTool;
    this.app.querySelectorAll<HTMLElement>('.tool-btn').forEach((b) => {
      b.classList.toggle('armed', b.dataset.kind === armed);
    });
    for (const v of this.views) v.overlay.classList.toggle('armed', !!armed);
  }

  // -------------------------------------------------------- signature modal

  private openSignatureModal(kind: 'signature' | 'initials', onCreate?: (img: SignatureImage) => void): void {
    const content = h('div', { class: 'modal-content sig-modal' });
    content.appendChild(h('h2', { class: 'modal-title' }, kind === 'initials' ? 'Create your initials' : 'Create your signature'));

    const tabs = h('div', { class: 'sig-tabs' });
    const panels = h('div', { class: 'sig-panels' });
    const tabDefs = ['Draw', 'Type', 'Upload'];
    const tabButtons: HTMLElement[] = [];
    tabDefs.forEach((label, idx) => {
      const tab = h('button', { type: 'button', class: `sig-tab${idx === 0 ? ' active' : ''}` }, label);
      tab.addEventListener('click', () => {
        tabButtons.forEach((b) => b.classList.remove('active'));
        tab.classList.add('active');
        panels.querySelectorAll('.sig-panel').forEach((p, i) => (p as HTMLElement).hidden = i !== idx);
      });
      tabButtons.push(tab);
      tabs.appendChild(tab);
    });
    content.appendChild(tabs);
    content.appendChild(panels);

    // shared result plumbing
    let currentGetter: () => Promise<SignatureImage | null> = async () => null;
    let pad: SignaturePad | null = null;

    // Draw panel
    const drawPanel = h('div', { class: 'sig-panel' });
    const padCanvas = h('canvas', { class: 'sig-pad' }) as HTMLCanvasElement;
    const padBox = h('div', { class: 'sig-pad-box' }, padCanvas, h('div', { class: 'sig-pad-baseline' }));
    drawPanel.appendChild(padBox);
    const drawTools = h('div', { class: 'sig-panel-tools' });
    const clearBtn = h('button', { type: 'button', class: 'btn btn-ghost btn-sm' }, 'Clear');
    drawTools.appendChild(clearBtn);
    drawTools.appendChild(h('span', { class: 'sig-tip' }, 'Draw with a finger, stylus or trackpad'));
    drawPanel.appendChild(drawTools);
    panels.appendChild(drawPanel);

    // Type panel
    const typePanel = h('div', { class: 'sig-panel', hidden: 'true' });
    const typeInput = h('input', { type: 'text', class: 'sig-type-input', placeholder: 'Type your name', maxlength: '48' }) as HTMLInputElement;
    const typePreview = h('div', { class: 'sig-type-preview' });
    const updatePreview = () => (typePreview.textContent = typeInput.value || 'Your name');
    typeInput.addEventListener('input', updatePreview);
    updatePreview();
    typePanel.appendChild(typeInput);
    typePanel.appendChild(typePreview);
    panels.appendChild(typePanel);

    // Upload panel
    const uploadPanel = h('div', { class: 'sig-panel', hidden: 'true' });
    const fileInput = h('input', { type: 'file', accept: 'image/*', class: 'sig-file' }) as HTMLInputElement;
    const removeWhite = h('input', { type: 'checkbox', checked: 'true', id: 'rm-white' }) as HTMLInputElement;
    const rmLabel = h('label', { class: 'sig-check', for: 'rm-white' }, removeWhite, document.createTextNode(' Remove white background'));
    const uploadPreview = h('div', { class: 'sig-upload-preview' }, 'Choose an image of your signature');
    let uploadedFile: File | null = null;
    fileInput.addEventListener('change', () => {
      uploadedFile = fileInput.files?.[0] ?? null;
      uploadPreview.textContent = uploadedFile ? uploadedFile.name : 'Choose an image of your signature';
    });
    uploadPanel.appendChild(fileInput);
    uploadPanel.appendChild(rmLabel);
    uploadPanel.appendChild(uploadPreview);
    panels.appendChild(uploadPanel);

    // footer
    const footer = h('div', { class: 'sig-footer' });
    const cancelBtn = h('button', { type: 'button', class: 'btn btn-ghost' }, 'Cancel');
    const saveBtn = h('button', { type: 'button', class: 'btn btn-primary' }, kind === 'initials' ? 'Use initials' : 'Use signature');
    footer.appendChild(cancelBtn);
    footer.appendChild(saveBtn);
    content.appendChild(footer);

    const overlay = openModal(content);

    // init pad after it is in the DOM (needs layout for sizing)
    requestAnimationFrame(() => {
      pad = new SignaturePad(padCanvas);
    });
    clearBtn.addEventListener('click', () => pad?.clear());

    // getters per active tab
    const activeIndex = () => tabButtons.findIndex((b) => b.classList.contains('active'));
    currentGetter = async () => {
      const idx = activeIndex();
      if (idx === 0) return pad ? pad.toImage() : null;
      if (idx === 1) return typedSignature(typeInput.value);
      if (idx === 2) {
        if (!uploadedFile) return null;
        if (!isSupportedSignatureImage(uploadedFile.type)) {
          toast('Please choose a PNG, JPEG, WebP or GIF image.', 'err');
          return null;
        }
        return imageSignature(uploadedFile, removeWhite.checked);
      }
      return null;
    };

    cancelBtn.addEventListener('click', () => {
      pad?.destroy();
      closeModal(overlay);
    });
    saveBtn.addEventListener('click', async () => {
      saveBtn.setAttribute('disabled', 'true');
      try {
        const img = await currentGetter();
        if (!img) {
          toast('Add a signature first (draw, type or upload).', 'err');
          saveBtn.removeAttribute('disabled');
          return;
        }
        if (kind === 'initials') update({ initials: img });
        else update({ signature: img });
        emit('sign', 'ok', `${kind === 'initials' ? 'Initials' : 'Signature'} created`, {
          px: `${img.width}×${img.height}`,
        });
        pad?.destroy();
        closeModal(overlay);
        const box = document.getElementById('rail-sig');
        if (box) this.renderSigPreview(box);
        onCreate?.(img);
      } catch (err) {
        toast('Couldn’t process that signature.', 'err');
        emit('sign', 'err', 'Signature creation failed', { error: (err as Error).message });
        saveBtn.removeAttribute('disabled');
      }
    });
  }

  // ------------------------------------------------------------------ export

  private updateExportButton(): void {
    const btn = document.getElementById('btn-export') as HTMLButtonElement | null;
    const count = getState().annotations.length;
    if (btn) {
      btn.disabled = getState().exporting;
      const span = btn.querySelector('span');
      if (span) span.textContent = count > 0 ? `Download signed PDF (${count})` : 'Download signed PDF';
    }
  }

  private async doExport(share = false): Promise<void> {
    const st = getState();
    if (!st.doc) return;
    if (st.annotations.length === 0) {
      toast('Add a signature or field first.', 'err');
      return;
    }
    update({ exporting: true });
    setStatus('saving…', 'busy');
    emit('export', 'info', 'Flattening document', { items: st.annotations.length });
    const btn = document.getElementById('btn-export') as HTMLButtonElement | null;
    if (btn) btn.disabled = true;

    try {
      const out = await exportSignedPdf(st.doc.bytes, st.annotations, (p) => {
        setStatus(`saving ${p.done}/${p.total}…`, 'busy');
      });
      const blob = bytesToBlob(out, 'application/pdf');
      const filename = signedFilename(st.doc.name);

      if (share && canShareFiles()) {
        const file = new File([blob], filename, { type: 'application/pdf' });
        try {
          await navigator.share({ files: [file], title: filename });
          emit('export', 'ok', 'Shared signed PDF', { name: filename });
        } catch {
          // user cancelled share — fall through silently
        }
      } else {
        const url = URL.createObjectURL(blob);
        const a = h('a', { href: url, download: filename }) as HTMLAnchorElement;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        emit('export', 'ok', 'Saved signed PDF', { name: filename, size: formatBytes(blob.size) });
        toast('Signed PDF saved.', 'ok');
      }
      setStatus('done', 'good');
    } catch (err) {
      toast('Export failed. Please try again.', 'err');
      emit('export', 'err', 'Export failed', { error: (err as Error).message });
      setStatus('ready', 'idle');
    } finally {
      update({ exporting: false });
      if (btn) btn.disabled = false;
    }
  }

  // ------------------------------------------------------------- reactivity

  private onState(): void {
    for (const v of this.views) v.layer.render();
    this.updateExportButton();
  }

  private onResize(): void {
    if (!getState().doc || this.views.length === 0) return;
    if (this.resizeTimer) window.clearTimeout(this.resizeTimer);
    this.resizeTimer = window.setTimeout(() => void this.reflowPages(), 200);
  }

  private async reflowPages(): Promise<void> {
    if (!this.colEl) return;
    const width = this.targetWidth();
    // Re-render each page canvas at the new width; annotations are normalised.
    const oldViews = this.views;
    this.views = [];
    this.colEl.innerHTML = '';
    for (let i = 0; i < oldViews.length; i++) {
      const page = await this.preview.renderPage(i, width);
      const wrapper = h('div', { class: 'page-wrap' });
      const badge = h('div', { class: 'page-badge' }, `${i + 1}`);
      const canvasHost = h('div', { class: 'page-canvas' });
      canvasHost.style.width = `${page.cssWidth}px`;
      canvasHost.style.height = `${page.cssHeight}px`;
      canvasHost.appendChild(page.canvas);
      const overlay = h('div', { class: 'page-overlay' });
      overlay.style.width = `${page.cssWidth}px`;
      overlay.style.height = `${page.cssHeight}px`;
      canvasHost.appendChild(overlay);
      wrapper.appendChild(badge);
      wrapper.appendChild(canvasHost);
      this.colEl.appendChild(wrapper);
      const layer = new AnnotationLayer(overlay, i, () => ({ w: overlay.clientWidth, h: overlay.clientHeight }));
      layer.render();
      this.wireOverlayPlacement(overlay, i);
      this.views.push({ page, overlay, layer, wrapper });
    }
    this.reflectArmed();
  }

  private teardownViews(): void {
    for (const v of this.views) v.layer.destroy();
    this.views = [];
    this.colEl = null;
  }

  // keyboard: delete selected
  handleKey(e: KeyboardEvent): void {
    if ((e.key === 'Delete' || e.key === 'Backspace')) {
      const target = e.target as HTMLElement;
      if (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      const sel = getState().selectedId;
      if (sel) {
        e.preventDefault();
        removeAnnotation(sel);
        emit('place', 'info', 'Removed annotation');
      }
    } else if (e.key === 'Escape') {
      if (getState().armedTool) this.disarm();
      else select(null);
    }
  }
}

function canShareFiles(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.canShare &&
    (() => {
      try {
        return navigator.canShare({ files: [new File([new Uint8Array([1])], 't.pdf', { type: 'application/pdf' })] });
      } catch {
        return false;
      }
    })()
  );
}

function selectAll(el: HTMLElement): void {
  const range = document.createRange();
  range.selectNodeContents(el);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}
