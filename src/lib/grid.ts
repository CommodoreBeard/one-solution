import type { Cell, Shape } from './types';

/** Stable key for a cell, so cells can live in a Set or Map. */
export function cellKey(cell: Cell): string {
  return `${cell.row},${cell.col}`;
}

/** Translate a shape so its top-left bounding corner sits at the origin. */
export function normalise(shape: Shape): Shape {
  if (shape.length === 0) return [];
  let minRow = Infinity;
  let minCol = Infinity;
  for (const { row, col } of shape) {
    if (row < minRow) minRow = row;
    if (col < minCol) minCol = col;
  }
  return shape
    .map(({ row, col }) => ({ row: row - minRow, col: col - minCol }))
    .sort((a, b) => a.row - b.row || a.col - b.col);
}

/** True when every cell is reachable from every other by edge adjacency. */
export function isConnected(shape: Shape): boolean {
  if (shape.length === 0) return false;
  const remaining = new Set(shape.map(cellKey));
  const start = shape[0]!;
  const queue: Cell[] = [start];
  remaining.delete(cellKey(start));
  while (queue.length > 0) {
    const { row, col } = queue.pop()!;
    for (const next of [
      { row: row + 1, col },
      { row: row - 1, col },
      { row, col: col + 1 },
      { row, col: col - 1 },
    ]) {
      const key = cellKey(next);
      if (remaining.delete(key)) queue.push(next);
    }
  }
  return remaining.size === 0;
}
