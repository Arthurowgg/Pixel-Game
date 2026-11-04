import type { Direction, Point } from './types';

export const DIRECTIONS = [
  'right',
  'down-right',
  'down',
  'down-left',
  'left',
  'up-left',
  'up',
  'up-right',
] as const;

/** Eight equal sectors; diagonal controls never multiply movement speed. */
export function facingDirection(x: number, y: number, fallback: Direction = 'down'): Direction {
  if ((!x && !y) || !Number.isFinite(x) || !Number.isFinite(y)) return fallback;
  return DIRECTIONS[(Math.round(Math.atan2(y, x) / (Math.PI / 4)) + 8) % 8];
}

/** Diagonals toward/away from the viewer use intact front/back art, mirrored as a
 * whole for westward travel. Never show a sideways face when walking away. */
export function spriteDirection(direction: Direction): 'up' | 'down' | 'left' | 'right' {
  if (direction.startsWith('up')) return 'up';
  if (direction.startsWith('down')) return 'down';
  return direction as 'left' | 'right';
}

// Cells 1/5 lift the coat without the supporting boot. Cells 3/7 retain the same
// complete head/torso registration and connected boots. Select only existing pixels.
export const STABLE_WALK_FRAMES = [0, 3, 4, 7] as const;
export function locomotionFrame(distance: number, reducedMotion = false) {
  if (reducedMotion || !Number.isFinite(distance)) return 0;
  return STABLE_WALK_FRAMES[Math.floor(Math.max(0, distance) / 9) % STABLE_WALK_FRAMES.length];
}

/** Test the intended diagonal first; then slide along an unblocked axis. Small
 * substeps prevent tunnelling and remove the old unconditional X-first corner snag. */
export function moveWithCollision(
  start: Point,
  dx: number,
  dy: number,
  blocked: (point: Point) => boolean,
): Point {
  const position = { ...start };
  if (![dx, dy].every(Number.isFinite)) return position;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 2));
  const sx = dx / steps,
    sy = dy / steps;
  for (let step = 0; step < steps; step++) {
    const next = { x: position.x + sx, y: position.y + sy };
    if (!blocked(next)) Object.assign(position, next);
    else {
      const horizontal = { x: position.x + sx, y: position.y };
      const vertical = { x: position.x, y: position.y + sy };
      const choices = Math.abs(sx) >= Math.abs(sy) ? [horizontal, vertical] : [vertical, horizontal];
      const slide = choices.find((point) => !blocked(point));
      if (slide) Object.assign(position, slide);
    }
  }
  return position;
}

export const DIRECTION_KEYS: Record<Direction, readonly string[]> = {
  right: ['d'],
  'down-right': ['s', 'd'],
  down: ['s'],
  'down-left': ['s', 'a'],
  left: ['a'],
  'up-left': ['w', 'a'],
  up: ['w'],
  'up-right': ['w', 'd'],
};
/** Normalized pad coordinates: center is 0, edges are ±1. A dead zone lets the
 * thumb rest; dragging off the pad releases movement without dropping capture. */
export function touchMovementKeys(x: number, y: number): readonly string[] {
  if (![x, y].every(Number.isFinite) || Math.hypot(x, y) < 0.22 || Math.max(Math.abs(x), Math.abs(y)) > 1.65)
    return [];
  return DIRECTION_KEYS[facingDirection(x, y)];
}

/** Multiple touch pointers and a keyboard may own the same key independently. */
export class GameInput {
  private keyboard = new Set<string>();
  private pointers = new Map<number, readonly string[]>();
  constructor(private readonly keys: Set<string>) {}
  key(key: string, pressed: boolean) {
    if (pressed) this.keyboard.add(key);
    else this.keyboard.delete(key);
    this.sync();
  }
  press(pointer: number, keys: readonly string[]) {
    this.pointers.set(pointer, keys);
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
    this.sync();
  }
  private sync() {
    this.keys.clear();
    for (const key of this.keyboard) this.keys.add(key);
    for (const keys of this.pointers.values()) for (const key of keys) this.keys.add(key);
  }
}
