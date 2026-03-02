/**
 * Firefox MV2 build configuration.
 * Outputs to dist-firefox/ — load THIS folder in Firefox about:debugging.
 *
 * Usage:
 *   npx vite build --config vite.config.firefox.ts
 * Or via package.json script:
 *   npm run build:firefox
 */
import { defineConfig } from 'vite';
import webExtension from '@samrum/vite-plugin-web-extension';
import { resolve } from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const manifest = require('./manifest-firefox.json');

export default defineConfig({
  plugins: [
    webExtension({
      // Cast to any — MV2 manifest; plugin supports both MV2 and MV3
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      manifest: manifest as any,
    }),
  ],
  resolve: {
    alias: {
      '@mindvault/shared': resolve(__dirname, '../shared/src/index.ts'),
    },
  },
  build: {
    outDir: 'dist-firefox',
    emptyOutDir: true,
    sourcemap: process.env['NODE_ENV'] !== 'production',
  },
});
