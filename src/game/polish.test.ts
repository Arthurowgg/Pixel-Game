import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CLIPS, frameRect, ITEM_ATLAS, playerPose, SHEETS, toolActionClip } from './animation';
import { ForestAtmosphere, sunlightStrength, wrap } from './atmosphere';
import { DEFAULT_SETTINGS, ITEMS, SETTINGS_KEY } from './data';
import { createGame, Simulation } from './simulation';
import { loadSettings } from './storage';

afterEach(() => vi.unstubAllGlobals());

describe('literal sprite-sheet slicing', () => {
  it('crosses from the fourth column to the second row at the impact frame', () => {
    const clip = CLIPS['survivor-axe-right'];
    expect(frameRect(clip, 3)).toEqual({ x: 192, y: 0, w: 64, h: 80 });
    expect(frameRect(clip, 4)).toEqual({ x: 0, y: 80, w: 64, h: 80 });
    expect(frameRect(clip, 7)).toEqual({ x: 192, y: 80, w: 64, h: 80 });
  });
  it('clamps bad frame indices without sampling an adjacent clip', () => {
    const clip = CLIPS['survivor-mine-up'];
    expect(frameRect(clip, -1)).toEqual(frameRect(clip, 0));
    expect(frameRect(clip, 100)).toEqual(frameRect(clip, 7));
    expect(frameRect(CLIPS['walk-up'], 3).y).toBe(CLIPS['walk-up'].y);
  });
  it('keeps full-body tool frames synchronized with the unchanged gameplay contact time', () => {
    for (const mode of ['axe', 'mine'])
      for (const direction of ['right', 'up', 'down']) {
        const clip = CLIPS[`survivor-${mode}-${direction}`];
        expect(clip.columns).toBe(4);
        expect(clip.frames).toBe(8);
        expect(clip.loop).toBe(false);
        expect(clip.impactFrame! / clip.fps).toBe(1 / 3);
        expect(clip.hands).toHaveLength(8);
        for (const [x, y] of clip.hands!) {
          expect(x).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThan(clip.w);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(y).toBeLessThan(clip.h);
        }
      }
  });
  it('selects the correct complete tool sheet, mirrors left, and leaves other held items layered', () => {
    const sim = new Simulation(createGame('Fern', 'explorer', 42));
    expect(toolActionClip(playerPose(sim))).toBeNull();
    sim.state.direction = 'left';
    sim.attack();
    expect(toolActionClip(playerPose(sim))).toBe('survivor-axe-right');
    expect(playerPose(sim).flip).toBe(true);
    sim.equip('pickaxe');
    sim.state.time = 1;
    sim.attack();
    expect(toolActionClip(playerPose(sim))).toBe('survivor-mine-right');
    sim.equip('berries');
    sim.state.time = 2;
    sim.attack();
    expect(toolActionClip(playerPose(sim))).toBeNull();
  });
  it('gives every inventory item one non-overlapping atlas cell and records generation provenance', () => {
    const png = readFileSync(`public/${ITEM_ATLAS.sheet}`);
    expect(png.readUInt32BE(16)).toBe(ITEM_ATLAS.width);
    expect(png.readUInt32BE(20)).toBe(ITEM_ATLAS.height);
    expect(Object.keys(ITEM_ATLAS.items).sort()).toEqual(Object.keys(ITEMS).sort());
    const occupied = new Set();
    for (const rect of Object.values(ITEM_ATLAS.items)) {
      expect(rect.x + rect.w).toBeLessThanOrEqual(ITEM_ATLAS.width);
      expect(rect.y + rect.h).toBeLessThanOrEqual(ITEM_ATLAS.height);
      occupied.add(`${rect.x},${rect.y}`);
    }
    expect(occupied.size).toBe(Object.keys(ITEMS).length);
    expect(ITEM_ATLAS.items.hatchet.source).toBe('generated');
    expect(ITEM_ATLAS.items.pickaxe.source).toBe('generated');
    expect(ITEM_ATLAS.items.berries.source).toBe('generated');
    expect(ITEM_ATLAS.items.bandage.source).toBe('generated');
  });
  it('ships identical runtime/public manifests and only preloads sheets still in use', () => {
    const publicManifest = JSON.parse(readFileSync('public/art/animations/manifest.json', 'utf8'));
    expect(publicManifest.clips).toEqual(CLIPS);
    expect(publicManifest.sheets).toEqual(SHEETS);
    expect(JSON.parse(readFileSync('public/art/item-sprites.json', 'utf8'))).toEqual(ITEM_ATLAS);
    const used = new Set(Object.values(CLIPS).map((clip) => clip.sheet));
    expect([...used].sort()).toEqual(Object.keys(SHEETS).sort());
  });
});
describe('forest atmosphere', () => {
  it('fades sun rays with daylight and never puts them in rain, storms, cold, or wolf nights', () => {
    expect(sunlightStrength(12.5, 'clear')).toBe(1);
    expect(sunlightStrength(8, 'clear')).toBeGreaterThan(0);
    for (const hour of [0, 5, 6, 19, 20, 23]) expect(sunlightStrength(hour, 'clear')).toBe(0);
    for (const weather of ['rain', 'storm', 'cold', 'wolves'] as const)
      expect(sunlightStrength(12, weather)).toBe(0);
  });
  it('wraps particles consistently on either side of the viewport', () => {
    expect(wrap(-1, 195)).toBe(194);
    expect(wrap(196, 195)).toBe(1);
    expect(wrap(0, 195)).toBe(0);
  });
  it('skips optional draw work when disabled and drifting leaves when reduced motion is enabled', () => {
    const atmosphere = new ForestAtmosphere(42),
      sim = new Simulation(createGame('Fern', 'explorer', 42));
    const context = {} as CanvasRenderingContext2D;
    const settings = { ...DEFAULT_SETTINGS, atmosphere: false };
    expect(() => atmosphere.ground(context, sim, { x: 0, y: 0 }, 720, 450, settings)).not.toThrow();
    expect(() => atmosphere.light(context, sim, { x: 0, y: 0 }, 720, 450, settings)).not.toThrow();
    expect(() =>
      atmosphere.air(context, sim, { x: 0, y: 0 }, 720, 450, {
        ...settings,
        atmosphere: true,
        reducedMotion: true,
      }),
    ).not.toThrow();
  });
  it('upgrades existing settings without dropping preferences and keeps atmosphere optional', () => {
    let value = JSON.stringify({ sound: false, effects: 0.7, reducedMotion: true });
    vi.stubGlobal('localStorage', { getItem: (key: string) => (key === SETTINGS_KEY ? value : null) });
    expect(loadSettings()).toMatchObject({
      sound: false,
      effects: 0.7,
      reducedMotion: true,
      atmosphere: true,
    });
    value = JSON.stringify({ atmosphere: false });
    expect(loadSettings().atmosphere).toBe(false);
  });
});
