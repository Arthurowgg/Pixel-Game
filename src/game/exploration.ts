import { CAMP, WORLD, distance } from './data';
import type { Point } from './types';

export const EXPLORE_CELL = 40;
export const EXPLORE_COLUMNS = Math.ceil(WORLD.width / EXPLORE_CELL);
export const EXPLORE_ROWS = Math.ceil(WORLD.height / EXPLORE_CELL);
export const EXPLORE_CELLS = EXPLORE_COLUMNS * EXPLORE_ROWS;
export const EXPLORE_RADIUS = 145;
export function cellAt(point: Point) {
  const x = Math.min(EXPLORE_COLUMNS - 1, Math.max(0, Math.floor(point.x / EXPLORE_CELL)));
  const y = Math.min(EXPLORE_ROWS - 1, Math.max(0, Math.floor(point.y / EXPLORE_CELL)));
  return y * EXPLORE_COLUMNS + x;
}
export function cellCenter(index: number): Point {
  return {
    x: ((index % EXPLORE_COLUMNS) + 0.5) * EXPLORE_CELL,
    y: (Math.floor(index / EXPLORE_COLUMNS) + 0.5) * EXPLORE_CELL,
  };
}
/** An append-only, bounded grid. The Set is runtime-only; JSON stores indices. */
export function revealAround(cells: number[], known: Set<number>, point: Point, radius = EXPLORE_RADIUS) {
  let added = 0;
  const left = Math.max(0, Math.floor((point.x - radius) / EXPLORE_CELL));
  const right = Math.min(EXPLORE_COLUMNS - 1, Math.floor((point.x + radius) / EXPLORE_CELL));
  const top = Math.max(0, Math.floor((point.y - radius) / EXPLORE_CELL));
  const bottom = Math.min(EXPLORE_ROWS - 1, Math.floor((point.y + radius) / EXPLORE_CELL));
  for (let y = top; y <= bottom; y++)
    for (let x = left; x <= right; x++) {
      const index = y * EXPLORE_COLUMNS + x;
      if (known.has(index) || distance(cellCenter(index), point) > radius) continue;
      known.add(index);
      cells.push(index);
      added++;
    }
  return added;
}
export function initialExploration(point: Point) {
  const cells: number[] = [],
    known = new Set<number>();
  // The arrival clearing is known; an old save gets only its current vicinity,
  // never a fabricated history or a fully revealed map.
  revealAround(cells, known, CAMP, 112);
  revealAround(cells, known, point);
  return cells;
}
export const exploredPercent = (cells: readonly number[]) => Math.floor((cells.length / EXPLORE_CELLS) * 100);
