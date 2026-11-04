import { CAMP, POND, WORLD, distance, random } from './data';
import { drawAnimation } from './animation';
import type { Simulation } from './simulation';
import type { Point, Settings, Weather } from './types';

/** Clear daylight only: moonlight, cold fog, and storms never produce sunbeams. */
export function sunlightStrength(hour: number, weather: Weather): number {
  if (weather !== 'clear' || hour <= 6 || hour >= 19) return 0;
  return Math.max(0, Math.sin(((hour - 6) / 13) * Math.PI));
}
export const wrap = (value: number, range: number) => ((value % range) + range) % range;

/** Sparse, deterministic pixel clusters. Decorative only; never change collisions or saves. */
export function addTerrainDetail(ctx: CanvasRenderingContext2D, seed: number) {
  const rng = random(seed + 841);
  ctx.save();
  for (let i = 0; i < 4100; i++) {
    const x = Math.floor(rng() * WORLD.width),
      y = Math.floor(rng() * WORLD.height);
    const trailY = 760 + Math.sin(x / 175) * 30;
    if (Math.abs(y - trailY) < 27 || distance({ x, y }, CAMP) < 97) continue;
    // Broken pine needles, moss, and dry leaf litter—not a repeated noise filter.
    const kind = rng();
    ctx.fillStyle = kind < 0.4 ? '#304b3380' : kind < 0.78 ? '#9a986043' : '#667f4c85';
    ctx.fillRect(x, y, 3, 1);
    ctx.fillRect(x + 2, y + 1, 1, 2);
    if (kind > 0.8) {
      ctx.fillRect(x - 2, y + 2, 2, 1);
      ctx.fillStyle = '#82935d80';
      ctx.fillRect(x + 1, y, 1, 1);
    }
  }
  for (let x = 12; x < WORLD.width; x += 11) {
    const y = Math.round(760 + Math.sin(x / 175) * 30 + (rng() - 0.5) * 31);
    ctx.fillStyle = rng() > 0.4 ? '#39493238' : '#ac9e6b54';
    ctx.fillRect(x, y, 2 + Math.floor(rng() * 4), 1);
    if (rng() > 0.75) ctx.fillRect(x + 2, y - 1, 2, 1);
  }
  ctx.restore();
}

export class ForestAtmosphere {
  private beams: { x: number; width: number; strength: number; phase: number }[];
  constructor(seed: number) {
    const rng = random(seed + 661);
    this.beams = Array.from({ length: 23 }, (_, i) => ({
      x: i * 103 - 500 + rng() * 51,
      width: 14 + rng() * 26,
      strength: 0.65 + rng() * 0.35,
      phase: rng() * Math.PI * 2,
    }));
  }
  ground(
    ctx: CanvasRenderingContext2D,
    sim: Simulation,
    camera: Point,
    w: number,
    h: number,
    settings: Settings,
  ) {
    if (!settings.atmosphere) return;
    const strength = sunlightStrength(sim.hour, sim.state.weather);
    const time = settings.reducedMotion ? 0 : sim.state.time;
    if (strength > 0) {
      ctx.save();
      ctx.fillStyle = '#142c22';
      ctx.globalAlpha = 0.11 * strength;
      for (const tree of sim.state.resources) {
        if (
          tree.kind !== 'tree' ||
          tree.hp <= 0 ||
          tree.x < camera.x - 85 ||
          tree.x > camera.x + w + 30 ||
          tree.y < camera.y - 50 ||
          tree.y > camera.y + h + 20
        )
          continue;
        const x = Math.round(tree.x),
          y = Math.round(tree.y),
          scale = tree.scale;
        ctx.beginPath();
        ctx.moveTo(x - 4, y + 1);
        ctx.lineTo(x + 18 * scale, y + 8 * scale);
        ctx.lineTo(x + 56 * scale, y + 13 * scale);
        ctx.lineTo(x + 46 * scale, y + 27 * scale);
        ctx.lineTo(x + 24 * scale, y + 24 * scale);
        ctx.lineTo(x + 5, y + 5);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
    // These are sliced from the literal ripple sheet, including its second row.
    ctx.save();
    ctx.globalAlpha = 0.55;
    for (let i = 0; i < 11; i++) {
      const x = POND.x - 70 + ((i * 43) % 141),
        y = POND.y - 34 + ((i * 29) % 69);
      drawAnimation(ctx, 'pond-ring', x, y, time * 0.45 + i * 0.17, {
        reducedMotion: settings.reducedMotion,
      });
    }
    ctx.restore();
  }
  air(
    ctx: CanvasRenderingContext2D,
    sim: Simulation,
    camera: Point,
    w: number,
    h: number,
    settings: Settings,
  ) {
    if (!settings.atmosphere || settings.reducedMotion || sim.state.weather !== 'clear') return;
    const time = sim.state.time;
    ctx.save();
    ctx.globalAlpha = 0.48;
    for (let i = 0; i < 9; i++) {
      const x = camera.x + wrap(i * 149 + time * (2.2 + (i % 3)) - camera.x * 0.4, w + 30) - 15;
      const y =
        camera.y + wrap(i * 73 + time * 3.1 + Math.sin(time * 0.35 + i) * 9 - camera.y * 0.3, h + 30) - 15;
      drawAnimation(ctx, 'leaf-drift', x, y, time + i * 0.24, { scale: i % 3 === 0 ? 1 : 0.75 });
    }
    ctx.restore();
  }
  light(
    ctx: CanvasRenderingContext2D,
    sim: Simulation,
    camera: Point,
    w: number,
    h: number,
    settings: Settings,
  ) {
    if (!settings.atmosphere) return;
    const strength = sunlightStrength(sim.hour, sim.state.weather);
    const time = settings.reducedMotion ? 0 : sim.state.time;
    if (strength > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const gradient = ctx.createLinearGradient(0, 0, 0, h);
      gradient.addColorStop(0, '#e6d399');
      gradient.addColorStop(0.4, '#bfbb7b');
      gradient.addColorStop(1, '#8f9d6300');
      ctx.fillStyle = gradient;
      for (const beam of this.beams) {
        const drift = Math.sin(time * 0.12 + beam.phase) * 5;
        const x = Math.round(beam.x + camera.y * 0.38 - camera.x + drift);
        if (x > w + 80 || x + h * 0.38 < -80) continue;
        for (const [spread, opacity] of [
          [1.8, 0.025],
          [1, 0.065],
          [0.35, 0.035],
        ]) {
          const width = Math.round(beam.width * spread);
          ctx.globalAlpha = strength * beam.strength * opacity;
          ctx.beginPath();
          ctx.moveTo(x - width / 2, -4);
          ctx.lineTo(x + width / 2, -4);
          ctx.lineTo(Math.round(x + h * 0.38 + width), h);
          ctx.lineTo(Math.round(x + h * 0.38 - width), h);
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.restore();
    }
    if (sim.state.weather === 'cold') {
      ctx.save();
      const mist = ctx.createLinearGradient(0, h * 0.4, 0, h);
      mist.addColorStop(0, '#b6c7bf00');
      mist.addColorStop(1, '#a5bdb224');
      ctx.fillStyle = mist;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }
}
