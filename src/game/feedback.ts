import { artImages } from './animation';
import { wrap } from './atmosphere';
import type { Simulation } from './simulation';
import type { Point, Settings } from './types';

export const MAX_FOOTPRINTS = 24;
export function impactStrength(age: number): number {
  if (!Number.isFinite(age) || age < 0 || age >= 0.22) return 0;
  return (1 - age / 0.22) ** 2;
}
export const feedbackEnabled = (settings: Settings) => settings.atmosphere && !settings.reducedMotion;
interface Footprint extends Point {
  time: number;
  wet: boolean;
  side: number;
}

/** Render-only feedback. All lifetimes use simulation time; nothing is added to saves. */
export class ForestFeedback {
  private tracks: Footprint[] = [];
  private previousTime = -1;
  private lastStep = -1;
  private side = 1;
  get footprintCount() {
    return this.tracks.length;
  }

  update(sim: Simulation, settings: Settings) {
    const time = sim.state.time;
    if (!feedbackEnabled(settings) || time < this.previousTime) {
      this.tracks = [];
      this.lastStep = time;
    }
    if (!feedbackEnabled(settings) || time === this.previousTime) {
      this.previousTime = time;
      return;
    }
    this.previousTime = time;
    this.tracks = this.tracks.filter((track) => time - track.time < 0.8);
    if (sim.moving && time - this.lastStep >= (sim.sprinting ? 0.12 : 0.21)) {
      this.lastStep = time;
      this.side *= -1;
      this.tracks.push({
        x: sim.state.player.x + this.side * 2,
        y: sim.state.player.y + 3,
        time,
        wet: sim.state.weather === 'rain' || sim.state.weather === 'storm',
        side: this.side,
      });
      if (this.tracks.length > MAX_FOOTPRINTS) this.tracks.shift();
    }
  }

  ground(
    ctx: CanvasRenderingContext2D,
    sim: Simulation,
    camera: Point,
    width: number,
    height: number,
    settings: Settings,
  ) {
    if (!feedbackEnabled(settings)) return;
    ctx.save();
    for (const track of this.tracks) {
      const age = sim.state.time - track.time;
      ctx.globalAlpha = Math.max(0, 1 - age / 0.8) * 0.38;
      ctx.fillStyle = track.wet ? '#b0d1c4' : '#c6b681';
      for (let i = 0; i < 3; i++) {
        const spread = age * (track.wet ? 9 : 5);
        ctx.fillRect(
          Math.round(track.x + (i - 1) * spread),
          Math.round(track.y - age * 6 + (i % 2) * 2),
          i === 1 ? 2 : 1,
          1,
        );
      }
    }
    if (sim.state.weather === 'rain' || sim.state.weather === 'storm') {
      const count = Math.min(42, Math.max(14, Math.floor((width * height) / 7000)));
      for (let i = 0; i < count; i++) {
        const phase = wrap(sim.state.time * 1.8 + i * 0.618, 1);
        if (phase > 0.26) continue;
        const x = Math.round(camera.x + wrap(i * 113 + 35, width));
        const y = Math.round(camera.y + wrap(i * 79 + 21, height));
        const spread = 1 + Math.floor(phase * 13);
        ctx.globalAlpha = (1 - phase / 0.26) * 0.35;
        ctx.fillStyle = '#c4d9cb';
        ctx.fillRect(x - spread, y, 2, 1);
        ctx.fillRect(x + spread, y, 2, 1);
        ctx.fillRect(x, y - 2 + Math.floor(phase * 7), 1, 1);
      }
    }
    ctx.restore();
  }

  private sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
    const image = artImages['effect-impactStar'];
    if (!image?.complete || !image.naturalWidth) return;
    ctx.drawImage(image, Math.round(x - size / 2), Math.round(y - size / 2), size, size);
  }

  air(
    ctx: CanvasRenderingContext2D,
    sim: Simulation,
    camera: Point,
    width: number,
    height: number,
    settings: Settings,
  ) {
    const counts = { embers: 0, impacts: 0 };
    if (!feedbackEnabled(settings)) return counts;
    const time = sim.state.time;
    const visible = (p: Point) =>
      p.x > camera.x - 40 &&
      p.x < camera.x + width + 40 &&
      p.y > camera.y - 20 &&
      p.y < camera.y + height + 70;
    ctx.save();
    for (const fire of sim.state.fires) {
      if (fire.fuel <= 0 || !visible(fire)) continue;
      for (let i = 0; i < 5; i++) {
        const phase = wrap(time * 0.17 + i * 0.21 + fire.id * 0.37, 1);
        const size = 3 + Math.floor(phase * 8);
        const x = Math.round(fire.x + Math.sin(phase * 5 + i) * 6);
        const y = Math.round(fire.y - 22 - phase * 48);
        ctx.globalAlpha = (1 - phase) * 0.11;
        ctx.fillStyle = sim.night ? '#b4b6a0' : '#6f7967';
        ctx.fillRect(x - size / 2, y, size, size - 1);
        ctx.fillRect(x - size / 2 - 2, y + 2, size + 2, Math.max(1, size - 4));
      }
      const rain = sim.state.weather === 'rain' || sim.state.weather === 'storm';
      for (let i = 0; i < (rain ? 3 : 7); i++) {
        const phase = wrap(time * 0.45 + i * 0.143 + fire.id * 0.17, 1);
        ctx.globalAlpha = (1 - phase) * 0.85;
        this.sparkle(
          ctx,
          fire.x + Math.sin(phase * 5 + i) * 9,
          fire.y - 18 - phase * 43,
          i % 3 === 0 ? 4 : 3,
        );
        counts.embers++;
      }
    }
    for (const [id, event] of sim.resourceAnimations) {
      if (!['hit', 'fell', 'break'].includes(event.kind)) continue;
      const age = time - event.startedAt,
        strength = impactStrength(age);
      if (!strength) continue;
      const resource = sim.state.resources.find((resource) => resource.id === id);
      if (!resource || !visible(resource)) continue;
      ctx.globalAlpha = strength * 0.88;
      this.sparkle(ctx, resource.x, resource.y - 8, Math.round(10 + age * 38));
      counts.impacts++;
    }
    if (sim.state.weather === 'cold') {
      const phase = wrap(time * 0.4, 1);
      if (phase < 0.45) {
        const p = sim.state.player,
          sign = sim.state.facing;
        ctx.globalAlpha = (1 - phase / 0.45) * 0.3;
        ctx.fillStyle = '#c6d9ce';
        ctx.fillRect(
          Math.round(p.x + sign * (5 + phase * 10)),
          Math.round(p.y - 29 - phase * 6),
          3 + Math.floor(phase * 7),
          2,
        );
      }
    }
    ctx.restore();
    return counts;
  }

  screen(
    ctx: CanvasRenderingContext2D,
    sim: Simulation,
    camera: Point,
    width: number,
    height: number,
    settings: Settings,
  ) {
    if (!settings.atmosphere && !(settings.damageFlash && !settings.reducedMotion && sim.hitFlash > 0))
      return;
    ctx.save();
    // A held torch adds warm visibility; reduced motion removes its flicker, not its light.
    if (settings.atmosphere && sim.torchActive) {
      const p = sim.state.player,
        x = p.x - camera.x,
        y = p.y - camera.y - 18;
      const radius = 48 + (settings.reducedMotion ? 0 : Math.sin(sim.state.time * 4) * 1.5);
      const glow = ctx.createRadialGradient(x, y, 2, x, y, radius);
      glow.addColorStop(0, '#f3bd7736');
      glow.addColorStop(1, '#f3bd7700');
      ctx.fillStyle = glow;
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    if (settings.damageFlash && !settings.reducedMotion && sim.hitFlash > 0) {
      ctx.globalAlpha = Math.min(0.2, sim.hitFlash * 0.45);
      ctx.fillStyle = '#cd715a';
      ctx.fillRect(0, 0, width, 3);
      ctx.fillRect(0, height - 3, width, 3);
      ctx.fillRect(0, 0, 3, height);
      ctx.fillRect(width - 3, 0, 3, height);
    }
    if (settings.atmosphere && sim.state.weather === 'cold' && sim.state.needs.warmth < 40) {
      ctx.globalAlpha = 0.12 + (40 - sim.state.needs.warmth) / 200;
      ctx.fillStyle = '#c0d7ce';
      for (const x of [0, width - 1])
        for (let i = 0; i < 6; i++) ctx.fillRect(x === 0 ? 0 : width - 2 - i, height - 2 - i * 4, 2 + i, 2);
    }
    ctx.restore();
  }
}
