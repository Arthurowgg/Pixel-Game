import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { artImages, ITEM_ATLAS } from './animation';
import { DEFAULT_SETTINGS } from './data';
import { ForestFeedback, feedbackEnabled, impactStrength, MAX_FOOTPRINTS } from './feedback';
import { daylightAngle, healthPips } from './hud';
import registry from './generated-assets.json';
import { createGame, Simulation } from './simulation';

const fresh = () => new Simulation(createGame('Fern', 'explorer', 42));

describe('game HUD presentation', () => {
  it('fills ten health hearts including fractional damage without rounding the state', () => {
    expect(healthPips(100)).toEqual(Array(10).fill(100));
    expect(healthPips(37)).toEqual([100, 100, 100, 70, 0, 0, 0, 0, 0, 0]);
    expect(healthPips(0)).toEqual(Array(10).fill(0));
  });
  it('keeps malformed meter values within safe CSS bounds', () => {
    for (const input of [-100, 500, NaN, Infinity])
      for (const part of healthPips(input)) {
        expect(part).toBeGreaterThanOrEqual(0);
        expect(part).toBeLessThanOrEqual(100);
      }
  });
  it('wraps the celestial dial at midnight without changing the game clock', () => {
    expect(daylightAngle(6)).toBe(90);
    expect(daylightAngle(12)).toBe(180);
    expect(daylightAngle(24)).toBe(0);
    expect(daylightAngle(-6)).toBe(270);
    expect(daylightAngle(NaN)).toBe(0);
  });
});

describe('render-only forest feedback', () => {
  it('uses a bounded non-flashing contact envelope', () => {
    expect(impactStrength(0)).toBe(1);
    expect(impactStrength(0.11)).toBeCloseTo(0.25);
    for (const age of [-1, 0.22, 10, Infinity, NaN]) expect(impactStrength(age)).toBe(0);
  });
  it('honors both the atmosphere switch and reduced-motion preference', () => {
    expect(feedbackEnabled(DEFAULT_SETTINGS)).toBe(true);
    expect(feedbackEnabled({ ...DEFAULT_SETTINGS, atmosphere: false })).toBe(false);
    expect(feedbackEnabled({ ...DEFAULT_SETTINGS, reducedMotion: true })).toBe(false);
    const effects = new ForestFeedback(),
      sim = fresh(),
      ctx = {} as CanvasRenderingContext2D;
    effects.update(sim, { ...DEFAULT_SETTINGS, atmosphere: false });
    expect(() =>
      effects.ground(ctx, sim, { x: 0, y: 0 }, 720, 450, { ...DEFAULT_SETTINGS, reducedMotion: true }),
    ).not.toThrow();
    expect(
      effects.air(ctx, sim, { x: 0, y: 0 }, 720, 450, { ...DEFAULT_SETTINGS, atmosphere: false }),
    ).toEqual({ embers: 0, impacts: 0 });
    expect(() =>
      effects.screen(ctx, sim, { x: 0, y: 0 }, 720, 450, { ...DEFAULT_SETTINGS, atmosphere: false }),
    ).not.toThrow();
  });
  it('bounds and expires footstep trails without writing anything to a save', () => {
    const effects = new ForestFeedback(),
      sim = fresh();
    sim.moving = true;
    sim.sprinting = true;
    for (let i = 0; i < 1000; i++) {
      sim.state.time = i * 0.13;
      const before = JSON.stringify(sim.state);
      effects.update(sim, DEFAULT_SETTINGS);
      expect(effects.footprintCount).toBeLessThanOrEqual(MAX_FOOTPRINTS);
      expect(JSON.stringify(sim.state)).toBe(before);
    }
    expect(effects.footprintCount).toBeGreaterThan(0);
    sim.moving = false;
    sim.state.time += 1;
    effects.update(sim, DEFAULT_SETTINGS);
    expect(effects.footprintCount).toBe(0);
  });
  it('freezes the trail on pause and clears it on preference changes or rewinding', () => {
    const effects = new ForestFeedback(),
      sim = fresh();
    sim.moving = true;
    sim.state.time = 10;
    effects.update(sim, DEFAULT_SETTINGS);
    const count = effects.footprintCount;
    for (let i = 0; i < 50; i++) effects.update(sim, DEFAULT_SETTINGS);
    expect(effects.footprintCount).toBe(count);
    effects.update(sim, { ...DEFAULT_SETTINGS, reducedMotion: true });
    expect(effects.footprintCount).toBe(0);
    sim.state.time = 12;
    effects.update(sim, DEFAULT_SETTINGS);
    expect(effects.footprintCount).toBeGreaterThan(0);
    sim.state.time = 0;
    effects.update(sim, DEFAULT_SETTINGS);
    expect(effects.footprintCount).toBe(0);
  });
  it('draws the real generated impact bitmap at contact and culls distant or extinguished fires', () => {
    const effects = new ForestFeedback(),
      sim = fresh();
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      fillRect: vi.fn(),
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    artImages['effect-impactStar'] = { complete: true, naturalWidth: 16 } as HTMLImageElement;
    try {
      sim.resourceAnimations.set(0, { kind: 'hit', startedAt: 0 });
      const counts = effects.air(ctx, sim, { x: 700, y: 600 }, 400, 400, DEFAULT_SETTINGS);
      expect(counts).toEqual({ embers: 7, impacts: 1 });
      expect(ctx.drawImage).toHaveBeenCalledTimes(8);
      sim.state.time = 0.3;
      sim.state.fires[0].fuel = 0;
      expect(effects.air(ctx, sim, { x: 700, y: 600 }, 400, 400, DEFAULT_SETTINGS)).toEqual({
        embers: 0,
        impacts: 0,
      });
      sim.state.fires[0].fuel = 80;
      expect(effects.air(ctx, sim, { x: 0, y: 0 }, 100, 100, DEFAULT_SETTINGS)).toEqual({
        embers: 0,
        impacts: 0,
      });
    } finally {
      delete artImages['effect-impactStar'];
    }
  });
});

describe('camp-interface image provenance', () => {
  it('finishes all inventory icons with actual generated sources', () => {
    expect(Object.values(ITEM_ATLAS.items)).toHaveLength(15);
    expect(Object.values(ITEM_ATLAS.items).every((item) => item.source === 'generated')).toBe(true);
    for (const item of ['bandage', 'torch', 'meal', 'campfire', 'shelter'] as const) {
      expect(ITEM_ATLAS.items[item].sourceAsset).toBe(`art/generated/camp-ui/${item}.png`);
      expect(
        readFileSync(`public/${ITEM_ATLAS.items[item].sourceAsset}`).equals(
          readFileSync(`public/art/item-${item}.png`),
        ),
      ).toBe(true);
    }
  });
  it('ships a valid nine-slice frame and the standalone effect without changing their source pixels', () => {
    const frame = registry.frames.hud;
    expect(frame.slice * 2).toBeLessThan(frame.width);
    expect(frame.slice * 2).toBeLessThan(frame.height);
    for (const asset of [
      ...Object.values(registry.frames),
      ...Object.values(registry.effects),
      ...Object.values(registry.icons),
    ]) {
      const png = readFileSync(`public/${asset.file}`);
      expect(png.readUInt32BE(16)).toBe(asset.width);
      expect(png.readUInt32BE(20)).toBe(asset.height);
      expect(asset.source).toBe('generated');
    }
    expect(
      readFileSync('public/art/generated/camp-ui/panel.png').equals(readFileSync(`public/${frame.file}`)),
    ).toBe(true);
    expect(JSON.parse(readFileSync('public/art/generated-assets.json', 'utf8'))).toEqual(registry);
  });
});
