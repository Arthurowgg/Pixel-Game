import { CAMP_BENCH, distance } from './data';
import type { Fire, Point } from './types';

/** Feet rest in front of the seat; the solid plank is behind them. */
export function blocksCampBench(point: Point, padding = 0) {
  return (
    Math.abs(point.x - CAMP_BENCH.x) < 18 + padding && Math.abs(point.y - (CAMP_BENCH.y - 10)) < 5 + padding
  );
}
export const hasCampBench = (fire: Fire) => distance(fire, CAMP_BENCH) < 56;

/** Short, collision-checked cardinal paths. No teleporting into furniture and
 * no diagonal shortcut: each leg is tested in <=2-world-pixel steps. */
export function routeToBench(from: Point, blocked: (point: Point) => boolean): Point[] | null {
  const seat = { ...CAMP_BENCH },
    frontY = seat.y + 9;
  const routes = [
    [{ x: seat.x, y: from.y }, seat],
    [{ x: from.x, y: frontY }, { x: seat.x, y: frontY }, seat],
    ...[1, -1].map((side) => [
      { x: seat.x + side * 28, y: from.y },
      { x: seat.x + side * 28, y: frontY },
      { x: seat.x, y: frontY },
      seat,
    ]),
  ];
  for (const route of routes) {
    let previous = from,
      valid = true;
    const steps: Point[] = [];
    for (const point of route) {
      const gap = distance(previous, point);
      if (gap < 0.001) continue;
      const count = Math.ceil(gap / 2);
      for (let i = 1; i <= count; i++) {
        if (
          blocked({
            x: previous.x + ((point.x - previous.x) * i) / count,
            y: previous.y + ((point.y - previous.y) * i) / count,
          })
        ) {
          valid = false;
          break;
        }
      }
      if (!valid) break;
      steps.push({ ...point });
      previous = point;
    }
    if (valid) return steps;
  }
  return null;
}
