import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// GitHub Pages project site: https://<user>.github.io/scene-forge/
export default defineConfig({
  base: '/scene-forge/',
  plugins: [react()],
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30_000,
  },
});
