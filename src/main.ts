/**
 * Mount point. The UI is built in issue #6; this keeps the build honest until
 * then by proving the bundle, the alias and the type-check all work.
 */
import { DEFAULT_PIECE_COUNT, MAX_PIECES } from '@/lib/envelope';

const app = document.querySelector<HTMLDivElement>('#app');

if (app) {
  app.textContent = `One Solution — engine not yet wired up (default ${DEFAULT_PIECE_COUNT} pieces, max ${MAX_PIECES}).`;
}
