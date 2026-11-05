import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { CAMP, CAMP_BENCH, ITEMS, RECIPES, SPAWN, distance } from './data';
import { atWorkbench, blocksWorkbench, handRecipes } from './crafting';
import { blocksCampBench, routeToBench } from './camp';
import { inventoryItems } from './inventory';
import { createGame, Simulation } from './simulation';
import { isGameState, migrateGame } from './storage';
import { WOLF_ATTACKS, WOLF_WINDUP, wolfHealth } from './wolves';
import registry from './generated-assets.json';
import type { ItemId } from './types';

const advance = (sim: Simulation, seconds: number) => {
  for (let left = seconds; left > 0.000001; left -= 0.01) sim.update(Math.min(left, 0.01));
};
const fresh = () => {
  const sim = new Simulation(createGame('Ash', 'survivor', 42));
  sim.state.player = { x: 500, y: 500 };
  sim.state.resources = [];
  sim.state.fires = [];
  return sim;
};
const camp = () => {
  const sim = new Simulation(createGame('Ash', 'survivor', 42));
  sim.state.player = { x: 900, y: 772 };
  sim.state.inventory.wood = 3;
  sim.state.fires[0].fuel = 30;
  return sim;
};
const supply = (sim: Simulation) => {
  for (const key of Object.keys(ITEMS) as ItemId[]) sim.state.inventory[key] = 30;
};

describe('handcraft first, a workshop earned', () => {
  it('starts with a resting bench but no workbench or workbench kit', () => {
    const state = createGame('Ash', 'survivor', 42);
    expect(state.player).toEqual(SPAWN);
    expect(state.workbenches).toEqual([]);
    expect(state.inventory.workbench).toBe(0);
    expect(new Simulation(state).workbenchNearby).toBe(false);
    expect(blocksCampBench({ x: CAMP_BENCH.x, y: CAMP_BENCH.y - 10 })).toBe(true);
    expect(blocksCampBench(CAMP_BENCH)).toBe(false);
  });
  it('has exactly three hand-made essentials and gates the other five recipes', () => {
    expect(
      handRecipes(RECIPES)
        .map((recipe) => recipe.id)
        .sort(),
    ).toEqual(['bandage', 'torch', 'workbench']);
    expect(RECIPES.filter((recipe) => recipe.needsWorkbench)).toHaveLength(5);
  });
  it('makes the workbench from wood and fiber alone, without needing a station first', () => {
    const sim = fresh();
    Object.assign(sim.state.inventory, { wood: 6, fiber: 3, stone: 0 });
    expect(sim.craft('workbench')).toBe(true);
    expect(sim.state.inventory).toMatchObject({ wood: 0, fiber: 0, stone: 0, workbench: 1 });
    expect(sim.state.workbenches).toEqual([]);
    expect(sim.state.equipped).toBe('hatchet');
  });
  it.each(['pickaxe', 'campfire', 'shelter', 'meal', 'tea'] as const)(
    'cannot make %s through handcraft, even with supplies, fire and a nearby workbench',
    (item) => {
      const sim = fresh();
      supply(sim);
      sim.state.workbenches = [{ id: 7, x: 535, y: 500 }];
      sim.state.fires = [{ id: 0, x: 500, y: 540, fuel: 60 }];
      const before = { ...sim.state.inventory };
      expect(sim.craft(item)).toBe(false);
      expect(sim.state.inventory).toEqual(before);
      expect(sim.craft(item, 1, 7)).toBe(true);
    },
  );
  it('validates the actual chosen station, not just any nearby station', () => {
    const sim = fresh();
    supply(sim);
    sim.state.workbenches = [
      { id: 7, x: 535, y: 500 },
      { id: 9, x: 800, y: 500 },
    ];
    const before = { ...sim.state.inventory };
    for (const id of [9, 99, NaN]) expect(sim.craft('pickaxe', 1, id)).toBe(false);
    expect(sim.state.inventory).toEqual(before);
    sim.state.workbenches = [];
    expect(sim.craft('pickaxe', 1, 7)).toBe(false);
  });
  it('still requires fire as well as the selected workbench for both cooking recipes', () => {
    const sim = fresh();
    supply(sim);
    sim.state.workbenches = [{ id: 7, x: 535, y: 500 }];
    for (const item of ['tea', 'meal'] as const) {
      expect(sim.craft(item, 1, 7)).toBe(false);
      sim.state.fires = [{ id: 0, x: 500, y: 540, fuel: 0 }];
      expect(sim.craft(item, 1, 7)).toBe(false);
      sim.state.fires[0].fuel = 30;
      expect(sim.craft(item, 1, 7)).toBe(true);
      sim.state.fires = [];
    }
  });
  it('spends a kit once at placement contact and persists a smaller solid workbench', () => {
    const sim = fresh();
    sim.state.inventory.workbench = 1;
    sim.equip('workbench');
    const point = { x: 540, y: 520 };
    sim.aim = point;
    expect(sim.placementPreview).toMatchObject({ ...point, valid: true });
    expect(sim.useHeld(point)).toBe(true);
    expect(sim.state.workbenches).toHaveLength(0);
    advance(sim, 0.3);
    expect(sim.state.inventory.workbench).toBe(1);
    advance(sim, 0.05);
    expect(sim.state.workbenches).toEqual([{ ...point, id: 0 }]);
    expect(sim.state.inventory.workbench).toBe(0);
    advance(sim, 1);
    expect(sim.state.workbenches).toHaveLength(1);
    expect(blocksWorkbench(point, sim.state.workbenches)).toBe(true);
    expect(blocksWorkbench({ x: point.x + 19, y: point.y }, sim.state.workbenches)).toBe(false);
    expect(isGameState(sim.state)).toBe(true);
  });
  it('keeps an unplaced kit if the hand changes or a site becomes occupied before contact', () => {
    const sim = fresh();
    sim.state.inventory.workbench = 2;
    sim.equip('workbench');
    expect(sim.useHeld({ x: 540, y: 520 })).toBe(true);
    sim.equip('hatchet');
    advance(sim, 1);
    expect(sim.state.inventory.workbench).toBe(2);
    sim.equip('workbench');
    expect(sim.useHeld({ x: 540, y: 520 })).toBe(true);
    sim.state.fires.push({ id: 0, x: 540, y: 520, fuel: 20 });
    advance(sim, 1);
    expect(sim.state.inventory.workbench).toBe(2);
    expect(sim.state.workbenches).toHaveLength(0);
  });
  it.each([
    { x: 500, y: 500 },
    { x: 900, y: 900 },
    { x: NaN, y: 520 },
    { x: 540, y: Infinity },
    { x: 10, y: 10 },
  ])('rejects unreachable or invalid placement %o without consuming a kit', (point) => {
    const sim = fresh();
    sim.state.inventory.workbench = 1;
    sim.equip('workbench');
    expect(sim.useHeld(point)).toBe(false);
    expect(sim.state.inventory.workbench).toBe(1);
    expect(sim.action).toBeNull();
  });
  it('caps saved workbenches and marks an over-limit placement as blocked without spending the kit', () => {
    const sim = fresh();
    sim.state.workbenches = Array.from({ length: 100 }, (_, id) => ({
      id,
      x: 50 + (id % 20) * 80,
      y: 50 + Math.floor(id / 20) * 90,
    }));
    sim.state.inventory.workbench = 1;
    sim.equip('workbench');
    sim.aim = { x: 540, y: 520 };
    expect(sim.placementPreview?.valid).toBe(false);
    expect(sim.useHeld(sim.aim)).toBe(false);
    expect(sim.state.inventory.workbench).toBe(1);
    expect(isGameState(sim.state)).toBe(true);
    sim.state.workbenches.push({ id: 100, x: 540, y: 520 });
    expect(isGameState(sim.state)).toBe(false);
  });
  it('cannot build over a stump or the resting bench', () => {
    const sim = fresh();
    sim.state.inventory.workbench = 1;
    sim.state.resources = [
      { id: 1, kind: 'tree', hp: 0, readyAt: 200, x: 540, y: 520, scale: 1, variant: 0 },
    ];
    expect(sim.use('workbench', { x: 540, y: 520 })).toBe(false);
    sim.state.player = { x: CAMP_BENCH.x + 35, y: CAMP_BENCH.y };
    expect(sim.use('workbench', CAMP_BENCH)).toBe(false);
    expect(sim.state.inventory.workbench).toBe(1);
  });
  it('opens the specific placed workbench with E without equipping or spending anything', () => {
    const sim = fresh();
    sim.state.workbenches = [{ id: 42, x: 535, y: 500 }];
    const inventory = { ...sim.state.inventory };
    sim.onOpenCrafting = vi.fn();
    expect(sim.interact()).toBe(true);
    expect(sim.onOpenCrafting).toHaveBeenCalledWith(42);
    expect(sim.state.inventory).toEqual(inventory);
    expect(sim.state.equipped).toBe('hatchet');
    expect(atWorkbench(sim.state.player, sim.state.workbenches, 42)).toBe(true);
  });
});

describe('additive world and supply migration', () => {
  it('migrates old saves without gifting a free station or losing any supplies', () => {
    const state = createGame('Old camp', 'wild', 456);
    state.inventory.wood = 27;
    state.time = 98;
    const old = JSON.parse(JSON.stringify(state));
    delete old.workbenches;
    delete old.inventory.workbench;
    const migrated = migrateGame(old)!;
    expect(migrated.inventory).toMatchObject({ wood: 27, workbench: 0 });
    expect(migrated.workbenches).toEqual([]);
    expect(migrated.time).toBe(98);
    expect(migrated.player).toEqual(state.player);
  });
  it('preserves placed workbenches and rejects invalid or duplicate station IDs', () => {
    const state = createGame('Ash', 'survivor', 42);
    state.workbenches = [{ id: 7, x: 500, y: 500 }];
    state.inventory.workbench = 2;
    expect(migrateGame(JSON.parse(JSON.stringify(state)))).toEqual(state);
    for (const workbenches of [
      null,
      'bad',
      [{ id: -1, x: 500, y: 500 }],
      [{ id: 1, x: NaN, y: 500 }],
      [state.workbenches[0], state.workbenches[0]],
    ])
      expect(migrateGame({ ...state, workbenches })).toBeNull();
    expect(migrateGame({ ...state, inventory: { ...state.inventory, workbench: -1 } })).toBeNull();
  });
  it('accepts stronger spawned wolves but does not let malformed max health bypass validation', () => {
    const state = createGame('Ash', 'wild', 42);
    const wolf = { id: 1, x: 500, y: 500, hp: 5, maxHp: 5, cooldown: 1, scared: 0 };
    state.wolves = [wolf];
    expect(isGameState(state)).toBe(true);
    for (const maxHp of [1, 1.5, 7, NaN, Infinity, '5'])
      expect(isGameState({ ...state, wolves: [{ ...wolf, maxHp }] })).toBe(false);
    expect(isGameState({ ...state, wolves: [{ ...wolf, hp: 6 }] })).toBe(false);
  });
});

describe('a real seated state at the remade camp', () => {
  it('walks to the bench in cardinal legs, then switches to the whole seated state', () => {
    const sim = camp();
    let previous = { ...sim.state.player },
      travelled = 0,
      approached = false;
    for (let i = 0; i < 400; i++) {
      sim.update(0.01);
      const dx = sim.state.player.x - previous.x,
        dy = sim.state.player.y - previous.y;
      expect(Math.abs(dx) < 0.001 || Math.abs(dy) < 0.001).toBe(true);
      expect(Math.hypot(dx, dy)).toBeLessThanOrEqual(0.581);
      travelled += Math.hypot(dx, dy);
      previous = { ...sim.state.player };
      approached ||= sim.approachingCamp;
    }
    expect(approached).toBe(true);
    expect(travelled).toBeGreaterThan(50);
    expect(sim.seated).toBe(true);
    expect(sim.state.player).toEqual(CAMP_BENCH);
    expect(sim.view().camp).toMatchObject({ id: 0, seated: true });
    expect(sim.state.equipped).toBe('hatchet');
    expect(sim.state.inventory.wood).toBe(3);
  });
  it('finds a route around the solid back of the bench, or refuses a completely blocked seat', () => {
    const route = routeToBench({ x: CAMP_BENCH.x, y: CAMP_BENCH.y - 24 }, (p) => blocksCampBench(p));
    expect(route?.at(-1)).toEqual(CAMP_BENCH);
    expect(route!.length).toBeGreaterThan(2);
    expect(routeToBench({ x: 900, y: 772 }, () => true)).toBeNull();
  });
  it('does not teleport when manual movement cancels an approach', () => {
    const sim = camp();
    advance(sim, 0.7);
    expect(sim.approachingCamp).toBe(true);
    const position = { ...sim.state.player };
    sim.keys.add('d');
    advance(sim, 0.1);
    expect(sim.approachingCamp).toBe(false);
    expect(sim.seated).toBe(false);
    expect(sim.state.player.y).toBe(position.y);
    expect(sim.state.player.x - position.x).toBeCloseTo(5.8, 4);
  });
  it('right-click destinations cancel automatic seating instead of being overwritten', () => {
    const sim = camp();
    advance(sim, 0.7);
    sim.target = { x: 960, y: 772 };
    advance(sim, 0.1);
    expect(sim.approachingCamp).toBe(false);
    expect(sim.target).toEqual({ x: 960, y: 772 });
    expect(sim.seated).toBe(false);
  });
  it('keeps time and fuel live, feeds at contact while seated, and stands up on movement', () => {
    const sim = camp();
    advance(sim, 3);
    const fuel = sim.state.fires[0].fuel;
    expect(sim.feedFire(0)).toBe(true);
    advance(sim, 0.5);
    expect(sim.state.inventory.wood).toBe(3);
    expect(sim.seated).toBe(true);
    advance(sim, 0.1);
    expect(sim.state.inventory.wood).toBe(2);
    expect(sim.state.fires[0].fuel).toBeGreaterThan(fuel + 34);
    advance(sim, 0.5);
    expect(sim.seated).toBe(true);
    sim.keys.add('s');
    advance(sim, 0.1);
    expect(sim.seated).toBe(false);
    expect(sim.view().camp).toBeNull();
    expect(sim.state.player.y).toBeGreaterThan(CAMP_BENCH.y);
  });
  it('keeps the survivor seated while a wolf patrols past the lit hearth', () => {
    const sim = camp();
    advance(sim, 3);
    sim.state.weather = 'wolves';
    sim.feedFire(0);
    sim.state.wolves = [
      { id: 1, x: CAMP_BENCH.x + 60, y: CAMP_BENCH.y, hp: 4, maxHp: 4, cooldown: 0, scared: 0 },
    ];
    advance(sim, 1.2);
    expect(sim.seated).toBe(true);
    expect(sim.state.inventory.wood).toBe(2);
    expect(sim.view().camp?.id).toBe(0);
    expect(sim.view().wolvesNear).toBe(0);
  });
  it.each(['health', 'hunger', 'thirst', 'warmth'] as const)(
    'does not hide dangerously low %s behind camp UI',
    (need) => {
      const sim = camp();
      sim.state.needs[need] = 4;
      advance(sim, 1);
      expect(sim.seated).toBe(false);
      expect(sim.view().camp).toBeNull();
    },
  );
  it('does not serialize an in-progress walk or seated actor state', () => {
    const sim = camp();
    advance(sim, 3);
    const serialized = JSON.stringify(sim.state);
    expect(serialized).not.toMatch(/campApproach|campFocus|seated/);
    const restored = new Simulation(migrateGame(JSON.parse(serialized))!);
    expect(restored.seated).toBe(false);
    advance(restored, 0.7);
    expect(restored.seated).toBe(true);
    expect(restored.state.player).toEqual(CAMP_BENCH);
  });
});

describe('chopping aftermath and a harder night', () => {
  it('drops leaves at the axe contact, more on the final strike, and keeps them out of saves', () => {
    const sim = fresh();
    const tree = { id: 0, kind: 'tree' as const, x: 540, y: 500, hp: 3, scale: 1, variant: 0, readyAt: 0 };
    sim.state.resources = [tree];
    expect(sim.interact()).toBe(true);
    advance(sim, 0.3);
    expect(sim.fallingLeaves).toHaveLength(0);
    advance(sim, 0.05);
    expect(sim.fallingLeaves).toHaveLength(7);
    expect(tree.hp).toBe(2);
    expect(sim.state.inventory.wood).toBe(0);
    advance(sim, 0.36);
    sim.interact();
    advance(sim, 0.71);
    sim.interact();
    advance(sim, 0.35);
    expect(tree.hp).toBe(0);
    expect(sim.state.inventory.wood).toBe(4);
    expect(sim.fallingLeaves.length).toBeGreaterThanOrEqual(14);
    expect(JSON.stringify(sim.state)).not.toContain('fallingLeaves');
    const leaves = JSON.stringify(sim.fallingLeaves);
    sim.paused = true;
    advance(sim, 1);
    expect(JSON.stringify(sim.fallingLeaves)).toBe(leaves);
    sim.paused = false;
    advance(sim, 3);
    expect(sim.fallingLeaves).toHaveLength(0);
    expect(tree.hp).toBe(0);
  });
  it.each(['explorer', 'survivor', 'wild'] as const)(
    'spawns stronger, saveable wolves for %s',
    (difficulty) => {
      const sim = fresh();
      sim.state.difficulty = difficulty;
      sim.state.time = 119.99;
      sim.state.weather = 'cold';
      advance(sim, 0.02);
      expect(sim.state.wolves.length).toBeGreaterThan(0);
      expect(
        sim.state.wolves.every((wolf) => wolf.hp === wolfHealth(difficulty) && wolf.maxHp === wolf.hp),
      ).toBe(true);
      expect(wolfHealth(difficulty)).toBeGreaterThan(2);
      expect(isGameState(sim.state)).toBe(true);
    },
  );
  it('gives the long heavy pounce its own longer warning and locked landing point', () => {
    const sim = fresh();
    sim.state.time = 120;
    sim.state.weather = 'wolves';
    sim.state.wolves = [{ id: 1, x: 590, y: 500, hp: 4, maxHp: 4, cooldown: 0, scared: 0 }];
    advance(sim, 0.01);
    const mind = sim.wolfPack.minds.get(1)!;
    expect(mind.attack).toBe('pounce');
    expect(mind.phase).toBe('windup');
    expect(WOLF_ATTACKS.pounce.windup).toBeGreaterThan(WOLF_WINDUP);
    const target = { ...mind.target };
    sim.keys.add('w');
    advance(sim, 1.5);
    expect(mind.target).toEqual(target);
    expect(sim.state.needs.health).toBe(100);
  });
  it('applies the stronger pounce once at contact, not during its telegraph or every frame', () => {
    const sim = fresh();
    sim.state.time = 120;
    sim.state.weather = 'wolves';
    sim.state.wolves = [{ id: 1, x: 590, y: 500, hp: 4, maxHp: 4, cooldown: 0, scared: 0 }];
    advance(sim, 0.75);
    expect(sim.state.needs.health).toBe(100);
    advance(sim, 0.5);
    const health = sim.state.needs.health;
    expect(health).toBeCloseTo(100 - WOLF_ATTACKS.pounce.damage * 0.9, 5);
    advance(sim, 0.4);
    expect(sim.state.needs.health).toBe(health);
  });
  it('takes four axe contacts to defeat a new survivor-difficulty wolf', () => {
    const sim = fresh();
    sim.state.time = 120;
    sim.state.weather = 'wolves';
    const wolf = { id: 1, x: 550, y: 500, hp: 4, maxHp: 4, cooldown: 0, scared: 0 };
    sim.state.wolves = [wolf];
    for (let strike = 1; strike <= 4; strike++) {
      wolf.x = 550;
      wolf.y = 500;
      expect(sim.attack(wolf)).toBe(true);
      advance(sim, 0.71);
      expect(wolf.hp).toBe(4 - strike);
      expect(sim.state.kills).toBe(strike === 4 ? 1 : 0);
    }
    expect(sim.state.wolves).toHaveLength(0);
    expect(sim.wolfPack.fallen).toHaveLength(1);
  });
});

describe('a dynamic satchel and registered static art', () => {
  it('defaults to actual owned items, supports missing items, and filters camp supplies separately', () => {
    const inventory = createGame('Ash', 'survivor', 42).inventory;
    const base = { category: 'all' as const, sort: 'category' as const, query: '', showMissing: false };
    expect(inventoryItems(inventory, base)).toHaveLength(5);
    expect(inventoryItems(inventory, { ...base, showMissing: true })).toHaveLength(16);
    expect(inventoryItems(inventory, { ...base, category: 'camp' })).toEqual([]);
    inventory.workbench = 1;
    expect(inventoryItems(inventory, { ...base, category: 'camp' })).toEqual(['workbench']);
  });
  it('searches case-insensitively, sorts deterministically and reflects changed counts', () => {
    const inventory = createGame('Ash', 'survivor', 42).inventory;
    const base = { category: 'all' as const, sort: 'name' as const, query: '', showMissing: false };
    inventory.wood = 30;
    expect(inventoryItems(inventory, { ...base, query: '  PINE wood  ' })).toEqual(['wood']);
    expect(inventoryItems(inventory, { ...base, sort: 'quantity' })[0]).toBe('wood');
    inventory.wood = 0;
    expect(inventoryItems(inventory, base)).not.toContain('wood');
    expect(inventoryItems(inventory, { ...base, query: 'nothing here' })).toEqual([]);
  });
  it('can pin, swap and clear the workbench pocket without consuming or equipping it', () => {
    const sim = fresh();
    sim.state.inventory.workbench = 1;
    expect(sim.assignSlot(0, 'workbench')).toBe(true);
    expect(sim.assignSlot(1, 'workbench')).toBe(true);
    expect(sim.state.hotbar.slice(0, 2)).toEqual(['pickaxe', 'workbench']);
    sim.assignSlot(1, null);
    expect(sim.state.hotbar[1]).toBeNull();
    expect(sim.state.inventory.workbench).toBe(1);
    expect(sim.state.equipped).toBe('hatchet');
  });
  it('ships the smaller prop, stump, aligned whole seated states and distinct generated frames', () => {
    expect(registry.objects.workbench.width).toBeLessThan(64);
    expect(registry.objects.workbench.height).toBeLessThan(44);
    expect(registry.objects.campBench.anchor).toEqual(registry.objects.seatedBench.anchor);
    expect(registry.objects.campBench.width).toBe(registry.objects.seatedBench.width);
    for (const asset of [
      ...Object.values(registry.objects),
      registry.frames.inventory,
      registry.frames.workshop,
      registry.textures.satchelLinen,
    ]) {
      const image = readFileSync(`public/${asset.file}`);
      expect(image.readUInt32BE(16)).toBe(asset.width);
      expect(image.readUInt32BE(20)).toBe(asset.height);
      expect(image.equals(readFileSync(`public/${asset.sourceAsset}`))).toBe(true);
    }
    expect(registry.icons.workbench.sourceAsset).toBe('art/generated/hearth-workshop/workbench-icon.png');
    expect(distance(CAMP_BENCH, CAMP)).toBeLessThan(40);
  });
});
