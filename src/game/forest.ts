import { CAMP, POND, WORLD, clamp, distance } from './data';
import type { Point } from './types';

export interface ForestTrail {
  width: number;
  points: readonly Point[];
}
/** Shared by terrain, planting and cartography: a trail is actually walkable,
 * not merely a stripe painted underneath randomly placed trunks. */
export const FOREST_TRAILS: readonly ForestTrail[] = [
  {
    width: 32,
    points: [
      { x: 52, y: 940 },
      { x: 300, y: 930 },
      { x: 430, y: 895 },
      { x: 650, y: 885 },
      { x: 830, y: 880 },
      { x: 980, y: 875 },
      { x: 1060, y: 820 },
      { x: 1082, y: 700 },
      { x: 1100, y: 660 },
    ],
  },
  {
    width: 25,
    points: [
      { x: 860, y: 735 },
      { x: 780, y: 620 },
      { x: 660, y: 580 },
      { x: 570, y: 440 },
      { x: 485, y: 380 },
      { x: 440, y: 220 },
      { x: 560, y: 72 },
    ],
  },
  {
    width: 23,
    points: [
      { x: 1040, y: 760 },
      { x: 1045, y: 910 },
      { x: 1160, y: 1030 },
      { x: 1290, y: 1060 },
      { x: 1470, y: 1160 },
      { x: 1730, y: 1210 },
    ],
  },
  {
    width: 18,
    points: [
      { x: 1030, y: 705 },
      { x: 1020, y: 510 },
      { x: 1160, y: 400 },
      { x: 1390, y: 425 },
      { x: 1530, y: 565 },
      { x: 1720, y: 555 },
    ],
  },
  {
    // A short, soft spur joins the long east-west route to the clearing gate
    // so the camp reads as a place on the map, not a bubble beside a stripe.
    width: 20,
    points: [
      { x: 862, y: 878 },
      { x: 888, y: 852 },
      { x: 900, y: 839 },
    ],
  },
];
export const FOREST_CLEARINGS = [
  { ...CAMP, rx: 134, ry: 104 },
  { x: 485, y: 380, rx: 88, ry: 75 },
  { x: 1290, y: 1060, rx: 106, ry: 76 },
  { x: 420, y: 1000, rx: 92, ry: 68 },
];
export const FOREST_GROVES = [
  { x: 220, y: 265, radius: 235 },
  { x: 855, y: 300, radius: 240 },
  { x: 1460, y: 245, radius: 230 },
  { x: 350, y: 610, radius: 220 },
  { x: 725, y: 1030, radius: 245 },
  { x: 1495, y: 825, radius: 215 },
  { x: 220, y: 1190, radius: 195 },
  { x: 1140, y: 1240, radius: 170 },
];
export const FOREST_LANDMARKS = [
  { x: 478, y: 366, name: 'Old Waystone', kind: 'waystone' as const },
  { x: 404, y: 984, name: 'Fallen Grove', kind: 'fallenLog' as const },
  { x: 1302, y: 1040, name: 'Mossy Meadow', kind: 'fallenLog' as const },
];
export const FOREST_DECOR = [
  { x: 802, y: 707, kind: 'fallenLog' as const },
  { x: 1008, y: 719, kind: 'waystone' as const },
  { x: 1512, y: 615, kind: 'fallenLog' as const },
  { x: 702, y: 532, kind: 'fallenLog' as const },
  ...FOREST_LANDMARKS,
];
export function segmentDistance(point: Point, a: Point, b: Point) {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const length = dx * dx + dy * dy;
  const t = length ? clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / length, 0, 1) : 0;
  return distance(point, { x: a.x + dx * t, y: a.y + dy * t });
}
export function trailDistance(point: Point) {
  return Math.min(
    ...FOREST_TRAILS.map((trail) =>
      Math.min(
        ...trail.points
          .slice(1)
          .map((end, i) => segmentDistance(point, trail.points[i], end) - trail.width / 2),
      ),
    ),
  );
}
export function inClearing(point: Point, extra = 0) {
  return FOREST_CLEARINGS.some(
    (area) =>
      ((point.x - area.x) / (area.rx + extra)) ** 2 + ((point.y - area.y) / (area.ry + extra)) ** 2 < 1,
  );
}
export function inPond(point: Point, padding = 0) {
  return (
    ((point.x - POND.x) / (POND.rx + padding)) ** 2 + ((point.y - POND.y) / (POND.ry + padding)) ** 2 < 1
  );
}
export function groveDensity(point: Point) {
  return Math.max(...FOREST_GROVES.map((grove) => Math.max(0, 1 - distance(point, grove) / grove.radius)));
}
export function trailSamples(trail: ForestTrail, spacing = 5) {
  const points: Point[] = [];
  for (let i = 1; i < trail.points.length; i++) {
    const a = trail.points[i - 1],
      b = trail.points[i];
    const steps = Math.ceil(distance(a, b) / spacing);
    for (let n = 0; n < steps; n++)
      points.push({ x: a.x + ((b.x - a.x) * n) / steps, y: a.y + ((b.y - a.y) * n) / steps });
  }
  return points;
}
export const boundToForest = (point: Point) => ({
  x: clamp(point.x, 36, WORLD.width - 36),
  y: clamp(point.y, 50, WORLD.height - 30),
});
