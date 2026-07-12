# Tool Plan: inkwell

## Overview
- **Name:** inkwell
- **Repo name:** inkwell
- **Tagline:** Sign and fill PDFs in your browser — nothing is uploaded.

## Problem It Solves
Someone is emailed a contract, a school form, an NDA, or a rental agreement as a PDF.
They need to add their signature, initials, a date, and tick a few boxes, then send it
back. They don't have a printer. So they Google "sign PDF online free" and land on a site
that asks them to upload the document to a server they've never heard of — handing a
stranger a signed legal document containing their name, address, and signature image.
inkwell does the whole job in the browser: the PDF is parsed, rendered, annotated, and
re-saved locally. The bytes never leave the tab.

## Why This Must Be Client-Side
- **Privacy:** signed contracts contain names, addresses, salaries, signatures — the most
  sensitive category of everyday document. Uploading them to a random SaaS is exactly the
  risk people don't realise they're taking.
- **No-account friction:** no sign-up, no watermark, no "3 free documents then pay".
- **Offline:** works on a plane, in a lawyer's office with locked-down networking, anywhere.

## Browser APIs / Libraries Used
| API / Library | What it does for us | Fallback if unsupported |
|---------------|----------------------|-------------------------|
| pdf.js (pdfjs-dist) | Parse + render PDF pages to canvas (its own Web Worker) | N/A — hard requirement |
| pdf-lib | Write signatures/text back into the PDF and re-save | N/A — hard requirement |
| Pointer Events + Canvas 2D | Pressure-sensitive signature drawing pad | Mouse/touch coalesced events |
| Canvas 2D (rasterise) | Typed signatures + checkmarks → transparent PNG | N/A |
| File API / Drag & Drop | Ingest the PDF and uploaded signature images | tap-to-pick input |
| Blob / URL.createObjectURL | Deliver the signed PDF for download | N/A |
| Web Share API (Level 2, files) | Share the signed PDF on mobile | download button |
| Clipboard API | Copy filename / status | download button |
| Service Worker (vite-plugin-pwa) | Offline capability after first load | works online only |

## Workflow (input → process → output)
1. User drops a PDF. pdf.js renders every page into the scrollable canvas column.
2. User creates a signature once (draw with finger/stylus, type a name, or upload an image).
3. User clicks a tool (signature / text / date / initials / checkmark) and clicks on a page
   to drop it; drags to position, drags a handle to resize, types into text fields.
4. On "Download signed PDF", pdf-lib loads the original bytes, embeds each placed item at the
   correct PDF coordinate (accounting for page size, rotation, and bottom-left origin), and
   saves. User gets `contract-signed.pdf` via download / Web Share.

## Non-Goals
- No cryptographic/digital signatures (PKI, /Sig fields) — this is visual signing, and the
  UI says so plainly. (Logged as a possible future expansion.)
- No cloud storage, no accounts, ever.
- No form-field auto-detection v1 (manual placement only).
- No multi-file batch v1.

## Target Audience
A non-technical person at home or a small-business owner at their desk, mildly stressed,
needing to return a signed document in the next ten minutes without installing anything or
trusting an upload. Broad, mainstream, privacy-anxious-once-they-think-about-it.

## Style Direction
**Tone:** friendly, calm, trustworthy — reassuring, not technical.
**Colour palette:** warm paper-white surfaces with a confident deep ink-indigo accent (the
"ink" in inkwell). Feels like good stationery, not a hacker terminal. Justified because the
audience is mainstream and the emotional job is *reassurance about a sensitive document*.
**UI density:** spacious.
**Dark/light theme:** light (consumer/document audience), with a system-dark fallback.
**Reference tools for feel:** Smallpdf / DocuSign's calm end, but warmer and without the upsell.

## Technical Architecture
- **Stack:** Vanilla TypeScript + Vite. State is a small central store repainted on change;
  no React needed (single workspace view, no deep component tree).
- **Key libraries:** pdfjs-dist (render), pdf-lib (write), vite-plugin-pwa (offline).
- **Worker strategy:** pdf.js runs parsing/render in its own bundled Web Worker (no CDN).
  pdf-lib export runs on the main thread (fast for typical documents) with a progress state.
- **Storage:** none. Signatures live in tab memory only and are never persisted — a
  deliberate privacy decision surfaced in the Threat Model.

## Privacy & Trust Model
**Protected**
- The PDF bytes — parsed, rendered, and re-saved entirely in the tab.
- Your signature image — drawn/typed/uploaded locally, embedded locally, never stored.
- All placed text (names, dates) — only ever written into the local PDF.

**Not protected**
- The initial page load is served by GitHub Pages (static HTML/JS/CSS + pdf.js worker); its
  CDN sees your IP requesting the app, as with any website. It never sees your document.
- If you use the Web Share sheet, whatever app you pick then receives the file (by design).

**Trust surface**
- The static site bundle (hash-pinned via the GitHub Pages deploy) and the TLS chain to
  GitHub Pages. No third-party scripts, fonts, analytics, or network calls at runtime.

## UX Required Surfaces
- Drop zone (drag-drop, tap-to-pick) for the PDF.
- Determinate progress on load (pages rendered N/total) and on export.
- Signature creator modal: Draw / Type / Upload tabs.
- Tool rail: signature, initials, text, date, checkmark; click-to-place, drag, resize, delete.
- Event log drawer (Dropwell pattern).
- How-It-Works modal, Threat Model modal, About modal (benrichardson.dev attribution).
- Output: download + Web Share + copy filename.
- Keyboard: Escape (dismiss/deselect), Delete/Backspace (remove selected), Enter (primary).
- Sticky footer "Built by benrichardson.dev".
