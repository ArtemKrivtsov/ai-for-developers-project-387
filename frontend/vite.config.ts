/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:3000',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './test/setup.ts',
    // A browser far from Moscow: times on the pages must stay Moscow time anyway.
    env: { TZ: 'America/Los_Angeles' },
    // The longest form tests take about 4 s alone and went past the default 5 s on a loaded CI
    // runner, while other packages ran their tests in parallel.
    testTimeout: 15_000,
  },
});
