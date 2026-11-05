import { clamp } from './data';
import { darknessAt } from './climate';
import type { GameState, Point } from './types';
import type { Simulation } from './simulation';

export const TORCH_LIGHT_RADIUS = 90;
export interface WorldLight extends Point {
  radius: number;
  strength: number;
  source: 'fire' | 'torch' | 'near';
}
/** Core visibility is independent of decorative atmosphere, motion and vignette. */
export function worldLights(state: GameState, torchActive: boolean): WorldLight[] {
  const lights: WorldLight[] = state.fires
    .filter((fire) => fire.fuel > 0)
    .map((fire) => ({
      x: fire.x,
      y: fire.y - 8,
      radius: 78 + Math.sqrt(clamp(fire.fuel, 0, 80) / 80) * 50,
      strength: 0.98,
      source: 'fire',
    }));
  lights.push(
    torchActive
      ? {
          x: state.player.x,
          y: state.player.y - 15,
          radius: TORCH_LIGHT_RADIUS,
          strength: 0.98,
          source: 'torch',
        }
      : { x: state.player.x, y: state.player.y - 12, radius: 20, strength: 0.25, source: 'near' },
  );
  return lights;
}
export class ForestLighting {
  private layer = document.createElement('canvas');
  draw(ctx: CanvasRenderingContext2D, sim: Simulation, camera: Point, width: number, height: number) {
    const darkness = darknessAt(sim.state.time, sim.weatherMix);
    if (darkness < 0.001 || width <= 0 || height <= 0) return darkness;
    if (this.layer.width !== width || this.layer.height !== height) {
      this.layer.width = width;
      this.layer.height = height;
    }
    const mask = this.layer.getContext('2d');
    if (!mask) return darkness;
    mask.globalAlpha = 1;
    mask.globalCompositeOperation = 'source-over';
    mask.clearRect(0, 0, width, height);
    mask.fillStyle = `rgba(5, 12, 19, ${darkness})`;
    mask.fillRect(0, 0, width, height);
    mask.globalCompositeOperation = 'destination-out';
    for (const light of worldLights(sim.state, sim.torchActive)) {
      const x = light.x - camera.x,
        y = light.y - camera.y,
        radius = light.radius;
      if (x < -radius || x > width + radius || y < -radius || y > height + radius) continue;
      const gradient = mask.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, `rgba(0, 0, 0, ${light.strength})`);
      gradient.addColorStop(0.3, `rgba(0, 0, 0, ${light.strength * 0.98})`);
      gradient.addColorStop(0.65, `rgba(0, 0, 0, ${light.strength * 0.65})`);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      mask.fillStyle = gradient;
      mask.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    mask.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.layer, 0, 0);
    return darkness;
  }
}
