# inkwell — Build Review

This file exists only to create a reviewable PR. All code is already deployed on `main`.

**Merge this PR to acknowledge the build.** Closing without merging is also fine.

## Links

- **GitHub Pages:** https://ben-gy.github.io/inkwell/ *(redirects to custom domain once DNS is set)*
- **Custom domain:** https://inkwell.benrichardson.dev *(live after DNS + cert below)*

## What it is

Client-side PDF signing & filling. Open a PDF, add a signature (draw / type / upload),
place text, dates, initials and checkmarks, and download a flattened `-signed.pdf`. The
document never leaves the browser tab — no uploads, no account, no watermark, works offline.

- **Render:** pdf.js (pdfjs-dist) in its own bundled Web Worker
- **Write:** pdf-lib embeds annotations at the correct PDF coordinate
- **Signatures:** Pointer Events + Canvas 2D (pressure-sensitive draw), typed, or uploaded
- The rotation/coordinate math (`src/coords.ts`) is pure and fully unit-tested (36 tests pass)

## Verified in-browser before shipping

- Load → render (multi-page) → place signature/text/date/checkmark → export
- Re-parsed the exported PDF with pdf.js: correct pages, `paintImageXObject` + `showText`
  land on the right page; typed text round-trips exactly
- Modals (how it works / privacy / about), glossary tooltips, mobile layout (no overflow)

## DNS setup required

Add in Cloudflare (`benrichardson.dev` zone) — already scripted during the build:

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| CNAME | `inkwell` | `ben-gy.github.io` | DNS only (grey cloud) |

Then trigger cert issuance (also scripted):
```bash
gh api repos/ben-gy/inkwell/pages -X PUT -f cname=""
sleep 3
gh api repos/ben-gy/inkwell/pages -X PUT -f cname="inkwell.benrichardson.dev"
```
