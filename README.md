# inkwell

**Sign and fill PDFs in your browser — nothing is uploaded.**

Live: https://inkwell.benrichardson.dev

---

## what it is

You get emailed a contract, an NDA, a school form, a rental agreement. You need to add
your signature, initials, a date, and tick a couple of boxes, then send it back. You don't
have a printer. So you search "sign PDF online free" and land on a site that wants you to
**upload** the document — handing a stranger's server a signed legal document with your
name, address and signature on it.

inkwell does the whole job on your device. The PDF is opened, rendered, annotated and
re-saved entirely inside the browser tab. The bytes never leave your machine — once the
page has loaded you can turn off your Wi-Fi and it keeps working.

It's for anyone who needs to return a signed document in the next ten minutes without
installing anything, making an account, or trusting an upload.

## how it works

```
 drop PDF ──► pdf.js renders each page to a <canvas>
                        │
     create signature ──┤  draw (pressure-sensitive) · type · upload
                        │      └─► rasterised to a transparent PNG, in-tab
                        ▼
   place / drag / resize signature · initials · text · date · checkmark
                        │   (positions stored normalised to each page)
                        ▼
 "Download signed PDF" ──► pdf-lib embeds each item at the correct PDF
                           coordinate and saves a new -signed.pdf
```

The interesting part is the coordinate mapping. You place annotations on the *displayed*
page (top-left origin, y-down, whatever the page's rotation is), but PDF drawing happens in
the page's *unrotated* space (bottom-left origin, y-up, with a separate rotation applied at
draw time). `src/coords.ts` converts between the two — deriving the pdf-lib draw pivot,
size and rotation for any page /Rotate value — and is fully unit-tested in isolation.

## browser APIs used

- **pdf.js (pdfjs-dist)** — parses and rasterises PDF pages in its own bundled Web Worker
  (no CDN, same-origin), keeping the main thread responsive.
- **pdf-lib** — embeds the placed signatures/text and re-saves the document, in-browser.
- **Pointer Events + Canvas 2D** — pressure-sensitive signature drawing; drag/resize of
  placed annotations.
- **Canvas 2D rasterisation** — typed signatures and checkmarks become transparent PNGs.
- **File API / Drag & Drop** — ingesting the PDF and uploaded signature images.
- **Blob / URL.createObjectURL** — delivering the signed PDF.
- **Web Share API (files)** — sharing the signed PDF on mobile where supported.
- **Service Worker (vite-plugin-pwa)** — offline capability after first load.

## security / privacy model

**Protected**
- The PDF — parsed, rendered and re-saved entirely inside the tab.
- Your signature — drawn/typed/uploaded locally and embedded locally.
- All text you type — only ever written into your local file. Nothing is stored; reload and
  every trace is gone.

**Not protected**
- The initial page load is served by GitHub Pages, whose CDN sees your IP fetching the app
  (as with any website). It never sees your document.
- Using the native Share sheet hands the file to whatever app you pick — by your choice.
- inkwell adds a **visible** signature. It is *not* a cryptographic / digital (PKI)
  signature and carries no tamper-evidence.

**Trust model**
- The static site bundle served over HTTPS from GitHub Pages, and the TLS chain to it.
- No third-party fonts, trackers or cookies. The only third-party script is the Cloudflare Web Analytics beacon — anonymous, cookie-less page-view counts with no personal data and no cross-site tracking. After load, the Network
  tab stays silent.

## stack

- Vite 6 + vanilla TypeScript
- pdfjs-dist (render) · pdf-lib (write)
- Vitest for unit tests (coordinate math, formatting, image trimming, validation)
- GitHub Pages for hosting, deployed via GitHub Actions

No runtime dependencies beyond pdf.js and pdf-lib. No cookies, no fingerprinting, no
third-party fonts. The only analytics is Cloudflare Web Analytics — anonymous, cookie-less
page-view counts; no personal data, no cross-site tracking.

## local development

```bash
npm install
npm run dev      # vite dev server
npm test         # run vitest suite
npm run build    # produce dist/ for deploy
npm run preview  # serve dist/ locally
```

## deploying

A push to `main` triggers `.github/workflows/deploy.yml`, which runs tests, builds, and
deploys `dist/` to GitHub Pages. The custom domain is set via `public/CNAME` — point a
`CNAME` DNS record for `inkwell.benrichardson.dev` at `ben-gy.github.io`.

## license

MIT — see [LICENSE](./LICENSE).
