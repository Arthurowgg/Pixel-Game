import { POND, WORLD, distance, random } from './data';
import type { Resource, ResourceKind } from './types';
import type { DecorKind, DecorProp } from './decor';
import { inClearing, trailDistance } from './forest';

/** The forest is endless: the authored map is the home valley, and everything
 * beyond it is generated in deterministic chunks as the survivor walks. */
export const CHUNK = 512;
/** How many chunks around the player stay loaded (a 5x5 window). */
export const LOAD_RADIUS = 2;

export const chunkOf = (point: { x: number; y: number }) => ({
  cx: Math.floor(point.x / CHUNK),
  cy: Math.floor(point.y / CHUNK),
});
export const chunkKey = (cx: number, cy: number) => `${cx},${cy}`;
/** Home chunks hold the authored camp, trails, pond and their hand-placed props. */
export function isHomeChunk(cx: number, cy: number) {
  const left = cx * CHUNK,
    top = cy * CHUNK;
  return left < WORLD.width && top < WORLD.height && left + CHUNK > 0 && top + CHUNK > 0;
}
/** Stable ids: a chunk owns a private block of 64 ids, offset clear of the home
 * valley's hand-placed resources, and kept well inside the save validator's range. */
const baseId = (cx: number, cy: number) => ((cx + 2048) * 2048 + (cy + 2048)) * 64 + 1_000;

// 'moss' is the harvestable mossy boulder: a stone resource with the moss sprite.
const KINDS: [ResourceKind | 'moss', number][] = [
  ['tree', 58],
  ['fiber', 11],
  ['stone', 10],
  ['berries', 9],
  ['mushroom', 7],
  ['moss', 5],
];

const RESOURCE_HP: Record<ResourceKind, number> = {
  tree: 6,
  stone: 4,
  berries: 1,
  fiber: 1,
  mushroom: 1,
};

/** Everything the survivor can gather in one chunk, dense in groves, sparse in
 * the open, and never on a trail or in the home pond. Deterministic per seed. */
export function chunkResources(seed: number, cx: number, cy: number): Resource[] {
  if (isHomeChunk(cx, cy)) return [];
  const rng = random(seed + cx * 7919 + cy * 104_729 + 13);
  const resources: Resource[] = [];
  const center = { x: cx * CHUNK + CHUNK / 2, y: cy * CHUNK + CHUNK / 2 };
  // A soft grove signal so the endless forest still has clearings and thickets.
  const grove = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(cx * 0.37 + cy * 0.71));
  const attempts = 46;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const point = {
      x: cx * CHUNK + 12 + rng() * (CHUNK - 24),
      y: cy * CHUNK + 12 + rng() * (CHUNK - 24),
    };
    if (inClearing(point, 8) || trailDistance(point) < 8) continue;
    if (distance(point, POND) < Math.max(POND.rx, POND.ry) + 30) continue;
    if (resources.some((resource) => distance(resource, point) < 22)) continue;
    const roll = rng() * KINDS.reduce((sum, [, weight]) => sum + weight, 0);
    let acc = 0,
      pick: ResourceKind | 'moss' = 'tree';
    for (const [kind, weight] of KINDS) {
      acc += weight;
      if (roll <= acc) {
        pick = kind;
        break;
      }
    }
    // Thickets: trees lean towards the grove, mushrooms and moss to shade.
    if (pick === 'tree' && rng() > grove) pick = 'fiber';
    const mossy = pick === 'moss';
    const kind: ResourceKind = mossy ? 'stone' : (pick as ResourceKind);
    const local = resources.length;
    resources.push({
      id: baseId(cx, cy) + local,
      kind,
      x: Math.round(point.x),
      y: Math.round(point.y),
      hp: RESOURCE_HP[kind],
      readyAt: 0,
      scale: 0.85 + rng() * 0.4,
      variant: mossy ? 0.95 : rng(),
    });
    void center;
  }
  return resources;
}

const DECOR_KINDS: [DecorKind, number][] = [
  ['fern', 34],
  ['clover', 26],
  ['mushrooms', 22],
  ['wildflowers', 18],
];

/** Undergrowth for one generated chunk, on the same 58 px jittered grid the home
 * valley uses, so the endless forest keeps the same visual language. */
export function chunkDecor(seed: number, cx: number, cy: number): DecorProp[] {
  if (isHomeChunk(cx, cy)) return [];
  const rng = random(seed + cx * 3571 + cy * 6553 + 91);
  const props: DecorProp[] = [];
  const cell = 58;
  const columns = Math.floor(CHUNK / cell),
    rows = Math.floor(CHUNK / cell);
  for (let row = 0; row < rows; row++)
    for (let column = 0; column < columns; column++) {
      const x = cx * CHUNK + column * cell + 8 + rng() * (cell - 16),
        y = cy * CHUNK + row * cell + 8 + rng() * (cell - 16);
      if (rng() > 0.34) continue;
      const roll = rng() * 100;
      let acc = 0,
        kind: DecorKind = 'fern';
      for (const [candidate, weight] of DECOR_KINDS) {
        acc += weight;
        if (roll <= acc) {
          kind = candidate;
          break;
        }
      }
      props.push({
        x: Math.round(x),
        y: Math.round(y),
        kind,
        flip: rng() < 0.5,
        scale: 0.86 + rng() * 0.22,
        phase: rng() * Math.PI * 2,
      });
    }
  return props;
}
