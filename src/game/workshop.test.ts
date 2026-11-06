import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { atWorkbench, blocksWorkbench, MAX_CRAFT_BATCH, recipeStation } from './crafting';
import { CAMP, RECIPES } from './data';
import registry from './generated-assets.json';
import { createGame, Simulation } from './simulation';
import { DIRECTIONS, GameInput, moveWithCollision, touchMovementKeys } from './movement';
import { CLIPS, playerPose } from './animation';
import { isGameState } from './storage';

const WORKBENCH = { id: 0, x: 940, y: 738 };
const placed = (sim: Simulation) => {
  sim.state.workbenches = [{ ...WORKBENCH }];
  sim.state.player = { x: 940, y: 758 };
};
const fresh = () => {
  const sim = new Simulation(createGame('Rowan', 'explorer', 42));
  Object.assign(sim.state.inventory, { wood: 60, stone: 30, fiber: 40, berries: 10, water: 5, mushroom: 3 });
  return sim;
};

describe('a player-built workbench', () => {
  it('starts without a station or kit while preserving the first gathering prompt', () => {
    const sim = fresh();
    expect(sim.view().workbenchNearby).toBe(false);
    expect(sim.state.workbenches).toEqual([]);
    expect(sim.state.inventory.workbench).toBe(0);
    expect(sim.nearest()?.kind).toBe('tree');
    expect(atWorkbench({ x: 200, y: 200 }, sim.state.workbenches)).toBe(false);
  });
  it('opens the workshop with E without consuming items or starting an animation', () => {
    const sim = fresh();
    placed(sim);
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
      placed(sim);
      expect(sim.canCraft(item)).toBe(false);
      expect(sim.canCraft(item, 1, 0)).toBe(true);
      sim.state.player = { x: 500, y: 500 };
      const before = { ...sim.state.inventory };
      expect(sim.craft(item, 1, 0)).toBe(false);
      expect(sim.state.inventory).toEqual(before);
      expect(sim.toasts.at(-1)?.text).toContain('workbench');
      sim.state.player = { x: WORKBENCH.x, y: WORKBENCH.y + 20 };
      sim.state.fires = [];
      expect(sim.craft(item, 1, 0)).toBe(true);
    },
  );
  it('still allows basic field recipes anywhere, but keeps cooking tied to burning fire', () => {
    const sim = fresh();
    sim.state.player = { x: 300, y: 300 };
    for (const item of ['workbench', 'bandage', 'torch'] as const) expect(sim.canCraft(item)).toBe(true);
    expect(sim.canCraft('meal')).toBe(false);
    expect(sim.canCraft('tea', 1, 0)).toBe(false);
    placed(sim);
    sim.state.player = { ...CAMP };
    sim.state.fires[0].fuel = 0;
    expect(sim.canCraft('tea', 1, 0)).toBe(false);
    sim.state.fires[0].fuel = 50;
    expect(sim.canCraft('tea', 1, 0)).toBe(true);
    expect(recipeStation(RECIPES.find((recipe) => recipe.id === 'shelter')!)).toBe('Workbench');
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
    placed(sim);
    expect(blocksWorkbench(WORKBENCH, sim.state.workbenches)).toBe(true);
    expect(sim.collision(WORKBENCH)).toBe(true);
    expect(blocksWorkbench({ x: WORKBENCH.x, y: WORKBENCH.y + 20 }, sim.state.workbenches)).toBe(false);
    sim.state.player = { x: WORKBENCH.x - 35, y: WORKBENCH.y - 18 };
    sim.state.inventory.campfire = 1;
    sim.state.resources = [];
    sim.state.fires = [];
    expect(sim.use('campfire')).toBe(false);
    expect(sim.state.inventory.campfire).toBe(1);
  });
  it('safely moves saves out of a placed workbench footprint without resetting their supplies', () => {
    const state = createGame('Existing camp', 'survivor', 42);
    state.workbenches = [{ ...WORKBENCH }];
    state.player = { x: WORKBENCH.x, y: WORKBENCH.y };
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

describe('stable faces, connected strides, and cardinal control', () => {
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
  it('never turns a mixed displacement into a diagonal or a collision bypass', () => {
    expect(moveWithCollision({ x: 0, y: 0 }, 1, 1, (point) => point.x > 0 && point.y === 0)).toEqual({
      x: 0,
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
  it('stays still at a boundary until the blocked direction is released', () => {
    const sim = fresh();
    sim.state.resources = [{ id: 0, kind: 'tree', x: 6, y: 500, hp: 6, readyAt: 0, scale: 1, variant: 0 }];
    sim.state.player = { x: 16, y: 500 };
    sim.keys.add('w');
    sim.keys.add('a');
    sim.update(0.05);
    expect(sim.state.player).toEqual({ x: 16, y: 500 });
    expect(sim.state.direction).toBe('down');
    sim.keys.delete('a');
    sim.update(0.05);
    expect(sim.state.player.x).toBe(16);
    expect(sim.state.player.y).toBeLessThan(500);
    expect(sim.state.direction).toBe('up');
  });
  it('reaches off-axis click targets in two straight legs without overshooting', () => {
    const sim = fresh();
    sim.state.resources = [];
    sim.state.player = { x: 500, y: 500 };
    sim.target = { x: 501, y: 501 };
    sim.update(0.05);
    expect(sim.state.player).toEqual({ x: 500, y: 501 });
    expect(sim.state.direction).toBe('down');
    sim.update(0.05);
    expect(sim.state.player).toEqual({ x: 501, y: 501 });
    expect(sim.state.direction).toBe('right');
    sim.update(0.05);
    expect(sim.target).toBeNull();
    expect(sim.moving).toBe(false);
    expect(sim.state.direction).toBe('right');
  });
  it('lets one captured thumb change sector, rest centrally, or leave the pad', () => {
    expect(touchMovementKeys(0.8, -0.8)).toEqual(['w']);
    expect(touchMovementKeys(-0.8, 0.8)).toEqual(['s']);
    expect(touchMovementKeys(0, 0)).toEqual([]);
    expect(touchMovementKeys(2, 0)).toEqual([]);
    const keys = new Set<string>(),
      input = new GameInput(keys);
    input.key('w', true);
    input.press(7, ['d']);
    input.press(7, touchMovementKeys(-0.8, 0.8));
    expect(input.owns(7)).toBe(true);
    expect([...keys].sort()).toEqual(['s', 'w']);
    input.release(7);
    expect([...keys]).toEqual(['w']);
    expect(input.owns(7)).toBe(false);
  });
});
