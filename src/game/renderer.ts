import { ForestLighting } from './lighting';
import { daylightAt } from './climate';
import { FOREST_CLEARINGS, FOREST_DECOR, FOREST_TRAILS, groveDensity, trailSamples } from './forest';
export { drawMap } from './cartography';
import { WOLF_FADE, WOLF_ATTACKS, wolfMaxHealth } from './wolves';
import { CAMP, POND, WORLD, CAMP_BENCH, RESOURCE_HP, clamp, distance, random } from './data';
import type { Point, Resource, Settings } from './types';
import {
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
  private lighting = new ForestLighting();
  private forestVersion: 1 | 2;
  constructor(canvas: HTMLCanvasElement, seed: number, settings: Settings, forestVersion: 1 | 2 = 2) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.settings = settings;
    this.forestVersion = forestVersion;
    this.rng = random(seed + 47);
    this.seed = seed;
    this.atmosphere = new ForestAtmosphere(seed);
    this.ground = document.createElement('canvas');
    this.ground.width = WORLD.width;
    this.ground.height = WORLD.height;
    this.resize();
  }
  resize() {
    this.width = Math.ceil(this.canvas.clientWidth / this.settings.pixelScale);
    this.height = Math.ceil(this.canvas.clientHeight / this.settings.pixelScale);
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
        const density = groveDensity({ x, y });
        ctx.fillStyle =
          this.forestVersion === 2 && density > 0.5
            ? ['#3a5037', '#3c5238', '#40543a'][shade % 3]
            : palette[shade % palette.length];
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
    if (this.forestVersion === 2) {
      for (const area of FOREST_CLEARINGS.slice(1)) {
        pixelEllipse(ctx, area.x, area.y, area.rx + 9, area.ry + 9, '#4e5e3f');
        pixelEllipse(ctx, area.x, area.y, area.rx, area.ry, '#566343');
      }
      for (const trail of FOREST_TRAILS) {
        const samples = trailSamples(trail);
        for (const [extra, color] of [
          [7, '#4e5b3f'],
          [0, '#666449'],
          [-6, '#7b7050'],
        ] as const)
          for (const point of samples) {
            const radius = Math.max(3, trail.width / 2 + extra);
            pixelEllipse(
              ctx,
              Math.round(point.x / 3) * 3,
              Math.round(point.y / 3) * 3,
              radius,
              radius,
              color,
              3,
            );
          }
      }
    } else {
      // Saved expeditions keep their original routes and resource coordinates.
      for (let x = 0; x < WORLD.width; x += 4) {
        const y = Math.floor((760 + Math.sin(x / 175) * 30) / 4) * 4;
        ctx.fillStyle = '#5b6542';
        ctx.fillRect(x, y - 24, 4, 48);
        ctx.fillStyle = '#72744b';
        ctx.fillRect(x, y - 16, 4, 32);
        ctx.fillStyle = '#7b7950';
        ctx.fillRect(x, y - 10, 4, 20);
      }
    }
    const clearing = artImages['object-campGround'];
    if (clearing?.naturalWidth) {
      const asset = generatedAssets.objects.campGround;
      ctx.drawImage(
        clearing,
        CAMP.x - asset.anchor[0],
        CAMP.y + 12 - asset.anchor[1],
        asset.width,
        asset.height,
      );
      this.canvas.dataset.campGround = 'generated';
    }
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
    addTerrainDetail(ctx, this.seed, this.forestVersion);
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
        this.prop('pineStump', { x, y });
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
            : resource.hp <= RESOURCE_HP.stone / 2
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
  private prop(name: keyof typeof generatedAssets.objects, point: Point, alpha = 1) {
    const image = artImages[`object-${name}`],
      asset = generatedAssets.objects[name];
    if (!image?.naturalWidth) return;
    this.ctx.save();
    this.ctx.globalAlpha *= alpha;
    this.ctx.drawImage(
      image,
      Math.round(point.x - asset.anchor[0]),
      Math.round(point.y - asset.anchor[1]),
      asset.width,
      asset.height,
    );
    this.ctx.restore();
  }
  private survivor(sim: Simulation) {
    const ctx = this.ctx,
      p = sim.state.player,
      pose = playerPose(sim, this.settings.reducedMotion);
    if (sim.seated) {
      this.canvas.dataset.spriteSheet = 'seated-bench';
      this.canvas.dataset.animation = 'bench-seated';
      this.canvas.dataset.frame = '0';
      this.canvas.dataset.heldItem = sim.state.equipped || 'none';
      this.canvas.dataset.facing = 'down';
      this.canvas.dataset.gaitDistance = sim.gaitDistance.toFixed(2);
      this.shadow(CAMP_BENCH.x, CAMP_BENCH.y, 20);
      this.prop('seatedBench', CAMP_BENCH);
      return;
    }
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
      if (!pose.item || sim.action?.kind === 'feed') return;
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
        const size = ['wood', 'shelter', 'campfire', 'workbench'].includes(item) ? 18 : 14;
        drawItem(ctx, item, -Math.floor(size / 2), -Math.floor(size * 0.6), size);
      }
      // The grip stays in front of the item, not painted onto the item itself.
      ctx.fillStyle = '#ead4aa';
      ctx.fillRect(-1, -1, 3, 2);
      ctx.restore();
    };
    this.shadow(p.x, p.y, 10);
    if (sim.hitFlash > 0 && this.settings.damageFlash && !this.settings.reducedMotion) ctx.globalAlpha = 0.72;
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
      this.settings.atmosphere && sunlightStrength(sim.hour, sim.weatherMix) > 0 ? 'on' : 'off';
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
    this.canvas.dataset.pixelScale = String(this.settings.pixelScale);
    this.canvas.dataset.floatingText = String(this.settings.floatingText);
    this.canvas.dataset.vignette = String(this.settings.vignette);
    this.canvas.dataset.damageFlash = String(this.settings.damageFlash);
    this.canvas.dataset.wolfPhases = [...sim.wolfPack.minds.values()].map((mind) => mind.phase).join(' ');
    this.canvas.dataset.wolfFallen = String(sim.wolfPack.fallen.length);
    this.canvas.dataset.wolfCount = String(s.wolves.length);
    this.canvas.dataset.campFocus = sim.campFocus === null ? 'none' : String(sim.campFocus);
    this.canvas.dataset.feeding = String(sim.action?.kind === 'feed');
    this.canvas.dataset.seated = String(sim.seated);
    this.canvas.dataset.campApproach = String(sim.approachingCamp);
    this.canvas.dataset.workbenchCount = String(s.workbenches.length);
    this.canvas.dataset.workbench = s.workbenches.length ? 'generated' : 'none';
    this.canvas.dataset.stumps = String(
      s.resources.filter((resource) => resource.kind === 'tree' && resource.hp <= 0).length,
    );
    this.canvas.dataset.wolfAttack = [...sim.wolfPack.minds.values()]
      .filter((mind) => ['windup', 'lunge'].includes(mind.phase))
      .map((mind) => mind.attack)
      .join(' ');

    // Pixel ripples on the pond.
    ctx.fillStyle = '#7ea99b55';
    for (let i = 0; i < 24; i++) {
      const x = POND.x - 65 + ((i * 37) % 135),
        y = POND.y - 44 + ((i * 17) % 85);
      ctx.fillRect(Math.round(x + Math.sin(t * 0.5 + i) * 3), y, 5 + (i % 7), 1);
    }
    const near = sim.nearest();
    if (sim.campFocus === null && near && (near.kind === 'workbench' || near.kind === 'fire')) {
      const target =
        near.kind === 'workbench'
          ? s.workbenches.find((bench) => bench.id === near.id)
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
    if (s.forestVersion === 2)
      for (const decoration of FOREST_DECOR)
        if (
          decoration.x > this.camera.x - 50 &&
          decoration.x < this.camera.x + w + 50 &&
          decoration.y > this.camera.y - 10 &&
          decoration.y < this.camera.y + h + 55
        )
          draws.push({ y: decoration.y, draw: () => this.prop(decoration.kind, decoration) });
    for (const bench of s.workbenches)
      draws.push({
        y: bench.y,
        draw: () => {
          this.shadow(bench.x, bench.y, 19);
          const behind =
            Math.abs(s.player.x - bench.x) < 23 && s.player.y < bench.y && s.player.y > bench.y - 26;
          this.prop('workbench', bench, behind ? 0.45 : 1);
        },
      });
    if (!sim.seated)
      draws.push({
        y: CAMP_BENCH.y - 3,
        draw: () => {
          this.shadow(CAMP_BENCH.x, CAMP_BENCH.y - 3, 20);
          this.prop('campBench', CAMP_BENCH);
        },
      });
    const placement = sim.placementPreview;
    this.canvas.dataset.placement = placement ? (placement.valid ? 'valid' : 'blocked') : 'none';
    if (placement)
      draws.push({
        y: placement.y,
        draw: () => {
          this.prop('workbench', placement, 0.55);
          ctx.strokeStyle = placement.valid ? '#bbca8e' : '#d28a70';
          ctx.lineWidth = 1;
          ctx.strokeRect(Math.round(placement.x) - 20, Math.round(placement.y) - 7, 40, 14);
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
    for (const fallen of sim.wolfPack.fallen) {
      draws.push({
        y: fallen.y,
        draw: () => {
          // A whole existing frame fades away. This is defeat feedback, not a new
          // drawn fallen pose; actor artwork is never rigged or reconstructed.
          ctx.save();
          ctx.globalAlpha = clamp(1 - (s.time - fallen.startedAt) / WOLF_FADE, 0, 1);
          this.shadow(fallen.x, fallen.y, 17);
          drawAnimation(ctx, 'wolf-idle', fallen.x, fallen.y, 0, { flip: fallen.flip, frame: 0 });
          ctx.restore();
        },
      });
    }
    for (const wolf of s.wolves) {
      draws.push({
        y: wolf.y,
        draw: () => {
          const mind = sim.wolfPack.minds.get(wolf.id);
          const phase = mind?.phase ?? 'stalk';
          const age = mind ? s.time - mind.startedAt : 0;
          const attack = WOLF_ATTACKS[mind?.attack ?? 'snap'];
          const pounce = mind?.attack === 'pounce';
          const running = !!mind?.moving;
          const frame = this.settings.reducedMotion
            ? phase === 'lunge'
              ? 4
              : 0
            : phase === 'lunge'
              ? Math.min(7, Math.floor((age / attack.lunge) * 8))
              : running
                ? Math.floor((mind?.gait ?? 0) / 4) % 8
                : 0;
          this.shadow(wolf.x, wolf.y, running && frame >= 4 && frame <= 6 ? 15 : 19);
          if (phase === 'windup') {
            // Ground brackets and a filling warning are readable with motion off.
            ctx.strokeStyle = pounce ? '#f2b189' : '#edb677';
            ctx.lineWidth = 1;
            ctx.strokeRect(Math.round(wolf.x - 17), Math.round(wolf.y - 7), 34, 12);
            ctx.fillStyle = '#20281c';
            ctx.fillRect(Math.round(wolf.x - 11), Math.round(wolf.y - 36), 22, 4);
            ctx.fillStyle = '#edc58c';
            ctx.fillRect(
              Math.round(wolf.x - 10),
              Math.round(wolf.y - 35),
              Math.round(20 * Math.min(1, age / attack.windup)),
              2,
            );
            ctx.fillRect(Math.round(wolf.x - 1), Math.round(wolf.y - 47), 2, 7);
            ctx.fillRect(Math.round(wolf.x - 1), Math.round(wolf.y - 38), 2, 2);
            if (pounce && mind) {
              // A static landing mark communicates the stronger, longer attack,
              // including when reduced motion is enabled. It never tracks a dodge.
              ctx.strokeRect(Math.round(mind.target.x - 12), Math.round(mind.target.y - 7), 24, 14);
              for (let i = 1; i < 7; i++)
                ctx.fillRect(
                  Math.round(wolf.x + ((mind.target.x - wolf.x) * i) / 7),
                  Math.round(wolf.y + ((mind.target.y - wolf.y) * i) / 7),
                  1,
                  1,
                );
            }
          }
          ctx.save();
          if (phase === 'hurt' && age < 0.12 && this.settings.damageFlash && !this.settings.reducedMotion)
            ctx.globalAlpha = 0.65;
          const lift =
            pounce && phase === 'lunge' && !this.settings.reducedMotion
              ? Math.round(Math.sin(Math.min(1, age / attack.lunge) * Math.PI) * 5)
              : 0;
          drawAnimation(
            ctx,
            running || phase === 'lunge' ? 'wolf-run' : 'wolf-alert',
            wolf.x,
            wolf.y - lift,
            0,
            {
              flip: mind?.flip ?? wolf.x < s.player.x,
              frame,
            },
          );
          ctx.restore();
          if (wolf.hp < wolfMaxHealth(wolf)) {
            ctx.fillStyle = '#18231e';
            ctx.fillRect(Math.round(wolf.x - 10), Math.round(wolf.y - 30), 20, 3);
            ctx.fillStyle = '#c9826c';
            ctx.fillRect(
              Math.round(wolf.x - 10),
              Math.round(wolf.y - 30),
              Math.round((20 * wolf.hp) / wolfMaxHealth(wolf)),
              2,
            );
          }
        },
      });
    }
    draws.push({ y: s.player.y, draw: () => this.survivor(sim) });
    draws.sort((a, b) => a.y - b.y).forEach((d) => d.draw());
    if (sim.action?.kind === 'feed' && sim.feedingFire && !sim.action.impacted) {
      // Move the complete generated log icon from the existing hand position to
      // the fire. No new limbs, poses, or animation-sheet pixels are fabricated.
      const pose = playerPose(sim, this.settings.reducedMotion);
      const hand = pose.clip.hands![pose.frame];
      const fromX = sim.seated
        ? CAMP_BENCH.x + 4
        : s.player.x + (hand[0] - pose.clip.anchor[0]) * (pose.flip ? -1 : 1);
      const fromY = sim.seated ? CAMP_BENCH.y - 14 : s.player.y + hand[1] - pose.clip.anchor[1] + 3;
      const raw = clamp((s.time - sim.action.startedAt) / sim.action.impactAt, 0, 1);
      const progress = this.settings.reducedMotion ? 0 : raw * raw * (3 - 2 * raw);
      const x = fromX + (sim.feedingFire.x - fromX) * progress;
      const y = fromY + (sim.feedingFire.y - 9 - fromY) * progress - Math.sin(progress * Math.PI) * 9;
      drawItem(ctx, 'wood', Math.round(x - 9), Math.round(y - 9), 18);
    }
    for (const effect of sim.effects)
      drawAnimation(ctx, effect.clip, effect.x, effect.y, s.time - effect.startedAt, {
        flip: effect.flip,
        reducedMotion: this.settings.reducedMotion,
      });
    const leaves = this.settings.atmosphere && !this.settings.reducedMotion ? sim.fallingLeaves : [];
    this.canvas.dataset.chopLeaves = String(leaves.length);
    for (const leaf of leaves) {
      const age = s.time - leaf.startedAt,
        progress = age / leaf.duration;
      const x = leaf.x + leaf.drift * age + Math.sin(leaf.phase + age * 4) * 5;
      const y = leaf.y + 18 * age + 7 * age * age;
      ctx.save();
      ctx.globalAlpha = Math.min(1, (1 - progress) * 3);
      drawAnimation(ctx, 'leaf-drift', x, y, age + leaf.phase, { scale: 0.65 });
      ctx.restore();
    }
    this.atmosphere.air(ctx, sim, this.camera, w, h, this.settings);
    const feedback = this.feedback.air(ctx, sim, this.camera, w, h, this.settings);
    this.canvas.dataset.impactFlashes = String(feedback.impacts);
    this.canvas.dataset.embers = String(feedback.embers);

    for (const p of this.settings.atmosphere && !this.settings.reducedMotion ? sim.particles : []) {
      ctx.globalAlpha = Math.min(1, p.life * 2);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    ctx.globalAlpha = 1;
    for (const text of this.settings.floatingText ? sim.floating : []) {
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
    const darkness = this.lighting.draw(ctx, sim, this.camera, w, h);
    const daylight = daylightAt(s.time),
      mix = sim.weatherMix;
    this.canvas.dataset.darkness = darkness.toFixed(3);
    this.canvas.dataset.rain = mix.rain.toFixed(3);
    this.canvas.dataset.daylight = daylight.toFixed(3);
    this.canvas.dataset.torchLight = String(sim.torchActive);
    this.canvas.dataset.collecting = sim.collecting ? String(sim.collecting.resource.id) : 'none';
    this.canvas.dataset.collectionProgress = sim.collecting?.progress.toFixed(3) ?? '0';
    for (const fire of s.fires)
      if (fire.fuel > 0) {
        const x = fire.x - this.camera.x,
          y = fire.y - this.camera.y - 10;
        const stoked =
          sim.feedingFire?.id === fire.id && sim.action?.impacted && !this.settings.reducedMotion
            ? Math.max(0, 1 - (s.time - sim.action.startedAt - sim.action.impactAt) / 0.5)
            : 0;
        const radius = 59 + Math.sin(t * 3) * 2 + stoked * 12;
        const glow = ctx.createRadialGradient(x, y, 3, x, y, radius);
        glow.addColorStop(0, `rgba(245, 180, 81, ${0.07 + (1 - daylight) * 0.12})`);
        glow.addColorStop(1, 'rgba(245, 180, 81, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      }
    this.atmosphere.light(ctx, sim, this.camera, w, h, this.settings);
    this.feedback.screen(ctx, sim, this.camera, w, h, this.settings);
    if (mix.rain > 0.001) {
      ctx.save();
      ctx.globalAlpha = mix.rain * 0.12;
      ctx.fillStyle = '#294151';
      ctx.fillRect(0, 0, w, h);
      if (this.settings.atmosphere) {
        ctx.globalAlpha = mix.rain;
        ctx.strokeStyle = '#b6cac64a';
        ctx.lineWidth = 1;
        for (let i = 0; i < (this.settings.reducedMotion ? 40 : 115); i++) {
          const x = (((i * 67.3 - t * 35) % (w + 30)) + w + 30) % (w + 30),
            y = (i * 37.7 + t * 170) % (h + 20);
          ctx.beginPath();
          ctx.moveTo(Math.floor(x), Math.floor(y));
          ctx.lineTo(Math.floor(x) - 2, Math.floor(y) + 6);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
    // Storm flashes read as weather, not damage; the flash switch still owns them.
    if (mix.storm > 0 && this.settings.damageFlash && !this.settings.reducedMotion && s.time % 17 < 0.12) {
      ctx.save();
      ctx.globalAlpha = mix.storm;
      ctx.fillStyle = '#e1e8df38';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
    // Pollen becomes fireflies continuously through dusk; clouds fade both out.
    if (this.settings.atmosphere && !this.settings.reducedMotion) {
      ctx.save();
      ctx.globalAlpha = 1 - mix.cloud;
      for (let i = 0; i < 16; i++) {
        const x = (((i * 87 + Math.sin(t / 3 + i) * 15 - this.camera.x * 0.2) % w) + w) % w,
          y = (((i * 41 + Math.cos(t / 4 + i) * 13 - this.camera.y * 0.2) % h) + h) % h;
        ctx.fillStyle = `rgba(${Math.round(225 - daylight * 11)}, ${Math.round(219 - daylight * 5)}, ${Math.round(139 + daylight * 27)}, ${0.2 + Math.sin(t + i) * 0.15 * (1 - daylight)})`;
        ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1);
      }
      ctx.restore();
    }
    const collecting = sim.collecting;
    if (collecting) {
      const x = Math.round(collecting.resource.x - this.camera.x),
        y = Math.round(collecting.resource.y - this.camera.y - 34);
      ctx.save();
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.fillStyle = '#172c26e6';
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#60765a';
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#e2cc8e';
      ctx.beginPath();
      ctx.arc(x, y, 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * collecting.progress);
      ctx.stroke();
      drawItem(ctx, 'berries', x - 5, y - 5, 10);
      ctx.restore();
    }
    if (this.settings.vignette) {
      const vignette = ctx.createRadialGradient(w / 2, h / 2, h * 0.25, w / 2, h / 2, w * 0.65);
      vignette.addColorStop(0, '#0c171900');
      vignette.addColorStop(1, '#0c171953');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, w, h);
    }
    if (s.needs.health < 25) {
      ctx.strokeStyle = '#a652424d';
      ctx.lineWidth = 6;
      ctx.strokeRect(0, 0, w, h);
    }
  }
  screenToWorld(x: number, y: number) {
    return {
      x:
        (x * this.width) / (this.canvas.clientWidth || this.width * this.settings.pixelScale) + this.camera.x,
      y:
        (y * this.height) / (this.canvas.clientHeight || this.height * this.settings.pixelScale) +
        this.camera.y,
    };
  }
}
