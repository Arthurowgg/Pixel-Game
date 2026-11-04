import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { atWorkbench, blocksWorkbench, MAX_CRAFT_BATCH, recipeStation } from './crafting';
import { CAMP, RECIPES, WORKBENCH } from './data';
import registry from './generated-assets.json';
import { createGame, Simulation } from './simulation';
import { DIRECTIONS, GameInput, moveWithCollision, touchMovementKeys } from './movement';
import { CLIPS, playerPose } from './animation';
import { isGameState } from './storage';

const fresh = () => {
  const sim = new Simulation(createGame('Rowan', 'explorer', 42));
  Object.assign(sim.state.inventory, { wood: 60, stone: 30, fiber: 40, berries: 10, water: 5, mushroom: 3 });
  return sim;
};

describe('a real campsite crafting table', () => {
  it('is available at the initial clearing without replacing the first gathering prompt', () => {
    const sim = fresh();
    expect(sim.view().workbenchNearby).toBe(true);
    expect(sim.nearest()?.kind).toBe('tree');
    expect(atWorkbench({ x: 200, y: 200 })).toBe(false);
  });
  it('opens the workshop with E without consuming items or starting an animation', () => {
    const sim = fresh();
    sim.state.player = { x: WORKBENCH.x, y: WORKBENCH.y + 20 };
    const inventory = { ...sim.state.inventory };
    sim.onOpenCrafting = vi.fn();
    expect(sim.nearest()?.kind).toBe('workbench');
    expect(sim.interact()).toBe(true);
    expect(sim.onOpenCrafting).toHaveBeenCalledTimes(1);
    expect(sim.state.inventory).toEqual(inventory);
    expect(sim.action).toBeNull();
    expect(sim.interact()).toBe(false);
  });
  it.each(['pickaxe', 'shelter'] as const)(
    'requires the table for %s and rechecks before spending',
    (item) => {
      const sim = fresh();
      expect(sim.canCraft(item)).toBe(true);
      sim.state.player = { x: 500, y: 500 };
      const before = { ...sim.state.inventory };
      expect(sim.craft(item)).toBe(false);
      expect(sim.state.inventory).toEqual(before);
      expect(sim.toasts.at(-1)?.text).toContain('crafting table');
      sim.state.player = { x: WORKBENCH.x, y: WORKBENCH.y + 20 };
      sim.state.fires = [];
      expect(sim.craft(item)).toBe(true);
    },
  );
  it('still allows basic field recipes anywhere, but keeps cooking tied to burning fire', () => {
    const sim = fresh();
    sim.state.player = { x: 300, y: 300 };
    for (const item of ['campfire', 'bandage', 'torch'] as const) expect(sim.canCraft(item)).toBe(true);
    expect(sim.canCraft('meal')).toBe(false);
    expect(sim.canCraft('tea')).toBe(false);
    sim.state.player = { ...CAMP };
    sim.state.fires[0].fuel = 0;
    expect(sim.canCraft('tea')).toBe(false);
    sim.state.fires[0].fuel = 50;
    expect(sim.canCraft('tea')).toBe(true);
    expect(recipeStation(RECIPES.find((recipe) => recipe.id === 'shelter')!)).toBe('Crafting table');
  });
  it('crafts a whole batch atomically with exact costs and one recipe discovery', () => {
    const sim = fresh();
    expect(sim.craft('torch', 4)).toBe(true);
    expect(sim.state.inventory).toMatchObject({ wood: 48, fiber: 32, torch: 4 });
    expect(sim.state.crafted.filter((item) => item === 'torch')).toHaveLength(1);
    expect(sim.state.journal[0].text).toContain('4 × pine torch');
    const before = { ...sim.state.inventory };
    expect(sim.craft('torch', 17)).toBe(false);
    expect(sim.state.inventory).toEqual(before);
    expect(sim.maxCraftable('torch')).toBe(16);
  });
  it.each([0, -1, 1.5, NaN, Infinity, 100])('rejects an invalid batch of %s without spending', (quantity) => {
    const sim = fresh();
    const before = { ...sim.state.inventory };
    expect(sim.craft('torch', quantity)).toBe(false);
    expect(sim.canCraft('torch', quantity)).toBe(false);
    expect(sim.state.inventory).toEqual(before);
  });
  it('caps bulk crafting and never exceeds the save format’s item limit', () => {
    const sim = fresh();
    Object.assign(sim.state.inventory, { wood: 1e6, fiber: 1e6 });
    expect(sim.maxCraftable('torch')).toBe(MAX_CRAFT_BATCH);
    sim.state.inventory.torch = 999999;
    expect(sim.maxCraftable('torch')).toBe(1);
    expect(sim.craft('torch', 2)).toBe(false);
    expect(sim.craft('torch')).toBe(true);
    expect(sim.maxCraftable('torch')).toBe(0);
    expect(isGameState(sim.state)).toBe(true);
  });
  it('keeps the furniture solid and refuses to place a building through it', () => {
    const sim = fresh();
    expect(blocksWorkbench(WORKBENCH)).toBe(true);
    expect(sim.collision(WORKBENCH)).toBe(true);
    expect(blocksWorkbench({ x: WORKBENCH.x, y: WORKBENCH.y + 20 })).toBe(false);
    sim.state.player = { x: WORKBENCH.x - 35, y: WORKBENCH.y - 18 };
    sim.state.inventory.campfire = 1;
    sim.state.resources = [];
    sim.state.fires = [];
    expect(sim.use('campfire')).toBe(false);
    expect(sim.state.inventory.campfire).toBe(1);
  });
  it('safely moves old saves out of the new table footprint without resetting their supplies', () => {
    const state = createGame('Existing camp', 'survivor', 42);
    state.player = { ...WORKBENCH };
    state.inventory.wood = 23;
    const sim = new Simulation(state);
    expect(sim.collision(sim.state.player)).toBe(false);
    expect(Math.hypot(sim.state.player.x - WORKBENCH.x, sim.state.player.y - WORKBENCH.y)).toBeLessThan(33);
    expect(sim.state.inventory.wood).toBe(23);
    expect(isGameState(sim.state)).toBe(true);
  });
  it('ships all six generated sources, including table anchor and nine-slice frame metadata', () => {
    const assets = [
      ...Object.values(registry.scenes),
      registry.objects.workbench,
      registry.frames.workshop,
      registry.icons.pineEmblem,
      registry.icons.workbench,
    ];
    expect(new Set(assets.map((asset) => asset.file)).size).toBe(6);
    for (const asset of assets) {
      const png = readFileSync(`public/${asset.file}`);
      expect(png.readUInt32BE(16)).toBe(asset.width);
      expect(png.readUInt32BE(20)).toBe(asset.height);
      expect(png.equals(readFileSync(`public/${asset.sourceAsset}`))).toBe(true);
    }
    expect(registry.objects.workbench.anchor[1]).toBeLessThan(registry.objects.workbench.height);
  });
});

describe('stable faces, connected strides, and diagonal control', () => {
  it('holds the neutral idle pose instead of repainting the face or detaching boots', () => {
    const sim = fresh();
    for (const direction of DIRECTIONS) {
      sim.state.direction = direction;
      for (const time of [0, 0.5, 1.5, 2, 3.5, 4]) {
        sim.state.time = time;
        const pose = playerPose(sim);
        expect(pose.frame).toBe(0);
        expect(pose.flip).toBe(direction.includes('left'));
        expect(CLIPS[pose.bodyName]).toBeDefined();
      }
    }
  });
  it('tries a clear diagonal before a blocked intermediate horizontal probe', () => {
    expect(moveWithCollision({ x: 0, y: 0 }, 1, 1, (point) => point.x > 0 && point.y === 0)).toEqual({
      x: 1,
      y: 1,
    });
  });
  it('cannot tunnel through a small obstacle even in a long update', () => {
    const position = moveWithCollision(
      { x: 0, y: 0 },
      100,
      0,
      (point) => Math.hypot(point.x - 10, point.y) < 2,
    );
    expect(position.x).toBeLessThanOrEqual(8);
    expect(position.y).toBe(0);
  });
  it('faces actual travel while sliding at the boundary, not the blocked diagonal intent', () => {
    const sim = fresh();
    sim.state.resources = [];
    sim.state.player = { x: 16, y: 500 };
    sim.keys.add('w');
    sim.keys.add('a');
    sim.update(0.05);
    expect(sim.state.player.x).toBe(16);
    expect(sim.state.player.y).toBeLessThan(500);
    expect(sim.state.direction).toBe('up');
  });
  it('arrives at nearby diagonal click targets without overshooting or facing jitter', () => {
    const sim = fresh();
    sim.state.resources = [];
    sim.state.player = { x: 500, y: 500 };
    sim.target = { x: 501, y: 501 };
    sim.update(0.05);
    expect(sim.state.player).toEqual({ x: 501, y: 501 });
    expect(sim.state.direction).toBe('down-right');
    sim.update(0.05);
    expect(sim.target).toBeNull();
    expect(sim.moving).toBe(false);
    expect(sim.state.direction).toBe('down-right');
  });
  it('lets one captured thumb change sector, rest centrally, or leave the pad', () => {
    expect(touchMovementKeys(0.8, -0.8)).toEqual(['w', 'd']);
    expect(touchMovementKeys(-0.8, 0.8)).toEqual(['s', 'a']);
    expect(touchMovementKeys(0, 0)).toEqual([]);
    expect(touchMovementKeys(2, 0)).toEqual([]);
    const keys = new Set<string>(),
      input = new GameInput(keys);
    input.key('w', true);
    input.press(7, ['d']);
    input.press(7, touchMovementKeys(-0.8, 0.8));
    expect(input.owns(7)).toBe(true);
    expect([...keys].sort()).toEqual(['a', 's', 'w']);
    input.release(7);
    expect([...keys]).toEqual(['w']);
    expect(input.owns(7)).toBe(false);
  });
});
