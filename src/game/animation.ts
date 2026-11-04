import { locomotionFrame } from './movement';
import manifest from './animation-manifest.json';
import { imageTask, loadBitmap, loadTasks } from './loading';
import type { LoadProgress } from './loading';
import itemAtlas from './item-atlas.json';
import generatedAssets from './generated-assets.json';
import type { ItemId } from './types';

import type { Simulation } from './simulation';

export const ITEM_ATLAS = itemAtlas;

export interface AnimationClip {
  sheet: string;
  x: number;
  y: number;
  w: number;
  h: number;
  frames: number;
  columns?: number;
  impactFrame?: number;
  fps: number;
  loop: boolean;
  anchor: number[];
  hands?: number[][];
}
export const CLIPS = manifest.clips as Record<string, AnimationClip>;
export const SHEETS = manifest.sheets;
export const artImages: Record<string, HTMLImageElement> = {};
export const WORLD_ART = [
  ...Object.keys(SHEETS).map((name) => ({
    name: `sheet-${name}`,
    file: `art/animations/${name}.png`,
    label: name.replaceAll('-', ' '),
  })),
  { name: 'items', file: ITEM_ATLAS.sheet, label: 'Trail supplies' },
  ...Object.entries(generatedAssets.textures).map(([name, asset]) => ({
    name: `texture-${name}`,
    file: asset.file,
    label: 'Forest floor',
  })),
  ...Object.entries(generatedAssets.effects).map(([name, asset]) => ({
    name: `effect-${name}`,
    file: asset.file,
    label: 'Camp effects',
  })),
  ...Object.entries(generatedAssets.objects).map(([name, asset]) => ({
    name: `object-${name}`,
    file: asset.file,
    label: 'Crafting table',
  })),
];
export async function loadArt(onProgress?: (progress: LoadProgress) => void, signal?: AbortSignal) {
  await loadTasks(
    WORLD_ART.map((asset) => ({
      ...imageTask(asset.file, asset.label),
      load: async () => {
        artImages[asset.name] = await loadBitmap(asset.file);
      },
    })),
    onProgress,
    signal,
  );
}

/** Animation time is simulation time, not wall time: pausing freezes all frames. */
export function animationFrame(clip: AnimationClip, elapsed: number, reducedMotion = false) {
  const raw = Math.max(0, Math.floor(elapsed * clip.fps));
  if (reducedMotion) {
    // Gameplay feedback stays readable, but ambient motion and repeated flashes stop.
    if (clip.loop) return 0;
    return raw < clip.frames / 2 ? 0 : Math.min(clip.frames - 1, Math.floor(clip.frames / 2));
  }
  return clip.loop ? raw % clip.frames : Math.min(clip.frames - 1, raw);
}
/** Single-row legacy atlases and literal multi-row sheets share one slicing path. */
export function frameRect(clip: AnimationClip, frameIndex: number) {
  const columns = clip.columns ?? clip.frames;
  const frame = Math.max(0, Math.min(clip.frames - 1, Math.floor(frameIndex)));
  return {
    x: clip.x + (frame % columns) * clip.w,
    y: clip.y + Math.floor(frame / columns) * clip.h,
    w: clip.w,
    h: clip.h,
  };
}
export function drawItem(ctx: CanvasRenderingContext2D, item: ItemId, x: number, y: number, size = 16) {
  const image = artImages.items;
  const rect = ITEM_ATLAS.items[item];
  if (!image?.complete || !image.naturalWidth) return;
  ctx.drawImage(image, rect.x, rect.y, rect.w, rect.h, x, y, size, size);
}
/** Carry-only orientation: the generated blade points inward until mirrored at its grip. */
export function drawCarriedTool(ctx: CanvasRenderingContext2D, item: 'hatchet' | 'pickaxe') {
  ctx.save();
  ctx.scale(-1, 1);
  drawItem(ctx, item, -8, -13, 16);
  ctx.restore();
}
export function toolActionClip(pose: ReturnType<typeof playerPose>) {
  if (pose.item !== 'hatchet' && pose.item !== 'pickaxe') return null;
  const name = `survivor-${pose.name}`;
  return CLIPS[name] ? name : null;
}
export function drawAnimation(
  ctx: CanvasRenderingContext2D,
  name: string,
  x: number,
  y: number,
  elapsed: number,
  options: { scale?: number; flip?: boolean; reducedMotion?: boolean; frame?: number } = {},
) {
  const clip = CLIPS[name];
  if (!clip) return;
  const image = artImages[`sheet-${clip.sheet}`];
  if (!image?.complete || !image.naturalWidth) return;
  const frame = options.frame ?? animationFrame(clip, elapsed, options.reducedMotion);
  const scale = options.scale ?? 1;
  const source = frameRect(clip, frame);
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  if (options.flip) ctx.scale(-1, 1);
  ctx.drawImage(
    image,
    source.x,
    source.y,
    source.w,
    source.h,
    -Math.round(clip.anchor[0] * scale),
    -Math.round(clip.anchor[1] * scale),
    Math.round(clip.w * scale),
    Math.round(clip.h * scale),
  );
  ctx.restore();
}

export function playerPose(sim: Simulation, reducedMotion = false) {
  const action = sim.action;
  const direction = action?.direction ?? sim.state.direction;
  let mode = sim.moving ? (sim.sprinting ? 'run' : 'walk') : 'idle';
  if (action) {
    switch (action.kind) {
      case 'chop':
        mode = 'axe';
        break;
      case 'mine':
        mode = 'mine';
        break;
      case 'forage':
      case 'feed':
      case 'refill':
        mode = 'forage';
        break;
      case 'build':
        mode = 'build';
        break;
      case 'attack':
        mode = action.item === 'hatchet' ? 'axe' : action.item === 'pickaxe' ? 'mine' : 'attack';
        break;
      default:
        mode = 'use';
    }
  }
  const facing = direction;
  const name = `${mode}-${facing === 'left' ? 'right' : facing}`;
  // Idle holds its intact neutral cell: the legacy blink repainted facial pixels and
  // the idle bob detached the torso from the boots. No replacement frames are made.
  // Sprint reuses the clean walking cells at distance-driven cadence. Tool sheets are untouched.
  const bodyName = mode === 'run' ? name.replace('run-', 'walk-') : name;
  const clip = CLIPS[bodyName];
  const elapsed = action ? sim.state.time - action.startedAt : sim.state.time;
  let frame =
    !action && sim.moving
      ? locomotionFrame(sim.gaitDistance, reducedMotion)
      : !action
        ? 0
        : animationFrame(clip, elapsed, reducedMotion);
  // Suppress the two overextended legacy reach poses, using only existing complete cells.
  // A genuinely crouching cycle still requires new whole-sheet artwork.
  if (action?.kind === 'forage') frame = [0, 1, 2, 2, 2, 2, 1, 0][frame];
  return {
    name,
    bodyName,
    facing,
    clip,
    frame,
    direction,
    flip: direction === 'left',
    elapsed,
    item: action ? action.item : sim.state.equipped,
  };
}
