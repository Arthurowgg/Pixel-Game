import { CAMP, POND, SPRING, WORLD, WORKBENCH, clamp, distance, random } from './data';
import type { GameState, Resource, Settings } from './types';
import {
  animationFrame,
  artImages,
  CLIPS,
  drawAnimation,
  drawCarriedTool,
  drawItem,
  playerPose,
  toolActionClip,
} from './animation';
export { loadArt } from './animation';
import type { Simulation } from './simulation';
import { addTerrainDetail, ForestAtmosphere, sunlightStrength } from './atmosphere';
import generatedAssets from './generated-assets.json';
import { ForestFeedback } from './feedback';

const pixelEllipse = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  color: string,
  step = 4,
) => {
  ctx.fillStyle = color;
  for (let py = -ry; py < ry; py += step) {
    const width = Math.floor((Math.sqrt(Math.max(0, 1 - (py / ry) ** 2)) * rx) / step) * step;
    ctx.fillRect(Math.floor(x - width), Math.floor(y + py), width * 2, step);
  }
};
export class Renderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  ground: HTMLCanvasElement;
  camera = { x: 0, y: 0 };
  width = 0;
  height = 0;
  settings: Settings;
  private rng: () => number;
  private atmosphere: ForestAtmosphere;
  private seed: number;
  private feedback = new ForestFeedback();
  constructor(canvas: HTMLCanvasElement, seed: number, settings: Settings) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.settings = settings;
    this.rng = random(seed + 47);
    this.seed = seed;
    this.atmosphere = new ForestAtmosphere(seed);
    this.ground = document.createElement('canvas');
    this.ground.width = WORLD.width;
    this.ground.height = WORLD.height;
    this.resize();
  }
  resize() {
    this.width = Math.ceil(this.canvas.clientWidth / 2);
    this.height = Math.ceil(this.canvas.clientHeight / 2);
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.ctx.imageSmoothingEnabled = false;
  }
  /** Bake the terrain after loadArt resolves, including its generated bitmap. */
  buildGround() {
    this.rng = random(this.seed + 47);
    const ctx = this.ground.getContext('2d')!;
    ctx.fillStyle = '#43553a';
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    const palette = ['#43563b', '#405338', '#46593c', '#495b3e', '#3e5239', '#41563b'];
    for (let y = 0; y < WORLD.height; y += 16)
      for (let x = 0; x < WORLD.width; x += 16) {
        const shade = Math.floor((Math.sin(x / 108 + Math.cos(y / 130)) + Math.cos(y / 80) + 2) * 1.25);
        ctx.fillStyle = palette[shade % palette.length];
        ctx.fillRect(x, y, 16, 16);
      }
    // An actual AI-generated, nearest-neighbor terrain tile—not synthesized noise.
    ctx.imageSmoothingEnabled = false;
    const texture = artImages['texture-forestFloor'];
    const pattern = texture?.naturalWidth ? ctx.createPattern(texture, 'repeat') : null;
    if (pattern) {
      ctx.save();
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, WORLD.width, WORLD.height);
      ctx.restore();
      this.canvas.dataset.groundTexture = 'generated';
    }
    // A meandering, stepped trail links the clearing and the eastern spring.
    for (let x = 0; x < WORLD.width; x += 4) {
      const y = Math.floor((760 + Math.sin(x / 175) * 30) / 4) * 4;
      ctx.fillStyle = '#5b6542';
      ctx.fillRect(x, y - 24, 4, 48);
      ctx.fillStyle = '#72744b';
      ctx.fillRect(x, y - 16, 4, 32);
      ctx.fillStyle = '#7b7950';
      ctx.fillRect(x, y - 10, 4, 20);
    }
    pixelEllipse(ctx, CAMP.x, CAMP.y + 28, 105, 88, '#566342');
    pixelEllipse(ctx, CAMP.x, CAMP.y + 28, 87, 73, '#686d47');
    pixelEllipse(ctx, CAMP.x, CAMP.y + 28, 68, 59, '#74744c');
    for (let i = 0; i < 3200; i++) {
      const x = Math.floor(this.rng() * WORLD.width),
        y = Math.floor(this.rng() * WORLD.height),
        n = this.rng();
      ctx.fillStyle = n > 0.55 ? '#85906419' : '#182e2222';
      ctx.fillRect(x, y, 2 + Math.floor(this.rng() * 4), 1 + Math.floor(this.rng() * 2));
      if (n > 0.93 && distance({ x, y }, CAMP) > 100) {
        ctx.fillStyle = '#71815a';
        ctx.fillRect(x, y - 3, 1, 4);
        ctx.fillRect(x + 2, y - 1, 1, 3);
        ctx.fillRect(x - 2, y - 1, 1, 2);
      }
      if (n > 0.996) {
        ctx.fillStyle = '#c0be80';
        ctx.fillRect(x, y, 2, 2);
      }
    }
    addTerrainDetail(ctx, this.seed);
    pixelEllipse(ctx, POND.x, POND.y, POND.rx + 16, POND.ry + 13, '#73806a');
    pixelEllipse(ctx, POND.x, POND.y, POND.rx + 9, POND.ry + 7, '#495e50');
    pixelEllipse(ctx, POND.x, POND.y, POND.rx, POND.ry, '#365e5c');
    pixelEllipse(ctx, POND.x + 10, POND.y, POND.rx - 17, POND.ry - 15, '#2d5355');
    for (let i = 0; i < 48; i++) {
      const angle = this.rng() * Math.PI * 2,
        x = POND.x + Math.cos(angle) * (POND.rx + 10),
        y = POND.y + Math.sin(angle) * (POND.ry + 6);
      ctx.fillStyle = '#87916a';
      ctx.fillRect(x, y - 6, 2, 9);
      ctx.fillStyle = '#a3a170';
      ctx.fillRect(x + 3, y - 9, 1, 11);
    }
    for (let i = 0; i < 8; i++) {
      const x = POND.x - 75 + this.rng() * 150,
        y = POND.y - 45 + this.rng() * 90;
      pixelEllipse(ctx, x, y, 5, 3, '#768653', 1);
      ctx.fillStyle = '#c4b986';
      ctx.fillRect(x, y - 1, 2, 2);
    }
    // Fallen logs and a worn camping rug give the starting clearing a little history.
    ctx.fillStyle = '#433f2e';
    ctx.fillRect(858, 752, 24, 10);
    ctx.fillRect(920, 754, 25, 10);
    ctx.fillStyle = '#7d6544';
    ctx.fillRect(858, 751, 24, 6);
    ctx.fillRect(920, 753, 25, 6);
    ctx.fillStyle = '#a28757';
    ctx.fillRect(858, 752, 4, 5);
    ctx.fillRect(941, 754, 4, 5);
    ctx.fillStyle = '#584f37';
    ctx.fillRect(871, 715, 22, 12);
    ctx.fillStyle = '#8f7d50';
    ctx.fillRect(871, 714, 22, 9);
    ctx.fillStyle = '#b19c6a';
    ctx.fillRect(875, 714, 3, 9);
    ctx.fillRect(887, 714, 3, 9);
    // Small bark breaks and frayed rug stitching keep the campsite from looking flat.
    ctx.fillStyle = '#56452f';
    for (const x of [864, 870, 877, 924, 932, 937]) ctx.fillRect(x, 754, 3, 1);
    ctx.fillStyle = '#cfb98088';
    for (let x = 873; x < 892; x += 4) {
      ctx.fillRect(x, 715, 1, 1);
      ctx.fillRect(x, 721, 1, 1);
    }
  }
  private shadow(x: number, y: number, width = 15) {
    pixelEllipse(this.ctx, x + 4, y + 2, width, 5, '#162a253e', 2);
  }
  private resource(resource: Resource, sim: Simulation) {
    const ctx = this.ctx,
      x = Math.round(resource.x),
      y = Math.round(resource.y);
    const animation = sim.resourceAnimations.get(resource.id);
    const age = animation ? sim.state.time - animation.startedAt : Infinity;
    const reducedMotion = this.settings.reducedMotion;
    const draw = (name: string, time: number, scale = 1) =>
      drawAnimation(ctx, name, x, y, time, { scale, reducedMotion });
    if (resource.hp <= 0) {
      if (resource.kind === 'tree') {
        if (animation?.kind === 'fell' && age < 0.8) {
          draw('pine-fall', age, resource.scale);
          return;
        }
        ctx.fillStyle = '#4c3f2c';
        ctx.fillRect(x - 5, y - 6, 10, 8);
        ctx.fillStyle = '#a18a59';
        ctx.fillRect(x - 5, y - 7, 10, 3);
        ctx.fillStyle = '#645337';
        ctx.fillRect(x - 2, y - 7, 4, 2);
      } else if (resource.kind === 'stone') {
        if (age < 2 / 3) draw('rock-break', age);
        else {
          ctx.fillStyle = '#53644b';
          ctx.fillRect(x - 5, y - 3, 5, 3);
          ctx.fillRect(x + 2, y - 1, 4, 2);
        }
      } else if (resource.kind === 'berries')
        draw(age < 2 / 3 ? 'berry-harvest' : 'berry-empty', age < 2 / 3 ? age : 0);
      else if (age < 2 / 3) draw(`${resource.kind}-harvest`, age);
      else {
        ctx.fillStyle = '#7b8350';
        ctx.fillRect(x - 2, y - 2, 4, 2);
      }
      return;
    }
    if (resource.kind === 'tree') {
      this.shadow(x + 9, y, resource.scale * 23);
      const p = sim.state.player;
      if (
        Math.abs(p.x - resource.x) < 22 * resource.scale &&
        p.y < resource.y + 2 &&
        p.y > resource.y - 64 * resource.scale
      )
        ctx.globalAlpha = 0.2;
      draw(
        age < 0.43 && animation?.kind === 'hit' ? 'pine-hit' : 'pine-sway',
        age < 0.43 ? age : sim.state.time + resource.variant * 5,
        resource.scale,
      );
      ctx.globalAlpha = 1;
    } else {
      this.shadow(x, y, resource.kind === 'stone' ? 12 : 10);
      const scale = animation?.kind === 'regrow' && age < 0.6 ? 0.55 + age * 0.75 : 1;
      if (resource.kind === 'stone')
        draw(
          age < 0.43 && animation?.kind === 'hit'
            ? 'rock-hit'
            : resource.hp < 2
              ? 'rock-cracked'
              : 'rock-idle',
          age < 0.43 ? age : 0,
          scale,
        );
      else
        draw(
          resource.kind === 'berries' ? 'berry-sway' : `${resource.kind}-idle`,
          sim.state.time + resource.variant * 6,
          scale,
        );
    }
  }
  private survivor(sim: Simulation) {
    const ctx = this.ctx,
      p = sim.state.player,
      pose = playerPose(sim, this.settings.reducedMotion);
    const hand = pose.clip.hands![pose.frame];
    const hx = hand[0] - pose.clip.anchor[0],
      hy = hand[1] - pose.clip.anchor[1];
    const actionClip = toolActionClip(pose);
    this.canvas.dataset.spriteSheet = actionClip ? CLIPS[actionClip].sheet : pose.clip.sheet;
    this.canvas.dataset.animation = pose.name;
    this.canvas.dataset.frame = String(pose.frame);
    this.canvas.dataset.heldItem = sim.state.equipped || 'none';
    this.canvas.dataset.facing = pose.direction;
    this.canvas.dataset.gaitDistance = sim.gaitDistance.toFixed(2);
    const drawHeld = () => {
      if (!pose.item) return;
      const item = pose.item;
      ctx.save();
      ctx.translate(Math.round(p.x), Math.round(p.y + 3));
      if (pose.flip) ctx.scale(-1, 1);
      ctx.translate(hx, hy);
      ctx.rotate(((hand[2] + (item === 'hatchet' || item === 'pickaxe' ? 15 : 0)) * Math.PI) / 180);
      if (item === 'torch' && sim.torchLit) {
        drawAnimation(ctx, 'torch-burn', 0, 0, sim.state.time, {
          reducedMotion: this.settings.reducedMotion,
        });
      } else if (item === 'torch') {
        ctx.fillStyle = '#503f2c';
        ctx.fillRect(-1, -8, 3, 13);
        ctx.fillStyle = '#aa8851';
        ctx.fillRect(-1, -8, 1, 12);
        ctx.fillStyle = '#8d7950';
        ctx.fillRect(-2, -11, 5, 5);
      } else if (item === 'hatchet' || item === 'pickaxe') {
        drawCarriedTool(ctx, item);
      } else {
        const size = ['wood', 'shelter', 'campfire'].includes(item) ? 18 : 14;
        drawItem(ctx, item, -Math.floor(size / 2), -Math.floor(size * 0.6), size);
      }
      // The grip stays in front of the item, not painted onto the item itself.
      ctx.fillStyle = '#ead4aa';
      ctx.fillRect(-1, -1, 3, 2);
      ctx.restore();
    };
    this.shadow(p.x, p.y, 10);
    if (sim.hitFlash > 0) ctx.globalAlpha = 0.72;
    if (actionClip) {
      // The entire actor + tool is a sliced frame, never a second rotating overlay.
      drawAnimation(ctx, actionClip, p.x, p.y + 3, pose.elapsed, { flip: pose.flip, frame: pose.frame });
    } else {
      if (pose.facing === 'up') drawHeld();
      drawAnimation(ctx, pose.bodyName, p.x, p.y + 3, pose.elapsed, { flip: pose.flip, frame: pose.frame });
      if (pose.facing !== 'up') drawHeld();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#e4be88';
    ctx.fillRect(p.x - 2, p.y - 41, 5, 2);
    ctx.fillRect(p.x - 1, p.y - 39, 3, 1);
    ctx.fillRect(p.x, p.y - 38, 1, 1);
  }
  draw(sim: Simulation, _now: number) {
    const ctx = this.ctx,
      s = sim.state,
      t = this.settings.reducedMotion ? 0 : s.time;
    const w = this.width,
      h = this.height;
    if (!w || !h) return;
    this.camera.x = Math.floor(clamp(s.player.x - w / 2, 0, Math.max(0, WORLD.width - w)));
    this.camera.y = Math.floor(clamp(s.player.y - h / 2 + 12, 0, Math.max(0, WORLD.height - h)));
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#253b2c';
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.translate(-this.camera.x, -this.camera.y);
    ctx.drawImage(this.ground, 0, 0);
    this.canvas.dataset.sunlight =
      this.settings.atmosphere && sunlightStrength(sim.hour, s.weather) > 0 ? 'on' : 'off';
    this.canvas.dataset.atmosphere = String(this.settings.atmosphere);
    this.atmosphere.ground(ctx, sim, this.camera, w, h, this.settings);
    this.feedback.update(sim, this.settings);
    this.feedback.ground(ctx, sim, this.camera, w, h, this.settings);
    this.canvas.dataset.effects = !this.settings.atmosphere
      ? 'off'
      : this.settings.reducedMotion
        ? 'reduced'
        : 'active';
    this.canvas.dataset.footprints = String(this.feedback.footprintCount);

    // Pixel ripples on the pond.
    ctx.fillStyle = '#7ea99b55';
    for (let i = 0; i < 24; i++) {
      const x = POND.x - 65 + ((i * 37) % 135),
        y = POND.y - 44 + ((i * 17) % 85);
      ctx.fillRect(Math.round(x + Math.sin(t * 0.5 + i) * 3), y, 5 + (i % 7), 1);
    }
    const near = sim.nearest();
    if (near && near.kind !== 'water' && near.kind !== 'shelter') {
      const target =
        near.kind === 'workbench'
          ? WORKBENCH
          : near.kind === 'fire'
            ? s.fires.find((f) => f.id === near.id)
            : s.resources.find((r) => r.id === near.id);
      if (target) {
        ctx.strokeStyle = '#ddc491';
        ctx.lineWidth = 1;
        ctx.strokeRect(Math.round(target.x - 13), Math.round(target.y - 6), 26, 12);
        ctx.fillStyle = '#e6c48d';
        ctx.fillRect(target.x - 1, target.y + 8, 2, 2);
      }
    }
    if (sim.target) {
      ctx.strokeStyle = '#e3d6a88a';
      ctx.strokeRect(Math.round(sim.target.x) - 3, Math.round(sim.target.y) - 3, 6, 6);
    }
    const draws: { y: number; draw: () => void }[] = [];
    for (const r of s.resources)
      if (
        r.x > this.camera.x - 55 &&
        r.x < this.camera.x + w + 55 &&
        r.y > this.camera.y - 10 &&
        r.y < this.camera.y + h + 85
      )
        draws.push({ y: r.y, draw: () => this.resource(r, sim) });
    draws.push({
      y: WORKBENCH.y,
      draw: () => {
        const asset = generatedAssets.objects.workbench;
        const image = artImages['object-workbench'];
        this.shadow(WORKBENCH.x, WORKBENCH.y, 28);
        if (image?.naturalWidth) {
          const behind =
            Math.abs(s.player.x - WORKBENCH.x) < 31 &&
            s.player.y < WORKBENCH.y &&
            s.player.y > WORKBENCH.y - 34;
          if (behind) ctx.globalAlpha = 0.5;
          ctx.drawImage(
            image,
            WORKBENCH.x - asset.anchor[0],
            WORKBENCH.y - asset.anchor[1],
            asset.width,
            asset.height,
          );
          ctx.globalAlpha = 1;
          this.canvas.dataset.workbench = 'generated';
        }
      },
    });
    for (const fire of s.fires)
      draws.push({
        y: fire.y,
        draw: () => {
          this.shadow(fire.x, fire.y, 18);
          if (fire.fuel > 0) {
            drawAnimation(ctx, 'fire-burn', fire.x, fire.y + 4, s.time, {
              reducedMotion: this.settings.reducedMotion,
            });
          } else {
            ctx.fillStyle = '#393c32';
            ctx.fillRect(fire.x - 12, fire.y - 6, 24, 8);
            ctx.fillStyle = '#65543b';
            ctx.fillRect(fire.x - 7, fire.y - 7, 15, 5);
          }
        },
      });
    for (const shelter of s.shelters) {
      const construction = sim.effects.find(
        (effect) => effect.clip === 'build-dust' && distance(effect, shelter) < 2,
      );
      const elapsed = construction ? s.time - construction.startedAt : Infinity;
      draws.push({
        y: shelter.y,
        draw: () => {
          this.shadow(shelter.x, shelter.y, 30);
          const occluded =
            Math.abs(s.player.x - shelter.x) < 35 && s.player.y < shelter.y && s.player.y > shelter.y - 38;
          if (occluded) ctx.globalAlpha = 0.6;
          drawAnimation(
            ctx,
            elapsed < 0.8 ? 'shelter-build' : 'shelter-idle',
            shelter.x,
            shelter.y,
            elapsed < 0.8 ? elapsed : s.time,
            { reducedMotion: this.settings.reducedMotion },
          );
          ctx.globalAlpha = 1;
        },
      });
    }
    for (const wolf of s.wolves)
      draws.push({
        y: wolf.y,
        draw: () => {
          const running =
            distance(wolf, s.player) < 175 ||
            (s.weather === 'wolves' && !sim.fireNearby && !sim.torchActive && wolf.scared <= 0);
          const gait = animationFrame(
            CLIPS['wolf-run'],
            s.time + wolf.id * 0.11,
            this.settings.reducedMotion,
          );
          this.shadow(wolf.x, wolf.y, running && gait >= 4 && gait <= 6 ? 15 : 19);
          drawAnimation(ctx, running ? 'wolf-run' : 'wolf-alert', wolf.x, wolf.y, s.time + wolf.id * 0.11, {
            flip: wolf.x < s.player.x,
            reducedMotion: this.settings.reducedMotion,
          });
          if (wolf.hp < 2) {
            ctx.fillStyle = '#18231e';
            ctx.fillRect(wolf.x - 10, wolf.y - 29, 20, 3);
            ctx.fillStyle = '#c9826c';
            ctx.fillRect(wolf.x - 10, wolf.y - 29, 10, 2);
          }
        },
      });
    draws.push({ y: s.player.y, draw: () => this.survivor(sim) });
    draws.sort((a, b) => a.y - b.y).forEach((d) => d.draw());
    for (const effect of sim.effects)
      drawAnimation(ctx, effect.clip, effect.x, effect.y, s.time - effect.startedAt, {
        flip: effect.flip,
        reducedMotion: this.settings.reducedMotion,
      });
    this.atmosphere.air(ctx, sim, this.camera, w, h, this.settings);
    const feedback = this.feedback.air(ctx, sim, this.camera, w, h, this.settings);
    this.canvas.dataset.impactFlashes = String(feedback.impacts);
    this.canvas.dataset.embers = String(feedback.embers);

    for (const p of sim.particles) {
      ctx.globalAlpha = Math.min(1, p.life * 2);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    ctx.globalAlpha = 1;
    for (const text of sim.floating) {
      ctx.globalAlpha = Math.min(1, text.life);
      ctx.font = '9px "Pixelify Sans", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#18261e';
      ctx.fillText(text.text, text.x + 1, text.y + 1);
      ctx.fillStyle = text.color;
      ctx.fillText(text.text, text.x, text.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    const darkness = sim.night
      ? 0.38
      : sim.hour > 18
        ? (sim.hour - 18) * 0.12
        : sim.hour < 8
          ? (8 - sim.hour) * 0.09
          : 0;
    if (darkness > 0) {
      ctx.fillStyle = `rgba(11, 24, 36, ${darkness})`;
      ctx.fillRect(0, 0, w, h);
    }
    for (const fire of s.fires)
      if (fire.fuel > 0) {
        const x = fire.x - this.camera.x,
          y = fire.y - this.camera.y - 10;
        const radius = 59 + Math.sin(t * 3) * 2;
        const glow = ctx.createRadialGradient(x, y, 3, x, y, radius);
        glow.addColorStop(0, `rgba(245, 180, 81, ${sim.night ? 0.19 : 0.07})`);
        glow.addColorStop(1, 'rgba(245, 180, 81, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      }
    this.atmosphere.light(ctx, sim, this.camera, w, h, this.settings);
    this.feedback.screen(ctx, sim, this.camera, w, h, this.settings);
    if (s.weather === 'rain' || s.weather === 'storm') {
      ctx.fillStyle = '#29415132';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#b6cac64a';
      ctx.lineWidth = 1;
      for (let i = 0; i < 115; i++) {
        const x = (((i * 67.3 - t * 35) % (w + 30)) + w + 30) % (w + 30),
          y = (i * 37.7 + t * 170) % (h + 20);
        ctx.beginPath();
        ctx.moveTo(Math.floor(x), Math.floor(y));
        ctx.lineTo(Math.floor(x) - 2, Math.floor(y) + 6);
        ctx.stroke();
      }
      if (s.weather === 'storm' && !this.settings.reducedMotion && s.time % 17 < 0.12) {
        ctx.fillStyle = '#e1e8df38';
        ctx.fillRect(0, 0, w, h);
      }
    }
    // Fireflies and drifting pollen, tiny enough to remain part of the pixel world.
    if (s.weather === 'clear' && this.settings.atmosphere && !this.settings.reducedMotion)
      for (let i = 0; i < 16; i++) {
        const x = (((i * 87 + Math.sin(t / 3 + i) * 15 - this.camera.x * 0.2) % w) + w) % w,
          y = (((i * 41 + Math.cos(t / 4 + i) * 13 - this.camera.y * 0.2) % h) + h) % h;
        ctx.fillStyle = sim.night ? `rgba(225, 219, 139, ${0.2 + Math.sin(t + i) * 0.18})` : '#d6d6a640';
        ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1);
      }
    const vignette = ctx.createRadialGradient(w / 2, h / 2, h * 0.25, w / 2, h / 2, w * 0.65);
    vignette.addColorStop(0, '#0c171900');
    vignette.addColorStop(1, '#0c171953');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);
    if (s.needs.health < 25) {
      ctx.strokeStyle = '#a652424d';
      ctx.lineWidth = 6;
      ctx.strokeRect(0, 0, w, h);
    }
  }
  screenToWorld(x: number, y: number) {
    return { x: x / 2 + this.camera.x, y: y / 2 + this.camera.y };
  }
}
export function drawMap(
  canvas: HTMLCanvasElement,
  state: GameState,
  ground?: HTMLCanvasElement,
  expanded = false,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width,
    h = canvas.height,
    sx = w / WORLD.width,
    sy = h / WORLD.height;
  ctx.imageSmoothingEnabled = false;
  if (ground) ctx.drawImage(ground, 0, 0, w, h);
  else {
    ctx.fillStyle = '#43563c';
    ctx.fillRect(0, 0, w, h);
  }
  ctx.fillStyle = '#172d2644';
  ctx.fillRect(0, 0, w, h);
  for (const r of state.resources)
    if (r.kind === 'tree' && r.hp > 0) {
      ctx.fillStyle = r.variant > 0.5 ? '#243e32' : '#334c38';
      ctx.fillRect(Math.floor(r.x * sx) - 1, Math.floor(r.y * sy) - 2, expanded ? 4 : 2, expanded ? 5 : 3);
    }
  ctx.strokeStyle = '#e2d1a51a';
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += w / 6) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += h / 5) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  const marker = (x: number, y: number, color: string, size: number, label?: string, above = false) => {
    ctx.fillStyle = '#15251f';
    ctx.fillRect(Math.round(x * sx) - size - 1, Math.round(y * sy) - size - 1, size * 2 + 2, size * 2 + 2);
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x * sx) - size, Math.round(y * sy) - size, size * 2, size * 2);
    if (expanded && label) {
      ctx.font = '10px "Pixelify Sans", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#192920';
      const labelY = y * sy + (above ? -23 : size + 5);
      ctx.fillRect(x * sx - 42, labelY, 84, 13);
      ctx.fillStyle = '#e1dcc1';
      ctx.fillText(label, x * sx, labelY + 9);
    }
  };
  for (const fire of state.fires) marker(fire.x, fire.y, '#dca36b', expanded ? 4 : 2, 'CAMPFIRE');
  for (const sh of state.shelters) marker(sh.x, sh.y, '#b9bd82', expanded ? 3 : 2);
  marker(WORKBENCH.x, WORKBENCH.y, '#c3bd87', expanded ? 4 : 2, 'CRAFTING TABLE', true);
  marker(SPRING.x, SPRING.y, '#91c2c0', expanded ? 4 : 2, 'THE SPRING');
  marker(state.player.x, state.player.y, '#f3ebce', expanded ? 3 : 2);
  if (!expanded) {
    ctx.strokeStyle = '#e9e0bc70';
    ctx.strokeRect(state.player.x * sx - 20, state.player.y * sy - 12, 40, 24);
  }
}
