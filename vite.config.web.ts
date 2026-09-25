import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Separate build target for the web/PWA version of the app. Shares 100% of the renderer source with the
 * Electron build (electron.vite.config.ts) — this just points Vite at the same root and adds the service
 * worker / manifest, which only make sense for a browser context.
 */
export default defineConfig({
  root: 'src/renderer',
  base: './',
  build: {
    outDir: resolve(__dirname, 'dist-web'),
    emptyOutDir: true,
  },
  worker: { format: 'es' },
  resolve: { alias: { '@': resolve(__dirname, 'src/renderer') } },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: 'B-Chess',
        short_name: 'B-Chess',
        description: 'A smooth, animated chess game — play locally or against the computer.',
        start_url: '.',
        display: 'standalone',
        background_color: '#16150f',
        theme_color: '#16150f',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Everything the app needs is bundled at build time (no backend), so cache it all for offline play.
        globPatterns: ['**/*.{js,css,html,png,svg,json}'],
      },
    }),
  ],
});
