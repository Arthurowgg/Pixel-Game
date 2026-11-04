import { afterEach, describe, expect, it, vi } from 'vitest';
import { playerPose } from './animation';
import { SAVE_KEY } from './data';
import { GameInput, movementVector, touchMovementKeys, STABLE_WALK_FRAMES } from './movement';
import { createGame, Simulation } from './simulation';
import { isGameState, loadGame, migrateGame, saveGame } from './storage';

const fresh = () => {
  const sim = new Simulation(createGame('Rowan', 'explorer', 42));
  sim.state.player = { x: 500, y: 500 };
  sim.state.resources = [];
  sim.state.fires = [];
  sim.state.wolves = [];
  return sim;
};
afterEach(() => vi.unstubAllGlobals());

describe('cardinal input priority', () => {
  it.each([
    [['w', 'd'], { x: 1, y: 0 }],
    [['d', 'w'], { x: 0, y: -1 }],
    [['s', 'a'], { x: -1, y: 0 }],
    [['a', 's'], { x: 0, y: 1 }],
    [['arrowup', 'arrowright'], { x: 1, y: 0 }],
    [['arrowright', 'arrowup'], { x: 0, y: -1 }],
    [['w', 's'], { x: 0, y: 1 }],
    [['d', 'a'], { x: -1, y: 0 }],
  ] as [string[], { x: number; y: number }][])('uses the last held direction in %j', (held, expected) => {
    expect(movementVector(new Set(held))).toEqual(expected);
    const sim = fresh();
    held.forEach((key) => sim.keys.add(key));
    for (let i = 0; i < 20; i++) sim.update(0.05);
    expect(sim.state.player.x - 500).toBeCloseTo(expected.x * 58, 7);
    expect(sim.state.player.y - 500).toBeCloseTo(expected.y * 58, 7);
    expect(sim.state.distance).toBeCloseTo(58, 7);
    expect(STABLE_WALK_FRAMES).toContain(playerPose(sim).frame);
  });
  it('restores the older held direction after release and ignores repeat or modifier keys', () => {
    const keys = new Set<string>(),
      input = new GameInput(keys);
    input.key('w', true);
    input.key('d', true);
    input.key('w', true);
    input.key('shift', true);
    input.key('e', true);
    expect(movementVector(keys)).toEqual({ x: 1, y: 0 });
    input.key('d', false);
    expect(movementVector(keys)).toEqual({ x: 0, y: -1 });
    input.key('w', false);
    expect(movementVector(keys)).toEqual({ x: 0, y: 0 });
    expect([...keys]).toEqual(['shift', 'e']);
  });
  it('keeps chronology across keyboard and touch without same-sector pointer jitter taking priority', () => {
    const keys = new Set<string>(),
      input = new GameInput(keys);
    input.key('w', true);
    input.press(1, ['d']);
    expect(movementVector(keys)).toEqual({ x: 1, y: 0 });
    input.key('s', true);
    input.press(1, ['d']);
    expect(movementVector(keys)).toEqual({ x: 0, y: 1 });
    input.press(1, ['a']);
    expect(movementVector(keys)).toEqual({ x: -1, y: 0 });
    input.release(1);
    expect(movementVector(keys)).toEqual({ x: 0, y: 1 });
    input.key('s', false);
    expect(movementVector(keys)).toEqual({ x: 0, y: -1 });
  });
  it('keeps owners and aliases independent, including when a newer same-direction owner is released', () => {
    const keys = new Set<string>(),
      input = new GameInput(keys);
    input.key('w', true);
    input.press(1, ['d']);
    input.press(2, ['w']);
    expect(movementVector(keys)).toEqual({ x: 0, y: -1 });
    input.release(2);
    expect(movementVector(keys)).toEqual({ x: 1, y: 0 });
    input.key('arrowup', true);
    expect(movementVector(keys)).toEqual({ x: 0, y: -1 });
    input.key('arrowup', false);
    expect(movementVector(keys)).toEqual({ x: 1, y: 0 });
    input.release(1);
    expect(movementVector(keys)).toEqual({ x: 0, y: -1 });
    input.clear();
    input.release(2);
    expect(keys.size).toBe(0);
  });
  it('walks and sprints on only one axis without changing speed or action bindings', () => {
    const sim = fresh();
    sim.keys.add('w');
    sim.keys.add('d');
    sim.keys.add('shift');
    sim.update(0.1);
    expect(sim.state.player.x).toBeCloseTo(508.7, 7);
    expect(sim.state.player.y).toBe(500);
    expect(sim.state.needs.stamina).toBeLessThan(100);
    expect(playerPose(sim).name).toBe('run-right');
    expect(playerPose(sim).bodyName).toBe('walk-right');
  });
  it('never emits diagonal key combinations from any part of the touch pad', () => {
    for (let x = -2; x <= 2; x += 0.1)
      for (let y = -2; y <= 2; y += 0.1) {
        const keys = touchMovementKeys(x, y);
        expect(keys.length).toBeLessThanOrEqual(1);
        const movement = movementVector(new Set(keys));
        expect(movement.x === 0 || movement.y === 0).toBe(true);
      }
    expect(touchMovementKeys(NaN, 1)).toEqual([]);
    expect(touchMovementKeys(1, Infinity)).toEqual([]);
  });
});

describe('straight-leg click navigation without staircase diagonals', () => {
  it.each([
    [550, 520],
    [450, 520],
    [520, 550],
    [480, 450],
    [501, 501],
    [500, 499.8],
  ])('reaches %s,%s on one axis per update with at most one turn', (x, y) => {
    const sim = fresh();
    sim.target = { x, y };
    const facings: string[] = [];
    for (let i = 0; i < 100 && sim.target; i++) {
      const before = { ...sim.state.player };
      sim.update(0.05);
      const dx = sim.state.player.x - before.x,
        dy = sim.state.player.y - before.y;
      expect(Math.abs(dx) < 0.000001 || Math.abs(dy) < 0.000001).toBe(true);
      if (sim.moving && sim.state.direction !== facings.at(-1)) facings.push(sim.state.direction);
    }
    expect(sim.target).toBeNull();
    expect(sim.state.player.x).toBeCloseTo(x, 7);
    expect(sim.state.player.y).toBeCloseTo(y, 7);
    expect(sim.state.distance).toBeCloseTo(Math.abs(x - 500) + Math.abs(y - 500), 7);
    expect(facings.length).toBeLessThanOrEqual(2);
  });
  it('chooses a fresh first leg when a new target replaces the old one', () => {
    const sim = fresh();
    sim.target = { x: 550, y: 520 };
    sim.update(0.05);
    expect(sim.state.direction).toBe('right');
    const before = { ...sim.state.player };
    sim.target = { x: 490, y: 540 };
    sim.update(0.05);
    expect(sim.state.player.x).toBe(before.x);
    expect(sim.state.player.y).toBeGreaterThan(before.y);
    expect(sim.state.direction).toBe('down');
  });
  it('cancels a click route as soon as directional input takes over', () => {
    const sim = fresh();
    sim.target = { x: 550, y: 520 };
    sim.keys.add('a');
    sim.update(0.05);
    expect(sim.target).toBeNull();
    expect(sim.state.player.x).toBeLessThan(500);
    expect(sim.state.player.y).toBe(500);
    sim.keys.clear();
    const before = { ...sim.state.player };
    sim.update(0.05);
    expect(sim.state.player).toEqual(before);
  });
  it('stops before obstacles instead of cutting corners or silently switching axes', () => {
    const sim = fresh();
    sim.state.resources = [{ id: 0, kind: 'tree', x: 515, y: 500, hp: 3, readyAt: 0, scale: 1, variant: 0 }];
    sim.target = { x: 540, y: 510 };
    for (let i = 0; i < 10; i++) sim.update(0.05);
    expect(sim.state.player.x).toBeLessThanOrEqual(505);
    expect(sim.state.player.y).toBe(500);
    expect(sim.target).toBeNull();
    expect(sim.moving).toBe(false);
  });
  it('preserves a route during a zero-time frame or pause', () => {
    const sim = fresh();
    sim.target = { x: 550, y: 520 };
    sim.update(0);
    expect(sim.target).toEqual({ x: 550, y: 520 });
    sim.paused = true;
    sim.update(1);
    expect(sim.target).toEqual({ x: 550, y: 520 });
    expect(sim.state.player).toEqual({ x: 500, y: 500 });
    sim.paused = false;
    sim.update(0.05);
    expect(sim.state.direction).toBe('right');
  });
  it('rejects non-finite destinations without corrupting the player', () => {
    const sim = fresh();
    sim.target = { x: NaN, y: 500 };
    sim.update(0.05);
    expect(sim.target).toBeNull();
    expect(sim.state.player).toEqual({ x: 500, y: 500 });
  });
});

describe('old eight-way save compatibility', () => {
  it.each([
    ['up-right', 'up'],
    ['up-left', 'up'],
    ['down-right', 'down'],
    ['down-left', 'down'],
  ])('loads %s as %s and writes only the cardinal direction', (oldDirection, direction) => {
    const original = createGame('Old camp', 'explorer', 42);
    original.inventory.wood = 23;
    original.player = { x: 500, y: 500 };
    original.time = 75;
    const old = { ...original, direction: oldDirection };
    const before = JSON.stringify(old);
    const data = new Map([[SAVE_KEY, before]]);
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
      removeItem: (key: string) => data.delete(key),
    });
    expect(isGameState(old)).toBe(false);
    const migrated = loadGame()!;
    expect(migrated).not.toBeNull();
    expect(migrated).toEqual({ ...old, direction });
    expect(isGameState(migrated)).toBe(true);
    expect(JSON.stringify(old)).toBe(before);
    expect(saveGame(migrated)).toBe(true);
    expect(JSON.parse(data.get(SAVE_KEY)!).direction).toBe(direction);
    expect(loadGame()!.inventory.wood).toBe(23);
  });
  it('can migrate diagonal facing and missing forager slots in the same old save', () => {
    const old = JSON.parse(JSON.stringify(createGame('Old camp', 'explorer', 42)));
    old.direction = 'up-left';
    delete old.inventory.nuts;
    delete old.inventory.tea;
    const migrated = migrateGame(old)!;
    expect(migrated.direction).toBe('up');
    expect(migrated.inventory.nuts).toBe(0);
    expect(migrated.inventory.tea).toBe(0);
    expect(migrated.hotbar).toEqual(old.hotbar);
  });
  it.each(['north', 'UP', 'constructor', null, ['up']].map((direction) => ({ direction })))(
    'still rejects invalid saved direction %j',
    ({ direction }) => {
      const state = { ...createGame('Invalid camp', 'explorer', 42), direction };
      expect(isGameState(state)).toBe(false);
      expect(migrateGame(state)).toBeNull();
    },
  );
});
