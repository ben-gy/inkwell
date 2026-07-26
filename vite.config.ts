// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.svg',
        'favicon-32.png',
        'favicon-16.png',
        'apple-touch-icon.png',
        'robots.txt',
      ],
      manifest: {
        name: 'inkwell — sign & fill PDFs in your browser',
        short_name: 'inkwell',
        description:
          'Sign, initial, date and fill PDFs right in your browser — draw, type or upload a signature. Nothing is uploaded.',
        id: '/',
        start_url: '/',
        scope: '/',
        theme_color: '#4338ca',
        background_color: '#faf7f2',
        display: 'standalone',
        orientation: 'any',
        categories: ['productivity', 'utilities', 'business'],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'apple-touch-icon.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        // pdf.js worker + wasm-free bundle; cache the shell, icons and sample PDF.
        globPatterns: ['**/*.{js,css,html,svg,woff2,png,pdf}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: 'index.html',
      },
    }),
  ],
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  worker: {
    format: 'es',
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
