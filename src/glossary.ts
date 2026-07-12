/**
 * Glossary — click-to-define tooltips for jargon. Any element with
 * `.glossary-link` and a `data-term` matching a key here becomes clickable.
 */

export const GLOSSARY: Record<string, { title: string; body: string }> = {
  pdfjs: {
    title: 'pdf.js',
    body: "Mozilla's library that reads and draws PDF files entirely in the browser. inkwell uses it to render every page onto a canvas so you can see and place things on it — no server involved.",
  },
  pdflib: {
    title: 'pdf-lib',
    body: 'A JavaScript library that edits and saves PDFs in the browser. inkwell uses it to write your signature and text back into the original document and produce the final file.',
  },
  flatten: {
    title: 'flatten',
    body: 'Baking your placed signature and text directly into the page pixels/content so they become a permanent part of the PDF rather than editable overlays.',
  },
  pki: {
    title: 'digital (PKI) signature',
    body: 'A cryptographic signature that mathematically proves who signed a document and that it has not been altered. inkwell makes a *visible* signature, which is different — it looks like ink on paper but carries no cryptographic proof.',
  },
  transparent: {
    title: 'transparent PNG',
    body: 'An image whose background is see-through, so your signature sits on top of the page instead of hiding it inside a white box.',
  },
};

let tipEl: HTMLElement | null = null;

function ensureTip(): HTMLElement {
  if (tipEl) return tipEl;
  tipEl = document.createElement('div');
  tipEl.className = 'glossary-tip';
  tipEl.setAttribute('role', 'tooltip');
  tipEl.hidden = true;
  document.body.appendChild(tipEl);
  return tipEl;
}

function hide(): void {
  if (tipEl) tipEl.hidden = true;
}

/** Wire up global glossary behaviour (idempotent). Call once at startup. */
export function initGlossary(): void {
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const link = target.closest<HTMLElement>('.glossary-link');
    if (!link) {
      hide();
      return;
    }
    const term = link.dataset.term;
    if (!term || !GLOSSARY[term]) return;
    e.preventDefault();
    e.stopPropagation();
    const entry = GLOSSARY[term];
    const tip = ensureTip();
    tip.innerHTML = '';
    const h = document.createElement('strong');
    h.textContent = entry.title;
    const p = document.createElement('span');
    p.textContent = entry.body;
    tip.appendChild(h);
    tip.appendChild(p);
    tip.hidden = false;

    const rect = link.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();
    let top = rect.bottom + 8;
    if (top + tipRect.height > window.innerHeight - 8) top = rect.top - tipRect.height - 8;
    let left = rect.left;
    if (left + tipRect.width > window.innerWidth - 8) left = window.innerWidth - tipRect.width - 8;
    tip.style.top = `${Math.max(8, top)}px`;
    tip.style.left = `${Math.max(8, left)}px`;
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hide();
  });
  window.addEventListener('scroll', hide, true);
}
