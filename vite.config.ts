import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const src = fileURLToPath(new URL('./src', import.meta.url));

export default defineConfig({
  // Served from a project page (user.github.io/one-solution), so asset URLs
  // must be relative rather than root-absolute.
  base: './',
  resolve: {
    // Kept in sync by hand with tsconfig's `@/*` and vitest.config.ts.
    alias: { '@': src },
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
  },
});
