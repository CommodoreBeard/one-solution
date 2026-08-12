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
    // The known-answer tests fully enumerate the pentomino rectangles, and
    // 6x10 has 9,356 packings. That is seconds, not milliseconds, and it is
    // the price of checking the guarantee against published values rather
    // than against our own solver. The default 5s would fail them, and a
    // timeout cannot interrupt the search anyway: it is one synchronous call.
    testTimeout: 120_000,
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**', 'reference/**'],
  },
  resolve: {
    // Match tsconfig's `@/*` -> ./src mapping.
    alias: { '@': src },
  },
});
