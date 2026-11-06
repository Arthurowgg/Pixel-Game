import { CAMP, POND, WORLD, distance, random } from './data';
import { FOREST_CLEARINGS, FOREST_DECOR, groveDensity, inClearing, inPond, trailDistance } from './forest';

/** Small props that dress the forest. Purely cosmetic: they never collide, and
 * they are derived from the save seed, so existing saves gain them for free. */
export type DecorKind = 'mushrooms' | 'clover' | 'fern' | 'wildflowers' | 'mossBoulder' | 'reeds';

export interface DecorProp {
  x: number;
  y: number;
  kind: DecorKind;
  flip: boolean;
  /** Kept inside 0.86–1.08 so clumps read as one growth, not as resized assets. */
  scale: number;
  /** Sway offset, so neighbouring ferns never nod in lockstep. */
  phase: number;
}

export const DECOR_KINDS: readonly DecorKind[] = [
  'mushrooms',
  'clover',
  'fern',
  'wildflowers',
  'mossBoulder',
  'reeds',
];
/** Grid pitch in world pixels; roughly one candidate every 58 px square. */
const CELL = 58;
const FAIRY_RING = { x: 744, y: 470, radius: 27 };
const cache = new Map<number, DecorProp[]>();

/** What grows where: shoreline reeds, flower fringes, deep-forest litter. */
const GROWTH: Record<'shore' | 'rim' | 'grove' | 'verge' | 'open', Partial<Record<DecorKind, number>>> = {
  shore: { reeds: 6, fern: 3, clover: 1 },
  rim: { wildflowers: 5, clover: 2, fern: 2, mushrooms: 1 },
  grove: { fern: 4, clover: 3, mushrooms: 3, mossBoulder: 1, wildflowers: 0.5 },
  verge: { wildflowers: 4, clover: 2, mushrooms: 2.5, fern: 1.5 },
  open: { fern: 3, clover: 2, mushrooms: 2, wildflowers: 1.8, mossBoulder: 1.1 },
};

function choose(context: keyof typeof GROWTH, roll: number): DecorKind {
  const entries = Object.entries(GROWTH[context]) as [DecorKind, number][];
  let remaining = roll * entries.reduce((sum, [, weight]) => sum + weight, 0);
  for (const [kind, weight] of entries) {
    remaining -= weight;
    if (remaining <= 0) return kind;
  }
  return entries[entries.length - 1][0];
}

const insidePond = (point: { x: number; y: number }) => inPond(point);
const inBounds = (point: { x: number; y: number }) =>
  point.x >= 26 && point.x <= WORLD.width - 26 && point.y >= 40 && point.y <= WORLD.height - 18;

/**
 * Deterministic undergrowth for a seed: a jittered scatter with the density of
 * the groves, plus a handful of composed spots (a fairy ring, mushroom shelves
 * beside the fallen logs, boulders against the waystones, reed banks round the
 * pond and flowers on the clearing rims) so the forest has places, not just noise.
 */
export function forestDecor(seed: number): DecorProp[] {
  const cached = cache.get(seed);
  if (cached) return cached;
  const rng = random(seed + 3121);
  const props: DecorProp[] = [];
  const add = (kind: DecorKind, x: number, y: number, minGap = 0) => {
    const point = { x: Math.round(x), y: Math.round(y) };
    if (!inBounds(point) || insidePond(point) || distance(point, CAMP) < 92) return;
    if (minGap && props.some((p) => Math.abs(p.x - point.x) < minGap && Math.abs(p.y - point.y) < minGap))
      return;
    props.push({
      ...point,
      kind,
      flip: rng() < 0.5,
      scale: 0.86 + rng() * 0.22,
      phase: rng() * Math.PI * 2,
    });
  };

  // A ring of caps on a mossy bank: the one spot people will walk to on purpose.
  for (let i = 0; i < 9; i++) {
    const angle = (i / 9) * Math.PI * 2 + 0.2;
    add(
      'mushrooms',
      FAIRY_RING.x + Math.cos(angle) * (FAIRY_RING.radius + rng() * 3),
      FAIRY_RING.y + Math.sin(angle) * (FAIRY_RING.radius * 0.62 + rng() * 2),
    );
  }
  // Growth hugging the damp end of every fallen log.
  for (const log of FOREST_DECOR.filter((entry) => entry.kind === 'fallenLog'))
    for (let i = 0; i < 3; i++) add('mushrooms', log.x - 26 + i * 15 + rng() * 5, log.y + 7 + rng() * 4);
  // Boulders leant against the waystones, and a fern on their shaded side.
  for (const stone of FOREST_DECOR.filter((entry) => entry.kind === 'waystone')) {
    add('mossBoulder', stone.x + 21, stone.y + 11);
    add(rng() < 0.5 ? 'fern' : 'wildflowers', stone.x - 23, stone.y + 9);
  }
  // Reed banks on the pond shore, with ferns stepping back into the grass.
  for (let i = 0; i < 5; i++) {
    const angle = 0.5 + i * 1.22;
    const x = POND.x + Math.cos(angle) * (POND.rx + 6),
      y = POND.y + Math.sin(angle) * (POND.ry + 5);
    for (let n = 0; n < 3; n++) add('reeds', x + (n - 1) * 6 + rng() * 3, y + rng() * 5);
    add('fern', x + 16, y + 12);
  }
  // Flower fringes on the sunnier clearing rims.
  for (const clearing of FOREST_CLEARINGS)
    for (let i = 0; i < 6; i++) {
      const angle = 2.1 + i * 0.42;
      add(
        rng() < 0.55 ? 'wildflowers' : rng() < 0.6 ? 'clover' : 'fern',
        clearing.x + Math.cos(angle) * (clearing.rx + 4 + rng() * 8),
        clearing.y + Math.sin(angle) * (clearing.ry + 3 + rng() * 6),
      );
    }

  for (let row = 0; row * CELL < WORLD.height; row++)
    for (let column = 0; column * CELL < WORLD.width; column++) {
      const point = {
        x: column * CELL + 8 + rng() * (CELL - 16),
        y: row * CELL + 8 + rng() * (CELL - 16),
      };
      if (!inBounds(point) || insidePond(point)) continue;
      const grove = groveDensity(point),
        gap = trailDistance(point),
        rim = inClearing(point, 30) && !inClearing(point, 2),
        camp = distance(point, CAMP),
        shore = inPond(point, 26);
      if (camp < 96 || gap < 6) continue;
      let chance = 0.34 + grove * 0.36 + (rim ? 0.16 : 0) + (gap < 34 ? 0.14 : 0);
      if (camp < 150) chance *= 0.45;
      if (shore) chance = 0.88;
      if (rng() > chance) continue;
      const context = shore ? 'shore' : rim ? 'rim' : grove > 0.55 ? 'grove' : gap < 26 ? 'verge' : 'open';
      const kind = choose(context, rng());
      // A boulder in the ruts of a trail reads as debris, not dressing.
      add(kind === 'mossBoulder' && gap < 15 ? 'fern' : kind, point.x, point.y, 9);
    }
  cache.set(seed, props);
  return props;
}
