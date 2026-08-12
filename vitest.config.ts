import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const src = fileURLToPath(new URL('./src', import.meta.url));

export default defineConfig({
  test: {
    // The engine is pure computation; only the thin UI layer touches the DOM,
    // and that is covered by hand rather than by jsdom. Node keeps the solver
    // suite fast enough to run the full known-answer set on every commit.
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**', 'reference/**'],
  },
  resolve: {
    // Match tsconfig's `@/*` -> ./src mapping.
    alias: { '@': src },
  },
});
