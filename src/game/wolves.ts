import { CAMP, distance } from './data';
import type { Difficulty, GameState, Point, Wolf } from './types';

export type WolfPhase = 'wander' | 'stalk' | 'circle' | 'windup' | 'lunge' | 'recover' | 'retreat' | 'hurt';
export type WolfAttack = 'snap' | 'pounce';
export interface WolfMind {
  attack: WolfAttack;
  strikes: number;
  phase: WolfPhase;
  startedAt: number;
  target: Point;
  flip: boolean;
  gait: number;
  moving: boolean;
  bitten: boolean;
  hitAt: number;
  aware: boolean;
  heading: number;
  lastSeenAt: number;
  lastSeen: Point;
  roamTarget: Point;
  roamUntil: number;
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
export const WOLF_SPACING = 32;
export const WOLF_ATTACKS = {
  snap: {
    windup: WOLF_WINDUP,
    lunge: WOLF_LUNGE,
    recovery: WOLF_RECOVERY,
    speed: 245,
    damage: 12,
    reach: 19,
  },
  pounce: { windup: 0.8, lunge: 0.42, recovery: 1.05, speed: 290, damage: 18, reach: 20 },
} as const;
export const wolfHealth = (difficulty: Difficulty) =>
  difficulty === 'wild' ? 5 : difficulty === 'explorer' ? 3 : 4;
export const wolfMaxHealth = (wolf: Wolf) => wolf.maxHp ?? Math.max(2, wolf.hp);
export const STARTER_FIRE_SAFETY = 122;
export function protectedByFire(state: GameState) {
  return state.fires.some(
    (fire) =>
      fire.fuel > 0 &&
      distance(fire, state.player) <
        (distance(fire, CAMP) < 8 ? STARTER_FIRE_SAFETY : 40 + Math.min(60, fire.fuel) * 0.7),
  );
}
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
  mind(wolf: Wolf, _player: Point, time: number) {
    let mind = this.minds.get(wolf.id);
    if (!mind) {
      const heading = (wolf.id % 997) * 2.399 + 2.1;
      mind = {
        phase: 'wander',
        attack: 'snap',
        strikes: 0,
        startedAt: time,
        target: { x: wolf.x, y: wolf.y },
        flip: Math.cos(heading) > 0,
        aware: false,
        heading,
        lastSeenAt: -100,
        lastSeen: { x: wolf.x, y: wolf.y },
        roamTarget: {
          x: wolf.x + Math.cos(heading) * 190,
          y: wolf.y + Math.sin(heading) * 190,
        },
        roamUntil: time + 8 + (wolf.id % 4),
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
    mind.aware = true;
    mind.lastSeenAt = now;
    mind.lastSeen = { ...player };
    this.phase(mind, 'hurt', now);
    mind.startedAt = now;
    wolf.cooldown = Math.max(wolf.cooldown, 1.0);
    wolf.scared = 0.5;
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
    if (mind.moving) mind.heading = Math.atan2(wolf.y - before.y, wolf.x - before.x);
    if (Math.abs(wolf.x - before.x) > 0.01) mind.flip = wolf.x > before.x;
  }
  threats(state: GameState, torch: boolean, radius = 130) {
    if (torch || protectedByFire(state) || state.weather !== 'wolves') return [];
    return state.wolves.filter(
      (wolf) => wolf.hp > 0 && distance(wolf, state.player) < radius && this.minds.get(wolf.id)?.aware,
    );
  }
  private sees(wolf: Wolf, mind: WolfMind, player: Point, blocked: (point: Point) => boolean) {
    const gap = distance(wolf, player);
    if (gap > 112) return false;
    const toward = unit(player.x - wolf.x, player.y - wolf.y);
    if (gap > 84 && toward.x * Math.cos(mind.heading) + toward.y * Math.sin(mind.heading) < 0.15)
      return false;
    // Trunks, boulders, water and furniture break sight, not just movement.
    const steps = Math.ceil(gap / 7);
    for (let i = 1; i < steps; i++)
      if (
        blocked({
          x: wolf.x + ((player.x - wolf.x) * i) / steps,
          y: wolf.y + ((player.y - wolf.y) * i) / steps,
        })
      )
        return false;
    return true;
  }
  private wander(
    wolf: Wolf,
    mind: WolfMind,
    now: number,
    dt: number,
    live: Wolf[],
    blocked: (point: Point) => boolean,
  ) {
    this.phase(mind, 'wander', now);
    if (distance(wolf, mind.roamTarget) < 12 || now >= mind.roamUntil) {
      const heading = mind.heading + Math.sin(wolf.id * 1.7 + Math.floor(now / 8)) * 1.1;
      mind.roamTarget = {
        x: wolf.x + Math.cos(heading) * 210,
        y: wolf.y + Math.sin(heading) * 210,
      };
      mind.roamUntil = now + 8 + (wolf.id % 4);
    }
    this.move(wolf, mind, mind.roamTarget, 25, dt, live, blocked);
    if (!mind.moving) mind.roamUntil = Math.min(mind.roamUntil, now + 0.4);
  }
  update(
    state: GameState,
    dt: number,
    torch: boolean,
    blocked: (point: Point) => boolean,
    bite: (wolf: Wolf, attack: WolfAttack) => void,
  ) {
    if (dt <= 0 || !Number.isFinite(dt)) return;
    const now = state.time,
      player = state.player;
    this.fallen = this.fallen.filter((wolf) => now - wolf.startedAt < WOLF_FADE);
    const live = state.wolves.filter((wolf) => wolf.hp > 0).sort((a, b) => a.id - b.id);
    const ids = new Set(live.map((wolf) => wolf.id));
    for (const id of this.minds.keys()) if (!ids.has(id)) this.minds.delete(id);
    for (const wolf of live) this.mind(wolf, player, now);
    const protectedPlayer = protectedByFire(state) || torch || state.weather !== 'wolves';
    for (const wolf of live) {
      const mind = this.minds.get(wolf.id)!;
      if (protectedPlayer) {
        // Firelight breaks a hunt, but a wolf that never noticed the survivor
        // simply patrols past the clearing instead of orbiting the flames.
        const wasAware = mind.aware;
        mind.aware = false;
        if (wasAware && mind.phase !== 'hurt') this.phase(mind, 'retreat', now);
        else if (mind.phase !== 'hurt' && mind.phase !== 'retreat') this.phase(mind, 'wander', now);
      } else if (this.sees(wolf, mind, player, blocked)) {
        mind.aware = true;
        mind.lastSeenAt = now;
        mind.lastSeen = { ...player };
      } else if (now - mind.lastSeenAt > 3 || distance(wolf, player) > 210) {
        mind.aware = false;
      }
    }
    const active = [...this.minds.values()].some((mind) => mind.phase === 'windup' || mind.phase === 'lunge');
    const candidate =
      !protectedPlayer && !active && now >= this.nextAttack
        ? live
            .filter(
              (wolf) =>
                this.minds.get(wolf.id)!.aware &&
                now - this.minds.get(wolf.id)!.lastSeenAt < 0.35 &&
                wolf.cooldown <= 0 &&
                wolf.scared <= 0 &&
                distance(wolf, player) < 96 &&
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
      const attack = WOLF_ATTACKS[mind.attack];
      mind.moving = false;
      if (mind.phase === 'hurt' && age < 0.3) continue;
      // A newly lit hearth can surround a patrolling wolf. Step clear of the
      // flames even when it never saw the survivor, so it is never trapped.
      const hot = state.fires.find((fire) => fire.fuel > 0 && distance(wolf, fire) < 36);
      if (hot && mind.phase !== 'hurt') {
        this.phase(mind, 'retreat', now);
        const away = unit(wolf.x - hot.x, wolf.y - hot.y);
        this.move(wolf, mind, { x: wolf.x + away.x * 44, y: wolf.y + away.y * 44 }, 31, dt, live, blocked);
        continue;
      }
      if (mind.phase === 'retreat' && !protectedPlayer) {
        // Recovered from the light: go back to an ordinary patrol.
        if (distance(wolf, player) > 70) this.phase(mind, 'wander', now);
      }
      if (mind.phase === 'retreat') {
        const away = unit(wolf.x - player.x, wolf.y - player.y);
        this.move(wolf, mind, { x: wolf.x + away.x * 50, y: wolf.y + away.y * 50 }, 31, dt, live, blocked);
        continue;
      }
      if (protectedPlayer || !mind.aware) {
        this.wander(wolf, mind, now, dt, live, blocked);
        continue;
      }
      if (wolf.scared > 0) {
        this.phase(mind, 'retreat', now);
        const away = unit(wolf.x - player.x, wolf.y - player.y);
        this.move(wolf, mind, { x: wolf.x + away.x * 40, y: wolf.y + away.y * 40 }, 31, dt, live, blocked);
        continue;
      }
      if (mind.phase === 'windup') {
        // Lock the landing point at the warning, so a moving survivor can dodge.
        mind.flip = mind.target.x > wolf.x;
        if (age >= attack.windup) this.phase(mind, 'lunge', now);
        continue;
      }
      if (mind.phase === 'lunge') {
        this.move(wolf, mind, mind.target, attack.speed, dt, live, blocked, true);
        if (!mind.bitten && distance(wolf, player) < attack.reach) {
          mind.bitten = true;
          bite(wolf, mind.attack);
        }
        if (mind.bitten || age >= attack.lunge || distance(wolf, mind.target) < 2) {
          this.phase(mind, 'recover', now);
          wolf.cooldown = state.difficulty === 'wild' ? 0.95 : 1.45;
          this.nextAttack = now + attack.recovery * 0.85;
        }
        continue;
      }
      if (mind.phase === 'recover' && age < attack.recovery) {
        const away = unit(wolf.x - player.x, wolf.y - player.y);
        this.move(wolf, mind, { x: wolf.x + away.x * 15, y: wolf.y + away.y * 15 }, 22, dt, live, blocked);
        continue;
      }
      if (wolf === candidate) {
        mind.attack = distance(wolf, player) > 62 || mind.strikes % 3 === 2 ? 'pounce' : 'snap';
        mind.strikes++;
        this.phase(mind, 'windup', now);
        mind.target = { ...player };
        mind.bitten = false;
        this.lastAttacker = wolf.id;
        continue;
      }
      // Distinct, slowly orbiting approach slots and separation keep a pack spread.
      const angle = (index * TAU) / Math.max(1, live.length) + now * 0.12;
      const radius = 57 + (index % 2) * 13;
      const center = mind.lastSeen;
      const target =
        now - mind.lastSeenAt > 0.35
          ? center
          : { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius };
      this.phase(mind, distance(wolf, player) > 105 ? 'stalk' : 'circle', now);
      this.move(wolf, mind, target, mind.phase === 'stalk' ? 39 : 32, dt, live, blocked);
    }
  }
}
