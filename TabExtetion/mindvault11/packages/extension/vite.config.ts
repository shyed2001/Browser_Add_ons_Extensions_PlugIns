import { defineConfig } from 'vite';
import webExtension from '@samrum/vite-plugin-web-extension';
import { resolve } from 'path';
import manifest from './manifest.json';

export default defineConfig({
  plugins: [
    webExtension({
      manifest: manifest as chrome.runtime.ManifestV3,
    }),
  ],
  resolve: {
    alias: {
      '@mindvault/shared': resolve(__dirname, '../shared/src/index.ts'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: process.env['NODE_ENV'] !== 'production',
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    ui: { port: 51204 },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/test-setup.ts'],
      thresholds: {
        global: {
          branches: 70,
          functions: 75,
          lines: 75,
          statements: 75,
        },
      },
    },
  },
});
