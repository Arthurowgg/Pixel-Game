import { describe, expect, it } from 'vitest';
import { CHUNK, LOAD_RADIUS, chunkDecor, chunkKey, chunkOf, chunkResources, isHomeChunk } from './chunks';
import { POND, distance } from './data';
import { DECOR_KINDS } from './decor';
import { Simulation, createGame } from './simulation';

describe('the endless forest', () => {
  it('generates the same chunk every time and a different one next door', () => {
    expect(chunkResources(42, 5, 7)).toEqual(chunkResources(42, 5, 7));
    expect(JSON.stringify(chunkResources(42, 5, 7))).not.toBe(JSON.stringify(chunkResources(42, 6, 7)));
    expect(JSON.stringify(chunkResources(42, 5, 7))).not.toBe(JSON.stringify(chunkResources(43, 5, 7)));
  });

  it('leaves the authored home valley alone', () => {
    expect(isHomeChunk(0, 0)).toBe(true);
    expect(isHomeChunk(3, 2)).toBe(true);
    expect(isHomeChunk(-1, 0)).toBe(false);
    expect(chunkResources(42, 0, 0)).toEqual([]);
    expect(chunkDecor(42, 0, 0)).toEqual([]);
  });

  it('keeps generated props inside their own chunk, spaced out and off the pond', () => {
    for (const [cx, cy] of [
      [4, 4],
      [-3, 7],
      [12, -5],
    ]) {
      const resources = chunkResources(11, cx, cy);
      expect(resources.length).toBeGreaterThan(4);
      for (const resource of resources) {
        expect(resource.x).toBeGreaterThanOrEqual(cx * CHUNK);
        expect(resource.x).toBeLessThan((cx + 1) * CHUNK);
        expect(resource.y).toBeGreaterThanOrEqual(cy * CHUNK);
        expect(resource.y).toBeLessThan((cy + 1) * CHUNK);
        expect(distance(resource, POND)).toBeGreaterThan(60);
        expect(resource.hp).toBeGreaterThan(0);
      }
      for (const a of resources)
        for (const b of resources) if (a !== b) expect(distance(a, b)).toBeGreaterThanOrEqual(20);
      const props = chunkDecor(11, cx, cy);
      expect(props.length).toBeGreaterThan(0);
      for (const prop of props) {
        expect(DECOR_KINDS).toContain(prop.kind);
        expect(prop.x).toBeGreaterThanOrEqual(cx * CHUNK);
        expect(prop.y).toBeGreaterThanOrEqual(cy * CHUNK);
      }
    }
  });

  it('streams chunks in as the survivor walks and keeps the home valley loaded', () => {
    const sim = new Simulation(createGame('Rover', 'explorer', 42));
    const home = sim.state.resources.length;
    const homeMe = sim.state.resources.filter((resource) => chunkOf(resource).cx <= 3);
    expect(homeMe.length).toBe(home);

    sim.state.player = { x: 5000, y: 5000 };
    sim.update(1 / 60);
    const generated = sim.state.resources.filter((resource) => resource.id >= 1000);
    expect(generated.length).toBeGreaterThan(40);
    const center = chunkOf(sim.state.player);
    for (const resource of generated) {
      const chunk = chunkOf(resource);
      expect(Math.abs(chunk.cx - center.cx)).toBeLessThanOrEqual(LOAD_RADIUS);
      expect(Math.abs(chunk.cy - center.cy)).toBeLessThanOrEqual(LOAD_RADIUS);
    }

    // Walking far away drops the old window but never the authored home props.
    sim.state.player = { x: 40_000, y: 40_000 };
    sim.update(1 / 60);
    expect(sim.state.resources.filter((resource) => resource.id < 1000)).toHaveLength(home);
    // 25 resident chunks, capped at 46 placements each, plus the home valley.
    expect(sim.state.resources.length).toBeLessThan(home + 25 * 46);
  });

  it('names chunks and chunks points consistently', () => {
    expect(chunkOf({ x: 0, y: 0 })).toEqual({ cx: 0, cy: 0 });
    expect(chunkOf({ x: CHUNK, y: -1 })).toEqual({ cx: 1, cy: -1 });
    expect(chunkKey(-2, 3)).toBe('-2,3');
  });
});

describe('streaming stays inside the save budget', () => {
  it('adopts chunks from a loaded save instead of regenerating them', () => {
    const sim = new Simulation(createGame('Reload', 'explorer', 42));
    sim.state.player = { x: 6000, y: 6000 };
    sim.update(1 / 60);
    const first = sim.state.resources.length;
    const ids = sim.state.resources.map((resource) => resource.id);
    expect(new Set(ids).size).toBe(ids.length);
    // Reloading the same save must not stack a second copy of the same chunks.
    const reloaded = new Simulation(JSON.parse(JSON.stringify(sim.state)) as typeof sim.state);
    reloaded.update(1 / 60);
    // The outer ring of the window is pruned on load, never duplicated.
    expect(reloaded.state.resources.length).toBeLessThanOrEqual(first);
    const reloadedIds = reloaded.state.resources.map((resource) => resource.id);
    expect(new Set(reloadedIds).size).toBe(reloadedIds.length);
    expect(first).toBeLessThan(2000);
  });
});
