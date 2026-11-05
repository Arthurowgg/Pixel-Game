import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CAMP, DAY_LENGTH, ITEMS, LEGACY_SAVE_KEY, RESOURCE_HP, SAVE_KEY, SPRING, WORLD } from './data';
import { Simulation, createGame, createWorld, inWater, weatherAt } from './simulation';
import type { ItemId } from './types';
import { clearGame, isGameState, loadGame, loadSettings, migrateGame, saveGame } from './storage';

const advance = (sim: Simulation, seconds: number) => {
  for (let t = 0; t < seconds; t += 0.1) sim.update(Math.min(0.1, seconds - t));
};
function createSim() {
  return new Simulation(createGame('Robin', 'survivor', 12345));
}

const placedWorkbench = (sim: Simulation) => {
  sim.state.workbenches = [{ id: 0, x: 940, y: 738 }];
  sim.state.player = { x: 940, y: 758 };
};

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) || null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  });
});
describe('world generation', () => {
  it('is deterministic for a given seed and different for different seeds', () => {
    expect(createWorld(123)).toEqual(createWorld(123));
    expect(createWorld(123)).not.toEqual(createWorld(124));
  });
  it('keeps all resources inside the forest and outside the pond', () => {
    const world = createWorld(42);
    expect(world.length).toBeGreaterThan(400);
    for (const r of world) {
      expect(r.x).toBeGreaterThan(0);
      expect(r.x).toBeLessThan(WORLD.width);
      expect(r.y).toBeLessThan(WORLD.height);
      expect(inWater(r)).toBe(false);
    }
  });
  it('starts with an interactable pine, a campfire, and essential supplies', () => {
    const sim = createSim();
    expect(sim.nearest()?.kind).toBe('tree');
    expect(sim.state.fires[0].fuel).toBeGreaterThan(0);
    expect(sim.state.inventory.water).toBe(3);
    expect(sim.state.inventory.hatchet).toBe(1);
    expect(sim.state.inventory.bandage).toBe(1);
  });
  it('normalizes an empty or long survivor name', () => {
    expect(createGame('   ', 'explorer').name).toBe('Wanderer');
    expect(createGame('a'.repeat(40), 'explorer').name).toHaveLength(20);
  });
});
describe('gathering and crafting', () => {
  it('takes six chops to gather four wood and prevents key-spam exploits', () => {
    const sim = createSim();
    expect(sim.state.resources[0].hp).toBe(RESOURCE_HP.tree);
    sim.interact();
    sim.interact();
    expect(sim.state.resources[0].hp).toBe(RESOURCE_HP.tree);
    advance(sim, 0.35);
    expect(sim.state.resources[0].hp).toBe(RESOURCE_HP.tree - 1);
    expect(sim.state.inventory.wood).toBe(0);
    advance(sim, 0.35);
    for (let chop = 0; chop < RESOURCE_HP.tree - 1; chop++) {
      sim.interact();
      advance(sim, 0.7);
    }
    expect(sim.state.resources[0].hp).toBe(0);
    expect(sim.state.inventory.wood).toBe(4);
    expect(sim.state.gathered.wood).toBe(4);
  });
  it('does not spend supplies if a recipe cannot be crafted', () => {
    const sim = createSim();
    placedWorkbench(sim);
    sim.state.inventory.wood = 4;
    sim.state.inventory.stone = 3;
    const before = { ...sim.state.inventory };
    expect(sim.craft('campfire', 1, 0)).toBe(false);
    expect(sim.state.inventory).toEqual(before);
  });
  it('crafts exactly one item and consumes the exact recipe', () => {
    const sim = createSim();
    placedWorkbench(sim);
    sim.state.inventory.wood = 10;
    sim.state.inventory.stone = 3;
    expect(sim.craft('campfire', 1, 0)).toBe(true);
    expect(sim.state.inventory.wood).toBe(5);
    expect(sim.state.inventory.stone).toBe(0);
    expect(sim.state.inventory.campfire).toBe(1);
    expect(sim.state.crafted).toContain('campfire');
  });
  it('requires a burning campfire to cook a meal', () => {
    const sim = createSim();
    placedWorkbench(sim);
    sim.state.player = { x: 200, y: 200 };
    sim.state.inventory.mushroom = 1;
    expect(sim.craft('meal', 1, 0)).toBe(false);
    sim.state.player = { ...CAMP };
    expect(sim.craft('meal', 1, 0)).toBe(true);
    expect(sim.state.inventory.meal).toBe(1);
  });
  it('can build a shelter from a crafted kit on open ground', () => {
    const sim = createSim();
    placedWorkbench(sim);
    sim.state.inventory.wood = 10;
    sim.state.inventory.fiber = 6;
    expect(sim.craft('shelter', 1, 0)).toBe(true);
    sim.state.player = { x: 885, y: 800 };
    expect(sim.use('shelter')).toBe(true);
    expect(sim.state.shelters).toHaveLength(0);
    advance(sim, 0.7);
    expect(sim.state.shelters).toHaveLength(1);
    expect(sim.state.inventory.shelter).toBe(0);
  });
  it('refuses to place a kit over a resource and keeps it in inventory', () => {
    const sim = createSim();
    sim.state.inventory.campfire = 1;
    sim.state.player = { x: 908, y: 769 };
    expect(sim.use('campfire')).toBe(false);
    expect(sim.state.inventory.campfire).toBe(1);
  });
});
describe('survival systems', () => {
  it('consumes food and water and clamps needs to 100', () => {
    const sim = createSim();
    sim.state.needs.hunger = 95;
    sim.state.needs.thirst = 20;
    expect(sim.use('berries')).toBe(true);
    advance(sim, 0.7);
    expect(sim.state.needs.hunger).toBeGreaterThan(99);
    expect(sim.state.needs.hunger).toBeLessThanOrEqual(100);
    expect(sim.state.inventory.berries).toBe(2);
    expect(sim.use('water')).toBe(true);
    advance(sim, 0.7);
    expect(sim.state.needs.thirst).toBeCloseTo(60, 0);
  });
  it('does not consume nonexistent supplies or resources', () => {
    const sim = createSim();
    expect(sim.use('torch')).toBe(false);
    sim.state.inventory.wood = 5;
    expect(sim.use('wood')).toBe(false);
    expect(sim.state.inventory.wood).toBe(5);
  });
  it('refills water at the spring', () => {
    const sim = createSim();
    sim.state.player = { ...SPRING };
    sim.state.inventory.water = 0;
    sim.interact();
    advance(sim, 0.7);
    expect(sim.state.inventory.water).toBe(5);
  });
  it('feeds a fire with wood and increases fuel', () => {
    const sim = createSim();
    sim.state.player = { ...CAMP };
    sim.state.fires[0].fuel = 50;
    sim.state.inventory.wood = 2;
    sim.feedFire(0);
    advance(sim, 0.7);
    expect(sim.state.fires[0].fuel).toBeCloseTo(85, 0);
    expect(sim.state.inventory.wood).toBe(1);
  });
  it('does not progress while a menu is open', () => {
    const sim = createSim();
    const before = structuredClone(sim.state);
    sim.paused = true;
    sim.keys.add('d');
    advance(sim, 10);
    expect(sim.state).toEqual(before);
  });
  it('moves the survivor and prevents movement into water', () => {
    const sim = createSim();
    sim.keys.add('a');
    advance(sim, 0.2);
    expect(sim.state.player.x).toBeLessThan(900);
    expect(sim.collision({ x: 1220, y: 660 })).toBe(true);
    expect(sim.collision({ x: -1, y: 100 })).toBe(true);
  });
  it('sprinting spends stamina and resting replenishes it', () => {
    const sim = createSim();
    sim.keys.add('s');
    sim.keys.add('shift');
    advance(sim, 1);
    expect(sim.state.needs.stamina).toBeLessThan(90);
    sim.keys.clear();
    advance(sim, 2);
    expect(sim.state.needs.stamina).toBe(100);
  });
  it('brings rain, cold, wolves, then calmer weather', () => {
    expect(weatherAt(49)).toBe('rain');
    expect(weatherAt(DAY_LENGTH + 49)).toBe('storm');
    expect(weatherAt(100)).toBe('cold');
    expect(weatherAt(125)).toBe('wolves');
    expect(weatherAt(160)).toBe('clear');
  });
  it('spawns wolves and lets a survivor defend themself', () => {
    const sim = createSim();
    sim.state.time = 119.95;
    sim.update(0.1);
    expect(sim.state.wolves).toHaveLength(2);
    sim.state.wolves[0] = { id: 1, x: 910, y: 790, hp: 1, scared: 0, cooldown: 0 };
    sim.attack();
    advance(sim, 0.35);
    expect(sim.state.kills).toBe(1);
    expect(sim.state.wolves).toHaveLength(1);
  });
  it('counts dawns and completes the three-night challenge', () => {
    const sim = createSim();
    sim.state.time = 164.95;
    sim.update(0.1);
    expect(sim.state.nights).toBe(1);
    sim.state.time = 524.95;
    sim.state.nights = 2;
    sim.update(0.1);
    expect(sim.state.nights).toBe(3);
    expect(sim.state.status).toBe('won');
    sim.state.status = 'playing';
    sim.state.victoryAcknowledged = true;
    sim.state.time = 704.95;
    sim.update(0.1);
    expect(sim.state.status).toBe('playing');
  });
  it('supports a full three-night run with regular food, water, and firewood', () => {
    const sim = createSim();
    sim.state.player = { x: CAMP.x, y: CAMP.y + 24 };
    sim.state.inventory.wood = 12; // Three gathered pines.
    while (sim.state.status === 'playing' && sim.state.time < 526) {
      if (sim.state.fires[0].fuel < 35) sim.interact();
      if (sim.state.needs.hunger < 50 && sim.state.inventory.berries > 0) sim.use('berries');
      if (sim.state.needs.thirst < 50 && sim.state.inventory.water > 0) sim.use('water');
      sim.update(0.1);
    }
    expect(sim.state.status).toBe('won');
    expect(sim.state.nights).toBe(3);
    expect(sim.state.needs.health).toBeGreaterThan(90);
    expect(sim.state.inventory.wood).toBeGreaterThan(0);
    expect(sim.state.journal.some((entry) => entry.kind === 'danger')).toBe(true);
  });

  it('ends a journey at zero health and rejects further actions', () => {
    const sim = createSim();
    sim.state.needs.health = 0;
    sim.state.needs.hunger = 0;
    sim.update(0.1);
    expect(sim.state.status).toBe('dead');
    expect(sim.use('bandage')).toBe(false);
    expect(sim.craft('torch')).toBe(false);
  });
});
describe('local save safety', () => {
  it('round-trips a valid expedition', () => {
    const sim = createSim();
    advance(sim, 5);
    expect(saveGame(sim.state)).toBe(true);
    expect(loadGame()).toEqual(sim.state);
  });
  it('rejects malformed, incomplete, and non-finite state', () => {
    expect(isGameState(null)).toBe(false);
    expect(isGameState({ version: 1 })).toBe(false);
    const state = createSim().state;
    state.needs.health = NaN;
    expect(isGameState(state)).toBe(false);
    localStorage.setItem(SAVE_KEY, '{broken');
    expect(loadGame()).toBeNull();
  });
  it('never offers a finished journey as a resumable save', () => {
    const state = createSim().state;
    state.status = 'dead';
    expect(saveGame(state)).toBe(false);
    expect(loadGame()).toBeNull();
  });
  it('handles unavailable local storage gracefully', () => {
    vi.stubGlobal('localStorage', {
      getItem() {
        throw new Error('blocked');
      },
      setItem() {
        throw new Error('blocked');
      },
    });
    expect(saveGame(createSim().state)).toBe(false);
    expect(loadGame()).toBeNull();
    expect(loadSettings().sound).toBe(true);
  });
});

describe('equipment and synchronized actions', () => {
  it('holds every inventory item without consuming any supplies', () => {
    const sim = createSim();
    for (const item of Object.keys(ITEMS) as ItemId[]) sim.state.inventory[item] = 2;
    const before = { ...sim.state.inventory };
    for (const item of Object.keys(ITEMS) as ItemId[]) {
      expect(sim.equip(item)).toBe(true);
      expect(sim.state.equipped).toBe(item);
      expect(sim.state.inventory).toEqual(before);
    }
    expect(sim.equip(null)).toBe(true);
    expect(sim.state.equipped).toBeNull();
  });
  it('selects pockets without eating food and refuses unavailable equipment', () => {
    const sim = createSim();
    expect(sim.selectSlot(2)).toBe(true);
    expect(sim.state.equipped).toBe('berries');
    expect(sim.state.inventory.berries).toBe(3);
    expect(sim.equip('meal')).toBe(false);
    expect(sim.state.equipped).toBe('berries');
    expect(sim.selectSlot(8)).toBe(false);
  });
  it('pins arbitrary items and swaps occupied slots without duplicates', () => {
    const sim = createSim();
    expect(sim.assignSlot(4, 'wood')).toBe(true);
    expect(sim.state.hotbar[4]).toBe('wood');
    sim.assignSlot(2, 'pickaxe');
    expect(sim.state.hotbar[2]).toBe('pickaxe');
    expect(sim.state.hotbar[1]).toBe('berries');
    expect(new Set(sim.state.hotbar).size).toBe(6);
    expect(sim.assignSlot(6, 'wood')).toBe(false);
    expect(sim.assignSlot(0, '__proto__' as ItemId)).toBe(false);
  });
  it('does not award a chop until the tool reaches its contact frame', () => {
    const sim = createSim();
    sim.interact();
    expect(sim.action?.kind).toBe('chop');
    advance(sim, 0.3);
    expect(sim.state.resources[0].hp).toBe(RESOURCE_HP.tree);
    advance(sim, 0.05);
    expect(sim.state.resources[0].hp).toBe(RESOURCE_HP.tree - 1);
    expect(sim.resourceAnimations.get(0)?.kind).toBe('hit');
    expect(sim.effects.some((e) => e.clip === 'wood-chips')).toBe(true);
    advance(sim, 0.5);
    expect(sim.state.resources[0].hp).toBe(RESOURCE_HP.tree - 1);
  });
  it('uses a separate pickaxe animation to break a tougher boulder', () => {
    const sim = createSim();
    const rock = sim.state.resources.find((r) => r.kind === 'stone')!;
    sim.state.resources = [rock];
    sim.state.player = { x: rock.x - 30, y: rock.y };
    sim.equip('pickaxe');
    sim.interact();
    expect(sim.state.equipped).toBe('pickaxe');
    expect(sim.action?.kind).toBe('mine');
    expect(rock.hp).toBe(RESOURCE_HP.stone);
    for (let strike = 0; strike < RESOURCE_HP.stone; strike++) {
      advance(sim, 0.7);
      expect(rock.hp).toBe(RESOURCE_HP.stone - strike - 1);
      expect(sim.state.inventory.stone).toBe(rock.hp > 0 ? 0 : 3);
      sim.useHeld();
      advance(sim, 0.05);
    }
    expect(sim.state.inventory.stone).toBe(3);
    expect(sim.resourceAnimations.get(rock.id)?.kind).toBe('break');
    expect(sim.effects.some((e) => e.clip === 'stone-dust')).toBe(true);
  });
  it('requires the appropriate tool rather than mining with food or an axe', () => {
    const sim = createSim();
    const rock = sim.state.resources.find((r) => r.kind === 'stone')!;
    sim.state.resources = [rock];
    sim.state.player = { x: rock.x - 30, y: rock.y };
    sim.state.inventory.pickaxe = 0;
    sim.equip('berries');
    expect(sim.interact()).toBe(false);
    expect(sim.action).toBeNull();
    expect(rock.hp).toBe(RESOURCE_HP.stone);
    expect(sim.state.equipped).toBe('berries');
  });
  it('cancels before impact when changing equipment, but never duplicates a committed hit', () => {
    const sim = createSim();
    sim.interact();
    advance(sim, 0.2);
    sim.equip('water');
    advance(sim, 0.8);
    expect(sim.state.resources[0].hp).toBe(RESOURCE_HP.tree);
    expect(sim.action).toBeNull();
    sim.equip('hatchet');
    sim.interact();
    advance(sim, 0.35);
    sim.equip('berries');
    expect(sim.interact()).toBe(false);
    advance(sim, 0.1);
    expect(sim.state.resources[0].hp).toBe(RESOURCE_HP.tree - 1);
  });
  it('does not gather a target that has moved out of reach before contact', () => {
    const sim = createSim();
    sim.interact();
    sim.state.player = { x: 500, y: 500 };
    advance(sim, 0.7);
    expect(sim.state.resources[0].hp).toBe(RESOURCE_HP.tree);
    expect(sim.state.inventory.wood).toBe(0);
  });
  it('freezes a pending action and impact while paused', () => {
    const sim = createSim();
    sim.interact();
    advance(sim, 0.2);
    sim.paused = true;
    const action = structuredClone(sim.action);
    const time = sim.state.time;
    advance(sim, 2);
    expect(sim.action).toEqual(action);
    expect(sim.state.time).toBe(time);
    expect(sim.state.resources[0].hp).toBe(RESOURCE_HP.tree);
    sim.paused = false;
    advance(sim, 0.2);
    expect(sim.state.resources[0].hp).toBe(RESOURCE_HP.tree - 1);
  });
  it('consumes one held item at contact, rejects overlapping uses, and clears empty hands', () => {
    const sim = createSim();
    sim.state.inventory.berries = 1;
    sim.equip('berries');
    expect(sim.useHeld()).toBe(true);
    expect(sim.useHeld()).toBe(false);
    expect(sim.use('water')).toBe(false);
    advance(sim, 0.3);
    expect(sim.state.inventory.berries).toBe(1);
    advance(sim, 0.05);
    expect(sim.state.inventory.berries).toBe(0);
    expect(sim.state.equipped).toBeNull();
    advance(sim, 1);
    expect(sim.state.inventory.berries).toBe(0);
  });
  it('does not spend a consumable when its use is cancelled before contact', () => {
    const sim = createSim();
    sim.use('water');
    advance(sim, 0.2);
    sim.equip('hatchet');
    advance(sim, 1);
    expect(sim.state.inventory.water).toBe(3);
  });
  it('allows a lit torch to be held after consuming its item, and only warms while held', () => {
    const sim = createSim();
    sim.state.inventory.torch = 1;
    sim.use('torch');
    advance(sim, 0.7);
    expect(sim.state.inventory.torch).toBe(0);
    expect(sim.torchLit).toBe(true);
    expect(sim.torchActive).toBe(true);
    sim.equip('hatchet');
    expect(sim.torchActive).toBe(false);
    expect(sim.torchLit).toBe(true);
    expect(sim.equip('torch')).toBe(true);
    expect(sim.torchActive).toBe(true);
    expect(isGameState(sim.state)).toBe(true);
    sim.state.time = sim.state.torchUntil;
    sim.update(0.1);
    expect(sim.torchActive).toBe(false);
    expect(sim.state.equipped).toBeNull();
  });
  it('regrows harvested resources and records their return', () => {
    const sim = createSim();
    const resource = sim.state.resources[0];
    resource.hp = 0;
    resource.readyAt = 0.05;
    advance(sim, 0.1);
    expect(resource.hp).toBe(RESOURCE_HP.tree);
    expect(sim.resourceAnimations.get(resource.id)?.kind).toBe('regrow');
  });
  it('crafts a replacement pickaxe with its own recipe', () => {
    const sim = createSim();
    placedWorkbench(sim);
    Object.assign(sim.state.inventory, { wood: 3, stone: 3, fiber: 1, pickaxe: 0 });
    expect(sim.craft('pickaxe', 1, 0)).toBe(true);
    expect(sim.state.inventory.pickaxe).toBe(1);
    expect(sim.state.inventory.wood + sim.state.inventory.stone + sim.state.inventory.fiber).toBe(0);
  });
});
describe('equipment saves and legacy migration', () => {
  it('preserves held items and custom pockets across a round trip', () => {
    const sim = createSim();
    sim.state.inventory.wood = 4;
    sim.equip('wood');
    sim.assignSlot(3, 'wood');
    expect(saveGame(sim.state)).toBe(true);
    const loaded = loadGame();
    expect(loaded?.equipped).toBe('wood');
    expect(loaded?.hotbar[3]).toBe('wood');
  });
  it('upgrades old expeditions without losing progress and supplies a pickaxe', () => {
    const state = createGame('Legacy Robin', 'explorer', 42);
    const old = JSON.parse(JSON.stringify(state));
    old.version = 1;
    delete old.inventory.pickaxe;
    delete old.equipped;
    delete old.direction;
    delete old.hotbar;
    old.inventory.wood = 25;
    old.time = 79;
    localStorage.setItem(LEGACY_SAVE_KEY, JSON.stringify(old));
    const loaded = loadGame()!;
    expect(loaded.version).toBe(2);
    expect(loaded.inventory.pickaxe).toBe(1);
    expect(loaded.inventory.wood).toBe(25);
    expect(loaded.time).toBe(79);
    expect(loaded.name).toBe('Legacy Robin');
    expect(localStorage.getItem(LEGACY_SAVE_KEY)).not.toBeNull();
    expect(saveGame(loaded)).toBe(true);
    expect(localStorage.getItem(LEGACY_SAVE_KEY)).toBeNull();
    expect(loadGame()?.equipped).toBe('hatchet');
  });
  it('rejects corrupt equipment, directions, and shortcut arrays', () => {
    const state = createGame('Robin', 'explorer', 42);
    for (const change of [
      { equipped: 'banana' },
      { equipped: 'meal' },
      { direction: 'northeast' },
      { hotbar: ['wood'] },
      { hotbar: ['hatchet', 'hatchet', null, null, null, null] },
    ])
      expect(isGameState({ ...state, ...change })).toBe(false);
    expect(migrateGame({ version: 1, inventory: { hatchet: 1 } })).toBeNull();
  });
  it('clears both save versions at the end of an expedition', () => {
    localStorage.setItem(SAVE_KEY, 'test');
    localStorage.setItem(LEGACY_SAVE_KEY, 'legacy');
    clearGame();
    expect(localStorage.getItem(SAVE_KEY)).toBeNull();
    expect(localStorage.getItem(LEGACY_SAVE_KEY)).toBeNull();
  });
  it('does not carry an uncommitted animation into a reloaded save', () => {
    const sim = createSim();
    sim.use('water');
    advance(sim, 0.2);
    saveGame(sim.state);
    const restored = new Simulation(loadGame()!);
    advance(restored, 1);
    expect(restored.action).toBeNull();
    expect(restored.state.inventory.water).toBe(3);
  });
});

describe('construction and equipment edge cases', () => {
  it('stows a held material when crafting spends its final unit, even while paused', () => {
    const sim = createSim();
    placedWorkbench(sim);
    Object.assign(sim.state.inventory, { wood: 3, stone: 3, fiber: 1 });
    sim.equip('wood');
    sim.paused = true;
    sim.craft('pickaxe', 1, 0);
    expect(sim.state.equipped).toBeNull();
    expect(isGameState(sim.state)).toBe(true);
  });
  it('revalidates a construction site at the impact frame', () => {
    const sim = createSim();
    sim.state.resources = [];
    sim.state.player = { x: 885, y: 800 };
    sim.state.inventory.shelter = 1;
    expect(sim.use('shelter')).toBe(true);
    sim.state.resources.push({
      id: 900,
      kind: 'tree',
      x: 920,
      y: 818,
      hp: 3,
      readyAt: 0,
      scale: 1,
      variant: 0,
    });
    advance(sim, 0.7);
    expect(sim.state.shelters).toHaveLength(0);
    expect(sim.state.inventory.shelter).toBe(1);
  });
});

it('prioritizes defense over held gathering input', () => {
  const sim = createSim();
  sim.keys.add('e');
  sim.keys.add(' ');
  sim.update(0.05);
  expect(sim.action?.kind).toBe('attack');
  expect(sim.state.resources[0].hp).toBe(RESOURCE_HP.tree);
});
