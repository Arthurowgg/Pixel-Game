import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ITEM_ATLAS } from './animation';
import { CAMP, ITEMS, RECIPES, RESOURCE_HP } from './data';
import generatedAssets from './generated-assets.json';
import { createGame, Simulation } from './simulation';
import { isGameState, migrateGame } from './storage';

const fresh = () => new Simulation(createGame('Fern', 'explorer', 42));
const advance = (sim: Simulation, seconds: number) => {
  for (let elapsed = 0; elapsed < seconds; elapsed += 0.05) sim.update(Math.min(0.05, seconds - elapsed));
};

describe('forager supplies', () => {
  it('starts new supplies empty without changing the six default pockets', () => {
    const sim = fresh();
    expect(sim.state.inventory.nuts).toBe(0);
    expect(sim.state.inventory.tea).toBe(0);
    expect(sim.state.hotbar).toEqual(['hatchet', 'pickaxe', 'berries', 'water', 'bandage', 'torch']);
    expect(Object.keys(ITEMS)).toHaveLength(20);
    expect(RECIPES).toHaveLength(11);
  });
  it('awards one portion of pine nuts only when the felled tree lands, never on key spam', () => {
    const sim = fresh();
    for (let i = 0; i < RESOURCE_HP.tree - 1; i++) {
      sim.interact();
      advance(sim, 0.7);
      expect(sim.state.inventory.nuts).toBe(0);
    }
    sim.interact();
    advance(sim, 0.3);
    expect(sim.state.inventory.nuts).toBe(0);
    advance(sim, 0.1);
    expect(sim.state.inventory.nuts).toBe(1);
    expect(sim.state.inventory.wood).toBe(4);
    expect(sim.state.gathered.nuts).toBe(1);
    sim.interact();
    advance(sim, 0.7);
    expect(sim.state.inventory.nuts).toBe(1);
    expect(sim.state.journal.filter((entry) => entry.text.includes('pine nuts'))).toHaveLength(1);
  });
  it('holds and pins nuts without eating them; using restores hunger at contact', () => {
    const sim = fresh();
    sim.state.inventory.nuts = 1;
    sim.state.needs.hunger = 30;
    expect(sim.equip('nuts')).toBe(true);
    expect(sim.assignSlot(5, 'nuts')).toBe(true);
    expect(sim.state.inventory.nuts).toBe(1);
    expect(sim.state.needs.hunger).toBe(30);
    expect(sim.useHeld()).toBe(true);
    advance(sim, 0.3);
    expect(sim.state.inventory.nuts).toBe(1);
    advance(sim, 0.1);
    expect(sim.state.inventory.nuts).toBe(0);
    expect(sim.state.needs.hunger).toBeCloseTo(44, 0);
    expect(sim.state.equipped).toBeNull();
  });
  it('only brews tea beside a burning fire and deducts the exact recipe', () => {
    const sim = fresh();
    sim.state.workbenches = [{ id: 0, x: 940, y: 738 }];
    sim.state.player = { x: 200, y: 200 };
    const before = { ...sim.state.inventory };
    expect(sim.craft('tea', 1, 0)).toBe(false);
    expect(sim.state.inventory).toEqual(before);
    sim.state.player = { ...CAMP };
    sim.state.fires[0].fuel = 0;
    expect(sim.craft('tea', 1, 0)).toBe(false);
    expect(sim.state.inventory).toEqual(before);
    sim.state.fires[0].fuel = 80;
    expect(sim.craft('tea', 1, 0)).toBe(true);
    expect(sim.state.inventory.berries).toBe(before.berries - 2);
    expect(sim.state.inventory.water).toBe(before.water - 1);
    expect(sim.state.inventory.tea).toBe(1);
    expect(sim.state.crafted).toContain('tea');
  });
  it('rejects tea recipes with missing ingredients without spending the other ingredient', () => {
    const sim = fresh();
    sim.state.workbenches = [{ id: 0, x: 940, y: 738 }];
    sim.state.player = { ...CAMP };
    sim.state.inventory.berries = 1;
    expect(sim.craft('tea', 1, 0)).toBe(false);
    expect(sim.state.inventory.water).toBe(3);
    sim.state.inventory.berries = 3;
    sim.state.inventory.water = 0;
    expect(sim.craft('tea', 1, 0)).toBe(false);
    expect(sim.state.inventory.berries).toBe(3);
  });
  it('uses tea as a drink and restores thirst and warmth once', () => {
    const sim = fresh();
    sim.state.player = { x: 200, y: 200 };
    sim.state.inventory.tea = 2;
    sim.state.needs.thirst = 20;
    sim.state.needs.warmth = 20;
    expect(sim.use('tea')).toBe(true);
    expect(sim.action?.kind).toBe('drink');
    advance(sim, 0.3);
    expect(sim.state.inventory.tea).toBe(2);
    advance(sim, 0.4);
    expect(sim.state.inventory.tea).toBe(1);
    expect(sim.state.needs.thirst).toBeCloseTo(45, 0);
    expect(sim.state.needs.warmth).toBeCloseTo(44, 0);
    advance(sim, 0.5);
    expect(sim.state.inventory.tea).toBe(1);
  });
  it('cancels drinking before impact without spending tea, and clamps restored needs', () => {
    const sim = fresh();
    sim.state.inventory.tea = 1;
    sim.state.needs.thirst = 96;
    sim.state.needs.warmth = 96;
    sim.use('tea');
    advance(sim, 0.1);
    sim.equip('hatchet');
    advance(sim, 0.7);
    expect(sim.state.inventory.tea).toBe(1);
    sim.use('tea');
    advance(sim, 0.4);
    expect(sim.state.inventory.tea).toBe(0);
    expect(sim.state.needs.thirst).toBeGreaterThan(99);
    expect(sim.state.needs.thirst).toBeLessThanOrEqual(100);
    expect(sim.state.needs.warmth).toBeGreaterThan(99);
    expect(sim.state.needs.warmth).toBeLessThanOrEqual(100);
  });
});

describe('backward-compatible forager saves', () => {
  it('upgrades old version-two inventories while preserving equipment and gathered supplies', () => {
    const old = JSON.parse(JSON.stringify(fresh().state));
    delete old.inventory.nuts;
    delete old.inventory.tea;
    old.inventory.wood = 19;
    old.hotbar[5] = 'wood';
    old.equipped = 'wood';
    expect(isGameState(old)).toBe(false);
    const migrated = migrateGame(old)!;
    expect(migrated.inventory).toMatchObject({ nuts: 0, tea: 0, wood: 19 });
    expect(migrated.equipped).toBe('wood');
    expect(migrated.hotbar[5]).toBe('wood');
    expect(isGameState(migrated)).toBe(true);
    expect(Object.hasOwn(old.inventory, 'nuts')).toBe(false);
  });
  it('adds new defaults during legacy version-one migration too', () => {
    const old = JSON.parse(JSON.stringify(fresh().state));
    old.version = 1;
    for (const key of ['nuts', 'tea', 'pickaxe']) delete old.inventory[key];
    for (const key of ['direction', 'equipped', 'hotbar']) delete old[key];
    expect(migrateGame(old)?.inventory).toMatchObject({ nuts: 0, tea: 0, pickaxe: 1 });
  });
  it('does not mask invalid new fields or a missing original item during migration', () => {
    for (const invalid of [-1, NaN, null, '2']) {
      const old = { ...fresh().state, inventory: { ...fresh().state.inventory, tea: invalid } };
      expect(migrateGame(old)).toBeNull();
    }
    const old = JSON.parse(JSON.stringify(fresh().state));
    delete old.inventory.wood;
    expect(migrateGame(old)).toBeNull();
  });
  it('round-trips held and pocketed new items without changing their counts', () => {
    const sim = fresh();
    sim.state.inventory.tea = 3;
    sim.equip('tea');
    sim.assignSlot(5, 'tea');
    const restored = migrateGame(JSON.parse(JSON.stringify(sim.state)))!;
    expect(restored.inventory.tea).toBe(3);
    expect(restored.equipped).toBe('tea');
    expect(restored.hotbar[5]).toBe('tea');
    expect(isGameState(restored)).toBe(true);
  });
});

describe('generated static assets', () => {
  it('preserves the normalized forager icons through later generated-art batches', () => {
    for (const item of ['wood', 'stone', 'fiber', 'berries', 'water', 'mushroom', 'nuts', 'tea'] as const) {
      const entry = ITEM_ATLAS.items[item];
      expect(entry.source).toBe('generated');
      expect(
        readFileSync(`public/${entry.sourceAsset}`).equals(readFileSync(`public/art/item-${item}.png`)),
      ).toBe(true);
    }
    expect(Object.values(ITEM_ATLAS.items).filter((item) => item.source === 'generated')).toHaveLength(20);
    expect(
      Object.values(ITEM_ATLAS.items).filter((item) => item.source === 'original-pixel-art'),
    ).toHaveLength(0);
  });
  it('ships valid terrain/UI bitmaps and matching public/runtime provenance', () => {
    expect(JSON.parse(readFileSync('public/art/generated-assets.json', 'utf8'))).toEqual(generatedAssets);
    for (const asset of [
      ...Object.values(generatedAssets.icons),
      ...Object.values(generatedAssets.textures),
    ]) {
      const png = readFileSync(`public/${asset.file}`);
      expect(png.readUInt32BE(16)).toBe(asset.width);
      expect(png.readUInt32BE(20)).toBe(asset.height);
      expect(asset.source).toBe('generated');
    }
  });
});
