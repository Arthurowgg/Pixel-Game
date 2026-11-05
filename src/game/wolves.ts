import { clamp, distance, WORLD } from './data';
import type { GameState, Point, Wolf } from './types';

export type WolfPhase = 'stalk' | 'circle' | 'windup' | 'lunge' | 'recover' | 'retreat' | 'hurt';
export interface WolfMind {
  phase: WolfPhase;
  startedAt: number;
  target: Point;
  flip: boolean;
  gait: number;
  moving: boolean;
  bitten: boolean;
  hitAt: number;
}
export interface FallenWolf extends Point {
  id: number;
  startedAt: number;
  flip: boolean;
}
export const WOLF_WINDUP = 0.55;
export const WOLF_LUNGE = 0.32;
export const WOLF_RECOVERY = 0.85;
export const WOLF_FADE = 1.25;
export const WOLF_SPACING = 28;
const TAU = Math.PI * 2;
const unit = (x: number, y: number) => {
  const length = Math.hypot(x, y);
  return length > 0.00001 ? { x: x / length, y: y / length } : { x: 0, y: 0 };
};

/** Runtime-only intent and feedback. Saves contain living wolves, never a
 * half-finished bite or a defeated sprite that can award its kill twice. */
export class WolfPack {
  minds = new Map<number, WolfMind>();
  fallen: FallenWolf[] = [];
  private nextAttack = 0;
  private lastAttacker = -1;
  mind(wolf: Wolf, player: Point, time: number) {
    let mind = this.minds.get(wolf.id);
    if (!mind) {
      mind = {
        phase: 'stalk',
        startedAt: time,
        target: { ...player },
        flip: wolf.x < player.x,
        gait: 0,
        moving: false,
        bitten: false,
        hitAt: -100,
      };
      this.minds.set(wolf.id, mind);
    }
    return mind;
  }
  private phase(mind: WolfMind, phase: WolfPhase, now: number) {
    if (mind.phase !== phase) {
      mind.phase = phase;
      mind.startedAt = now;
    }
  }
  hit(
    wolf: Wolf,
    player: Point,
    now: number,
    blocked: (point: Point) => boolean,
    others: readonly Wolf[] = [],
  ) {
    if (this.fallen.some((fallen) => fallen.id === wolf.id)) return;
    const mind = this.mind(wolf, player, now);
    mind.hitAt = now;
    this.phase(mind, 'hurt', now);
    mind.startedAt = now;
    wolf.cooldown = Math.max(wolf.cooldown, 1.15);
    wolf.scared = 0.65;
    const away = unit(wolf.x - player.x, wolf.y - player.y);
    const next = { x: wolf.x + away.x * 7, y: wolf.y + away.y * 7 };
    const flip = mind.flip;
    this.move(wolf, mind, next, 7, 1, others, blocked, true);
    mind.flip = flip;
    mind.moving = false;
    if (wolf.hp <= 0) {
      this.fallen.push({ id: wolf.id, x: wolf.x, y: wolf.y, startedAt: now, flip: mind.flip });
      this.minds.delete(wolf.id);
    }
  }
  private move(
    wolf: Wolf,
    mind: WolfMind,
    toward: Point,
    speed: number,
    dt: number,
    others: readonly Wolf[],
    blocked: (point: Point) => boolean,
    direct = false,
  ) {
    const remaining = distance(wolf, toward);
    let separation = 0;
    let desired = unit(toward.x - wolf.x, toward.y - wolf.y);
    if (!direct) {
      for (const other of others) {
        if (other === wolf || other.hp <= 0) continue;
        const gap = distance(wolf, other);
        if (gap >= 36) continue;
        const angle = ((wolf.id < other.id ? 1 : -1) * Math.PI) / 2 + Math.min(wolf.id, other.id) * 2.399;
        const away =
          gap < 0.01 ? { x: Math.cos(angle), y: Math.sin(angle) } : unit(wolf.x - other.x, wolf.y - other.y);
        const force = (1 - gap / 36) * 2.2;
        separation += force;
        desired.x += away.x * force;
        desired.y += away.y * force;
      }
      desired = unit(desired.x, desired.y);
    }
    // Ease into an orbit slot rather than overshooting it each frame, while
    // still letting separation push overlapping wolves apart at zero goal gap.
    const amount = direct
      ? Math.min(speed * dt, remaining)
      : Math.min(speed * dt, (remaining + separation * 8) * 4 * dt);
    const steps = Math.max(1, Math.ceil(amount / 2));
    const heading = Math.atan2(desired.y, desired.x);
    if (!desired.x && !desired.y) return;
    const before = { x: wolf.x, y: wolf.y };
    for (let i = 0; i < steps; i++) {
      // An older save (or a newly placed fire) can overlap a collision shape.
      // Allow walking out of that overlap, but never re-enter once clear.
      const escaping = blocked(wolf);
      // Prefer the real route; try tangents rather than piling into a trunk.
      const side = wolf.id % 2 ? 1 : -1;
      const turns = direct ? [0] : [0, side * 0.55, -side * 0.55, side * 1.15, -side * 1.15, side * 1.8];
      const next = turns
        .map((turn) => ({
          x: wolf.x + (Math.cos(heading + turn) * amount) / steps,
          y: wolf.y + (Math.sin(heading + turn) * amount) / steps,
        }))
        .find(
          (point) =>
            (!blocked(point) || escaping) &&
            others.every((other) => {
              if (other === wolf || other.hp <= 0) return true;
              const oldGap = distance(wolf, other),
                gap = distance(point, other);
              return gap >= WOLF_SPACING || (oldGap < WOLF_SPACING && gap > oldGap);
            }),
        );
      if (!next) break;
      Object.assign(wolf, next);
    }
    const travelled = distance(before, wolf);
    mind.gait += travelled;
    mind.moving = travelled > 0.001;
    if (Math.abs(wolf.x - before.x) > 0.01) mind.flip = wolf.x > before.x;
  }
  update(
    state: GameState,
    dt: number,
    torch: boolean,
    blocked: (point: Point) => boolean,
    bite: (wolf: Wolf) => void,
  ) {
    if (dt <= 0 || !Number.isFinite(dt)) return;
    const now = state.time,
      player = state.player;
    this.fallen = this.fallen.filter((wolf) => now - wolf.startedAt < WOLF_FADE);
    const live = state.wolves.filter((wolf) => wolf.hp > 0).sort((a, b) => a.id - b.id);
    const ids = new Set(live.map((wolf) => wolf.id));
    for (const id of this.minds.keys()) if (!ids.has(id)) this.minds.delete(id);
    for (const wolf of live) this.mind(wolf, player, now);
    const protectedFire = state.fires.find(
      (fire) => fire.fuel > 0 && distance(fire, player) < 40 + Math.min(60, fire.fuel) * 0.7,
    );
    const protectedPlayer = !!protectedFire || torch || state.weather !== 'wolves';
    const active = [...this.minds.values()].some((mind) => mind.phase === 'windup' || mind.phase === 'lunge');
    const candidate =
      !protectedPlayer && !active && now >= this.nextAttack
        ? live
            .filter(
              (wolf) =>
                wolf.cooldown <= 0 &&
                wolf.scared <= 0 &&
                distance(wolf, player) < 70 &&
                !blocked(wolf) &&
                !['hurt', 'recover'].includes(this.minds.get(wolf.id)!.phase),
            )
            .sort(
              (a, b) =>
                distance(a, player) +
                (a.id === this.lastAttacker ? 30 : 0) -
                distance(b, player) -
                (b.id === this.lastAttacker ? 30 : 0),
            )[0]
        : null;
    for (const [index, wolf] of live.entries()) {
      wolf.cooldown = Math.max(0, wolf.cooldown - dt);
      wolf.scared = Math.max(0, wolf.scared - dt);
      const mind = this.minds.get(wolf.id)!;
      const age = now - mind.startedAt;
      mind.moving = false;
      if (mind.phase === 'hurt' && age < 0.38) continue;
      if (protectedPlayer || wolf.scared > 0) {
        this.phase(mind, 'retreat', now);
        const center = protectedFire ?? player;
        const angle = Math.atan2(wolf.y - center.y, wolf.x - center.x) + (wolf.id % 2 ? 1 : -1) * 0.3;
        const radius = state.weather !== 'wolves' ? 235 : protectedPlayer ? 130 : 88;
        const target = {
          x: clamp(center.x + Math.cos(angle) * radius, 24, WORLD.width - 24),
          y: clamp(center.y + Math.sin(angle) * radius, 32, WORLD.height - 24),
        };
        this.move(wolf, mind, target, 31, dt, live, blocked);
        continue;
      }
      if (mind.phase === 'windup') {
        // Lock the landing point at the warning, so a moving survivor can dodge.
        mind.flip = mind.target.x > wolf.x;
        if (age >= WOLF_WINDUP) this.phase(mind, 'lunge', now);
        continue;
      }
      if (mind.phase === 'lunge') {
        this.move(wolf, mind, mind.target, 225, dt, live, blocked, true);
        if (!mind.bitten && distance(wolf, player) < 19) {
          mind.bitten = true;
          bite(wolf);
        }
        if (mind.bitten || age >= WOLF_LUNGE || distance(wolf, mind.target) < 2) {
          this.phase(mind, 'recover', now);
          wolf.cooldown = state.difficulty === 'wild' ? 1.15 : 1.8;
          this.nextAttack = now + WOLF_RECOVERY;
        }
        continue;
      }
      if (mind.phase === 'recover' && age < WOLF_RECOVERY) {
        const away = unit(wolf.x - player.x, wolf.y - player.y);
        this.move(wolf, mind, { x: wolf.x + away.x * 15, y: wolf.y + away.y * 15 }, 12, dt, live, blocked);
        continue;
      }
      if (wolf === candidate) {
        this.phase(mind, 'windup', now);
        mind.target = { ...player };
        mind.bitten = false;
        this.lastAttacker = wolf.id;
        continue;
      }
      // Distinct, slowly orbiting approach slots and separation keep a pack spread.
      const angle = (index * TAU) / Math.max(1, live.length) + now * 0.12;
      const radius = 57 + (index % 2) * 13;
      const target = { x: player.x + Math.cos(angle) * radius, y: player.y + Math.sin(angle) * radius };
      this.phase(mind, distance(wolf, player) > 105 ? 'stalk' : 'circle', now);
      this.move(wolf, mind, target, mind.phase === 'stalk' ? 31 : 25, dt, live, blocked);
    }
  }
}
