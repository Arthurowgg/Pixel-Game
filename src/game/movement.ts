import type { Direction, Point } from './types';

export const DIRECTIONS = ['right', 'down', 'left', 'up'] as const;

/** Four cardinal facings, including when aiming at an off-axis resource.
 * Equal components resolve vertically; invalid/zero vectors keep the last facing. */
export function facingDirection(x: number, y: number, fallback: Direction = 'down'): Direction {
  if ((!x && !y) || !Number.isFinite(x) || !Number.isFinite(y)) return fallback;
  if (Math.abs(x) > Math.abs(y)) return x < 0 ? 'left' : 'right';
  return y < 0 ? 'up' : 'down';
}

const KEY_VECTORS = new Map<string, Point>([
  ['w', { x: 0, y: -1 }],
  ['arrowup', { x: 0, y: -1 }],
  ['s', { x: 0, y: 1 }],
  ['arrowdown', { x: 0, y: 1 }],
  ['a', { x: -1, y: 0 }],
  ['arrowleft', { x: -1, y: 0 }],
  ['d', { x: 1, y: 0 }],
  ['arrowright', { x: 1, y: 0 }],
]);

/** Keys are ordered by their most recent owner. The last held direction wins;
 * releasing it restores the previous one without ever summing two axes. */
export function movementVector(keys: ReadonlySet<string>): Point {
  let movement = { x: 0, y: 0 };
  for (const key of keys) movement = KEY_VECTORS.get(key) ?? movement;
  return { ...movement };
}

// Cells 1/5 lift the coat without the supporting boot. Cells 3/7 retain the same
// complete head/torso registration and connected boots. Select only existing pixels.
export const STABLE_WALK_FRAMES = [0, 3, 4, 7] as const;
export function locomotionFrame(distance: number, reducedMotion = false) {
  if (reducedMotion || !Number.isFinite(distance)) return 0;
  return STABLE_WALK_FRAMES[Math.floor(Math.max(0, distance) / 9) % STABLE_WALK_FRAMES.length];
}

/** Move along only one axis, even if a caller supplies a mixed vector. Substeps
 * prevent tunnelling; a blocked direction stops instead of sliding diagonally. */
export function moveWithCollision(
  start: Point,
  dx: number,
  dy: number,
  blocked: (point: Point) => boolean,
): Point {
  const position = { ...start };
  if (![dx, dy].every(Number.isFinite)) return position;
  if (Math.abs(dx) > Math.abs(dy)) dy = 0;
  else dx = 0;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 2));
  const sx = dx / steps,
    sy = dy / steps;
  for (let step = 0; step < steps; step++) {
    const next = { x: position.x + sx, y: position.y + sy };
    if (blocked(next)) break;
    Object.assign(position, next);
  }
  return position;
}

export const DIRECTION_KEYS: Record<Direction, readonly string[]> = {
  right: ['d'],
  down: ['s'],
  left: ['a'],
  up: ['w'],
};
/** Normalized pad coordinates: center is 0, edges are ±1. A dead zone lets the
 * thumb rest; corners choose one cardinal axis, never a two-key diagonal. */
export function touchMovementKeys(x: number, y: number): readonly string[] {
  if (![x, y].every(Number.isFinite) || Math.hypot(x, y) < 0.22 || Math.max(Math.abs(x), Math.abs(y)) > 1.65)
    return [];
  return DIRECTION_KEYS[facingDirection(x, y)];
}

/** Independent ownership with chronological priority across keyboard and touch.
 * Key repeat and same-sector pointer moves must not steal the active direction. */
export class GameInput {
  private keyboard = new Map<string, number>();
  private pointers = new Map<number, { keys: readonly string[]; order: number }>();
  private order = 0;
  constructor(private readonly keys: Set<string>) {}
  key(key: string, pressed: boolean) {
    if (pressed) {
      if (this.keyboard.has(key)) return;
      this.keyboard.set(key, ++this.order);
    } else this.keyboard.delete(key);
    this.sync();
  }
  press(pointer: number, keys: readonly string[]) {
    const previous = this.pointers.get(pointer);
    if (previous?.keys.length === keys.length && previous.keys.every((key, index) => key === keys[index]))
      return;
    this.pointers.set(pointer, { keys: [...keys], order: ++this.order });
    this.sync();
  }
  owns(pointer: number) {
    return this.pointers.has(pointer);
  }
  release(pointer: number) {
    this.pointers.delete(pointer);
    this.sync();
  }
  clear() {
    this.keyboard.clear();
    this.pointers.clear();
    this.order = 0;
    this.sync();
  }
  private sync() {
    const held = new Map(this.keyboard);
    for (const { keys, order } of this.pointers.values())
      for (const key of keys) held.set(key, Math.max(held.get(key) ?? 0, order));
    this.keys.clear();
    for (const [key] of [...held].sort((a, b) => a[1] - b[1])) this.keys.add(key);
  }
}
