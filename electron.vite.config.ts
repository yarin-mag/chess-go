import { resolve } from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: { plugins: [externalizeDepsPlugin()] },
  preload: { plugins: [externalizeDepsPlugin()] },
  renderer: {
    plugins: [react()],
    resolve: { alias: { '@': resolve('src/renderer') } },
    worker: { format: 'es' },
    // Same reasoning as vite.config.web.ts: electron-vite's renderer root is implicitly src/renderer,
    // which would otherwise move Vite's env-file lookup away from this repo's actual root .env files.
    envDir: resolve(__dirname),
  },
});
