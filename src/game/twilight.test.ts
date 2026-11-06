import { afterEach, describe, expect, it, vi } from 'vitest';
import * as animation from './animation';
import { BERRY_COLLECT_TIME, CAMP, RESOURCE_HP, SPAWN, SPRING, TORCH_DURATION } from './data';
import { daylightAt, darknessAt, weatherAt, weatherTarget, WeatherTransition } from './climate';
import {
  cellAt,
  cellCenter,
  EXPLORE_CELLS,
  exploredPercent,
  initialExploration,
  revealAround,
} from './exploration';
import { FOREST_LANDMARKS, FOREST_TRAILS, trailDistance, inPond } from './forest';
import { ForestLighting, TORCH_LIGHT_RADIUS, worldLights } from './lighting';
import { discoveredLandmarks, drawMap, mapViewport } from './cartography';
import { createGame, createWorld, Simulation } from './simulation';
import { isGameState, migrateGame } from './storage';
import type { GameState } from './types';

let rendererStub: { fillStyles: string[]; gradients: number; texts: string[] } | null = null;
function stubCanvas() {
  const record = { fillStyles: [] as string[], gradients: 0, texts: [] as string[] };
  rendererStub = record;
  const target: Record<string, unknown> = {
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    fillStyle: '#000',
    font: '10px sans-serif',
    textAlign: 'left',
    imageSmoothingEnabled: false,
    createRadialGradient: () => {
      record.gradients++;
      return { addColorStop: vi.fn() };
    },
    createPattern: () => ({}) as CanvasPattern,
    fillRect: vi.fn(() => record.fillStyles.push(String(target.fillStyle))),
    fillText: vi.fn((text: string) => record.texts.push(text)),
    measureText: (text: string) => ({ width: text.length * 6 }),
  };
  const ctx = new Proxy(target, {
    get: (object, key: string) => (object[key] ??= vi.fn()),
  }) as unknown as CanvasRenderingContext2D;
  const canvas = {
    clientWidth: 600,
    clientHeight: 467,
    width: 600,
    height: 467,
    dataset: {} as Record<string, string>,
    getContext: () => ctx,
  } as unknown as HTMLCanvasElement;
  vi.stubGlobal('document', {
    createElement: () => ({ getContext: () => ctx, width: 0, height: 0, dataset: {} }),
  });
  return { canvas, ctx };
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  rendererStub = null;
});

describe('the remade woodland', () => {
  it('plants every resource off the trail and outside water, leaving the arrival clearing readable', () => {
    const world = createWorld(42);
    const starters = world.slice(0, 8);
    expect(starters.map((resource) => resource.kind)).toEqual([
      'tree',
      'tree',
      'tree',
      'stone',
      'berries',
      'fiber',
      'fiber',
      'mushroom',
    ]);
    for (const tree of starters.filter((resource) => ['tree', 'stone'].includes(resource.kind)))
      expect(trailDistance(tree)).toBeGreaterThan(4);
    for (const resource of world) {
      expect(inPond(resource)).toBe(false);
      if (resource.kind === 'tree' || resource.kind === 'stone')
        expect(trailDistance(resource)).toBeGreaterThan(4);
    }
    expect(world.filter((resource) => resource.kind === 'tree').length).toBeGreaterThanOrEqual(200);
  });
  it('keeps five connected trails and a camp spur rather than one painted stripe', () => {
    expect(FOREST_TRAILS).toHaveLength(5);
    expect(Math.min(...FOREST_TRAILS.map((trail) => trail.width))).toBeGreaterThan(15);
    const gate = FOREST_TRAILS[4].points.at(-1)!;
    expect(Math.abs(gate.x - CAMP.x)).toBeLessThan(8);
    expect(gate.y).toBeGreaterThan(CAMP.y + 80);
    expect(FOREST_LANDMARKS).toHaveLength(3);
  });
});

describe('travel-time weather and darkness', () => {
  it('keeps a continuous clock: noon is bright, midnight is nearly black', () => {
    expect(daylightAt(60)).toBeCloseTo(1, 5);
    expect(daylightAt(120)).toBeCloseTo(0, 5);
    expect(darknessAt(120, weatherTarget('clear'))).toBeGreaterThan(0.9);
    expect(darknessAt(60, weatherTarget('clear'))).toBeLessThan(0.05);
    expect(darknessAt(60, weatherTarget('storm'))).toBeGreaterThan(darknessAt(60, weatherTarget('clear')));
  });
  it('eases between fronts instead of popping, and resumes the same blend after a reload', () => {
    const transition = new WeatherTransition('clear', 0);
    transition.change('storm', 10);
    expect(transition.at(10)).toMatchObject({ storm: 0, rain: 0 });
    const midway = transition.at(13.5);
    expect(midway.storm).toBeGreaterThan(0.3);
    expect(midway.storm).toBeLessThan(0.7);
    expect(transition.at(17)).toMatchObject({ storm: 1, rain: 1, cloud: 1 });
    expect(WeatherTransition.fromClock('storm', 60).at(60).storm).toBe(1);
    expect(weatherAt(20)).toBe('clear');
  });
});

describe('firelight and short torches', () => {
  it('burns a torch for a short, finite time and keeps its light on the survivor only while held', () => {
    const sim = new Simulation(createGame('Fern', 'survivor', 7));
    sim.state.inventory.torch = 2;
    sim.state.fires = [];
    sim.equip('torch');
    sim.useHeld();
    sim.update(0.4);
    expect(sim.state.torchUntil - sim.state.time).toBeGreaterThan(TORCH_DURATION - 1);
    expect(sim.state.torchUntil - sim.state.time).toBeLessThanOrEqual(TORCH_DURATION);
    expect(sim.view().torchSeconds).toBeGreaterThan(TORCH_DURATION - 1);
    expect(worldLights(sim.state, sim.torchActive).some((light) => light.source === 'torch')).toBe(true);
    sim.state.time += TORCH_DURATION;
    expect(sim.torchLit).toBe(false);
    expect(sim.view().torchSeconds).toBe(0);
    expect(worldLights(sim.state, sim.torchActive).some((light) => light.source === 'torch')).toBe(false);
  });
  it('paints a real darkness mask with cut-outs at fires, and still darkens when decoration is off', () => {
    const { ctx } = stubCanvas();
    const sim = new Simulation(createGame('Fern', 'survivor', 7));
    sim.state.time = 120;
    sim.state.fires = [{ ...CAMP, id: 0, fuel: 60 }];
    const lighting = new ForestLighting();
    const darkness = lighting.draw(ctx, sim, { x: 760, y: 660 }, 600, 467);
    expect(darkness).toBeGreaterThan(0.8);
    expect(rendererStub!.fillStyles.some((style) => style.startsWith('rgba(5, 12, 19'))).toBe(true);
    expect(rendererStub!.gradients).toBeGreaterThan(0);
    const torch = worldLights({ ...sim.state, fires: [] }, true)[0];
    expect(torch.source).toBe('torch');
    expect(torch.radius).toBe(TORCH_LIGHT_RADIUS);
    expect(TORCH_DURATION).toBeLessThanOrEqual(40);
  });
});

describe('timed berries and tougher materials', () => {
  it('gathers berries only after the full circle fills, then clears the action', () => {
    const sim = new Simulation(createGame('Fern', 'survivor', 7));
    sim.state.resources = [
      {
        id: 0,
        kind: 'berries',
        x: sim.state.player.x + 20,
        y: sim.state.player.y,
        hp: 1,
        readyAt: 0,
        scale: 1,
        variant: 0.4,
      },
    ];
    sim.state.inventory.berries = 0;
    expect(sim.interact()).toBe(true);
    sim.update(BERRY_COLLECT_TIME / 2);
    expect(sim.state.inventory.berries).toBe(0);
    expect(sim.collecting?.progress).toBeGreaterThan(0.4);
    sim.update(BERRY_COLLECT_TIME / 2 + 0.02);
    expect(sim.state.inventory.berries).toBe(3);
    expect(sim.collecting).toBeNull();
    expect(sim.state.resources[0].hp).toBe(0);
  });
  it('makes trunks and boulders cost more than one swing', () => {
    expect(RESOURCE_HP.tree).toBeGreaterThan(3);
    expect(RESOURCE_HP.stone).toBeGreaterThan(2);
    expect(RESOURCE_HP.berries).toBe(1);
  });
});

describe('exploration that is earned and remembered', () => {
  it('reveals around the arrival clearing, never the whole forest, and never forgets cells', () => {
    const cells = initialExploration(SPAWN);
    expect(cells.length).toBeGreaterThan(20);
    expect(cells.length).toBeLessThan(300);
    expect(cells).not.toContain(cellAt(SPRING));
    expect(exploredPercent(cells)).toBeGreaterThan(0);
    expect(exploredPercent(cells)).toBeLessThan(35);
    const known = new Set(cells);
    const before = cells.length;
    const added = revealAround(cells, known, SPRING);
    expect(added).toBeGreaterThan(0);
    expect(cells.length).toBe(before + added);
    expect(new Set(cells).size).toBe(cells.length);
    expect(revealAround(cells, known, SPRING)).toBe(0);
    expect(cells.length).toBeLessThan(EXPLORE_CELLS);
    expect(cellCenter(cellAt(SPRING))).toEqual(cellCenter(cellAt(SPRING)));
  });
  it('hides the spring and every landmark until their cell has been visited', () => {
    const state = createGame('Fern', 'survivor', 7);
    expect(discoveredLandmarks(state)).toHaveLength(0);
    state.explored = [...state.explored, cellAt(SPRING), cellAt(FOREST_LANDMARKS[0])];
    const found = discoveredLandmarks(state).map((point) => point.name);
    expect(found).toContain('The Spring');
    expect(found).toContain(FOREST_LANDMARKS[0].name);
    expect(found).not.toContain(FOREST_LANDMARKS[1].name);
  });
});

describe('a hand-drawn field chart, not a spy camera', () => {
  it('never labels undiscovered places and reports honest charted progress', () => {
    const { canvas } = stubCanvas();
    const drawItem = vi.spyOn(animation, 'drawItem').mockImplementation(() => {});
    const state = createGame('Fern', 'survivor', 7);
    drawMap(canvas, state, undefined, true);
    const hidden = [canvas.dataset.landmarks, rendererStub!.texts.join(' ')].join(' ');
    expect(hidden).not.toMatch(/SPRING|WAYSTONE|FALLEN GROVE|MOSSY MEADOW/);
    expect(canvas.dataset.explored).toBe(String(exploredPercent(state.explored)));
    expect(canvas.dataset.revealedCells).toBe(String(new Set(state.explored).size));
    expect(drawItem).not.toHaveBeenCalledWith(
      expect.anything(),
      'water',
      expect.any(Number),
      expect.any(Number),
      expect.anything(),
    );
    drawItem.mockClear();
    state.explored = [...state.explored, cellAt(SPRING), cellAt(state.fires[0]), cellAt(state.player)];
    drawMap(canvas, state, undefined, true);
    expect(canvas.dataset.landmarks).toContain('The Spring');
    expect(rendererStub!.texts).toContain('THE SPRING');
    expect(drawItem).toHaveBeenCalledWith(
      expect.anything(),
      'water',
      expect.any(Number),
      expect.any(Number),
      expect.anything(),
    );
  });
  it('clamps zoom and panning inside the world instead of showing the void', () => {
    expect(mapViewport(9, { x: -400, y: 5000 }).zoom).toBe(4);
    expect(mapViewport(1, { x: -400, y: 5000 }).center).toEqual({ x: 900, y: 700 });
    const zoomed = mapViewport(3, { x: 0, y: 0 });
    expect(zoomed.center.x).toBeGreaterThan(0);
    expect(zoomed.center.y).toBeGreaterThan(0);
  });
});

describe('saving a remade forest without wrecking an old one', () => {
  const legacy = (): Record<string, unknown> => {
    const state = JSON.parse(JSON.stringify(createGame('Fern', 'survivor', 7))) as Record<string, unknown>;
    delete state.forestVersion;
    delete state.explored;
    const caps: Record<string, number> = { tree: 3, stone: 2, berries: 1, fiber: 1, mushroom: 1 };
    const resources = state.resources as { kind: string; hp: number }[];
    for (const resource of resources) resource.hp = Math.min(caps[resource.kind], resource.hp);
    resources[0].kind = 'tree';
    resources[0].hp = 1;
    const stone = resources.find((resource) => resource.kind === 'stone')!;
    stone.hp = 2;
    state.inventory = { ...(state.inventory as object), torch: 1 };
    state.time = 100;
    state.torchUntil = 400;
    return state;
  };
  it('preserves old coordinates but upgrades damage proportionally, once', () => {
    const upgraded = migrateGame(legacy());
    expect(upgraded).not.toBeNull();
    expect(upgraded!.forestVersion).toBe(1);
    expect(upgraded!.resources[0]).toMatchObject({ kind: 'tree', hp: 2 });
    expect(upgraded!.resources.find((resource) => resource.kind === 'stone')).toMatchObject({ hp: 4 });
    expect(upgraded!.explored.length).toBeGreaterThan(0);
    expect(upgraded!.torchUntil - upgraded!.time).toBeLessThanOrEqual(TORCH_DURATION);
    expect(isGameState(upgraded)).toBe(true);
    const again = migrateGame(JSON.parse(JSON.stringify(upgraded)));
    expect(again!.resources[0].hp).toBe(2);
    expect(again!.forestVersion).toBe(1);
  });
  it('rejects malformed exploration rather than silently resetting a saved map', () => {
    const bad = JSON.parse(JSON.stringify(createGame('Fern', 'survivor', 7))) as GameState;
    (bad as unknown as Record<string, unknown>).explored = [1, 1];
    expect(isGameState(bad)).toBe(false);
    (bad as unknown as Record<string, unknown>).explored = [1.5];
    expect(isGameState(bad)).toBe(false);
    (bad as unknown as Record<string, unknown>).explored = [EXPLORE_CELLS];
    expect(isGameState(bad)).toBe(false);
  });
});
