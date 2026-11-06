import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { animationFrame, CLIPS, playerPose, SHEETS } from './animation';
import { createGame, Simulation } from './simulation';
import { assetUrl } from './assets';

describe('animation sheets', () => {
  it('packs every clip inside an actual PNG with the declared dimensions', () => {
    for (const [name, sheet] of Object.entries(SHEETS)) {
      const png = readFileSync(`public/art/animations/${name}.png`);
      expect(png.toString('hex', 0, 8)).toBe('89504e470d0a1a0a');
      expect(png.readUInt32BE(16)).toBe(sheet.width);
      expect(png.readUInt32BE(20)).toBe(sheet.height);
    }
    for (const clip of Object.values(CLIPS)) {
      const sheet = SHEETS[clip.sheet as keyof typeof SHEETS];
      const columns = clip.columns ?? clip.frames;
      expect(clip.x + clip.w * Math.min(columns, clip.frames)).toBeLessThanOrEqual(sheet.width);
      expect(clip.y + clip.h * Math.ceil(clip.frames / columns)).toBeLessThanOrEqual(sheet.height);
      expect(clip.frames).toBeGreaterThan(0);
      expect(clip.fps).toBeGreaterThan(0);
    }
  });
  it('slices the generated sheets into complete clips with a grip transform per frame', () => {
    const frames: Record<string, number> = { idle: 2, walk: 6, run: 6 };
    for (const mode of ['idle', 'walk', 'run', 'axe', 'mine', 'forage', 'use', 'build', 'attack'])
      for (const direction of ['down', 'right', 'up']) {
        const clip = CLIPS[`${mode}-${direction}`];
        expect(clip.sheet).toBe(`survivor2-${direction}`);
        expect(clip.frames).toBe(frames[mode] ?? 5);
        expect(clip.hands).toHaveLength(clip.frames);
        for (const hand of clip.hands!) {
          expect(hand).toHaveLength(3);
          expect(hand.every(Number.isFinite)).toBe(true);
        }
      }
  });
  it('loops ambient frames and clamps one-shot actions at their final pose', () => {
    expect(animationFrame(CLIPS['walk-right'], 0)).toBe(0);
    expect(animationFrame(CLIPS['walk-right'], 0.4)).toBe(4);
    expect(animationFrame(CLIPS['axe-right'], 100)).toBe(4);
    expect(animationFrame(CLIPS['walk-right'], -1)).toBe(0);
  });
  it('reduces ambient movement while retaining the contact pose for actions', () => {
    expect(animationFrame(CLIPS['pine-sway'], 15, true)).toBe(0);
    expect(animationFrame(CLIPS['mine-right'], 0.4, true)).toBe(2);
  });
  it('selects directional movement, mirrored left-facing poses, and distinct tools', () => {
    const sim = new Simulation(createGame('Robin', 'explorer', 42));
    sim.state.direction = 'left';
    sim.moving = true;
    expect(playerPose(sim).name).toBe('walk-right');
    expect(playerPose(sim).flip).toBe(true);
    sim.sprinting = true;
    expect(playerPose(sim).name).toBe('run-right');
    sim.interact();
    expect(playerPose(sim).name).toBe('axe-right');
    sim.equip('pickaxe');
    sim.attack();
    expect(playerPose(sim).name).toBe('mine-right');
    expect(playerPose(sim).item).toBe('pickaxe');
  });
  it('keeps runtime public paths under Vite’s configured base', () => {
    expect(assetUrl('/art/animations/survivor.png')).toBe(
      `${import.meta.env.BASE_URL}art/animations/survivor.png`,
    );
  });
});
