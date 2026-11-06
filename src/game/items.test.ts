import { describe, expect, it } from 'vitest';
import { ITEMS, RECIPES, RESOURCE_HP } from './data';
import { ITEM_ATLAS } from './animation';
import { Simulation, createGame } from './simulation';

const fresh = () => new Simulation(createGame('Moss', 'explorer', 42));

describe('the four new supplies', () => {
  it('has icons, names and a category for every one of them', () => {
    for (const id of ['rope', 'plank', 'moss', 'salve'] as const) {
      expect(ITEMS[id].name.length).toBeGreaterThan(2);
      expect(ITEM_ATLAS.items[id]).toBeDefined();
      expect(ITEM_ATLAS.items[id].source).toBe('generated');
      expect(ITEM_ATLAS.items[id].x + ITEM_ATLAS.items[id].w).toBeLessThanOrEqual(ITEM_ATLAS.width);
      expect(ITEM_ATLAS.items[id].y + ITEM_ATLAS.items[id].h).toBeLessThanOrEqual(ITEM_ATLAS.height);
    }
  });

  it('crafts rope and planks by hand and keeps the salve behind the workbench', () => {
    const byId = Object.fromEntries(RECIPES.map((recipe) => [recipe.id, recipe]));
    expect(byId.rope.cost).toEqual({ fiber: 3 });
    expect(byId.plank.cost).toEqual({ wood: 2 });
    expect(byId.salve.cost).toEqual({ moss: 2, fiber: 2 });
    expect(byId.salve.needsWorkbench).toBe(true);

    const sim = fresh();
    sim.state.inventory.fiber = 3;
    sim.state.inventory.rope = 0;
    expect(sim.craft('rope')).toBe(true);
    expect(sim.state.inventory.rope).toBe(1);
    expect(sim.state.inventory.fiber).toBe(0);

    sim.state.inventory.wood = 2;
    expect(sim.craft('plank')).toBe(true);
    expect(sim.state.inventory.plank).toBe(1);
    expect(sim.state.inventory.wood).toBe(0);
  });

  it('drops moss from a mossy boulder and the salve heals', () => {
    const sim = fresh();
    const boulder = {
      id: 7,
      kind: 'stone' as const,
      x: 600,
      y: 600,
      hp: RESOURCE_HP.stone,
      readyAt: 0,
      scale: 1,
      variant: 0.97,
    };
    sim.state.resources = [boulder];
    sim.state.player = { x: boulder.x - 30, y: boulder.y };
    sim.state.inventory.stone = 0;
    sim.state.inventory.moss = 0;
    sim.equip('pickaxe');
    for (let strike = 0; strike < RESOURCE_HP.stone; strike++) {
      sim.interact();
      for (let step = 0; step < 20; step++) sim.update(0.05);
    }
    expect(sim.state.inventory.stone).toBeGreaterThan(0);
    expect(sim.state.inventory.moss).toBe(1);

    sim.state.needs.health = 50;
    sim.state.inventory.salve = 1;
    expect(sim.use('salve')).toBe(true);
    for (let step = 0; step < 40; step++) sim.update(0.05);
    expect(sim.state.needs.health).toBe(75);
    expect(sim.state.inventory.salve).toBe(0);
  });

  it('still starts a new game with empty pockets for the new supplies', () => {
    const inventory = createGame('New', 'survivor', 7).inventory;
    for (const id of ['rope', 'plank', 'moss', 'salve'] as const) expect(inventory[id]).toBe(0);
  });
});
