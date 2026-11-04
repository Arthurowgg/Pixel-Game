import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { artImages, CLIPS, drawCarriedTool, playerPose, toolActionClip } from './animation';
import { DEFAULT_SETTINGS, distance, SETTINGS_KEY } from './data';
import registry from './generated-assets.json';
import { DIRECTIONS, facingDirection, GameInput, locomotionFrame, STABLE_WALK_FRAMES } from './movement';
import { createGame, Simulation } from './simulation';
import { isGameState, loadSettings, migrateGame } from './storage';
import type { Direction } from './types';
import { condition, meterValue, urgentVitals } from './vitals';

const fresh = () => {
  const sim = new Simulation(createGame('Fern', 'explorer', 42));
  sim.state.player = { x: 500, y: 500 };
  sim.state.resources = [];
  sim.state.fires = [];
  return sim;
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('four-way movement without invented artwork', () => {
  it.each([
    ['right', ['d'], 1, 0],
    ['right', ['arrowright'], 1, 0],
    ['down', ['s'], 0, 1],
    ['down', ['arrowdown'], 0, 1],
    ['left', ['a'], -1, 0],
    ['left', ['arrowleft'], -1, 0],
    ['up', ['w'], 0, -1],
    ['up', ['arrowup'], 0, -1],
  ] as [Direction, string[], number, number][])(
    'moves %s at the same total walking speed',
    (direction, keys, x, y) => {
      const sim = fresh();
      keys.forEach((key) => sim.keys.add(key));
      for (let i = 0; i < 20; i++) sim.update(0.05);
      const dx = sim.state.player.x - 500,
        dy = sim.state.player.y - 500;
      expect(Math.hypot(dx, dy)).toBeCloseTo(58, 7);
      expect(Math.sign(dx)).toBe(x);
      expect(Math.sign(dy)).toBe(y);
      expect(sim.state.direction).toBe(direction);
      expect(sim.state.distance).toBeCloseTo(58, 7);
      expect(playerPose(sim).clip).toBeDefined();
    },
  );
  it('uses only four facings and existing intact cardinal art', () => {
    expect(facingDirection(0, 0, 'left')).toBe('left');
    expect(facingDirection(NaN, 0)).toBe('down');
    expect(facingDirection(10, 1)).toBe('right');
    expect(facingDirection(-1, -1)).toBe('up');
    expect(facingDirection(-2, 1)).toBe('left');
    expect(facingDirection(1, 2)).toBe('down');
    expect(DIRECTIONS).toHaveLength(4);
    for (const direction of DIRECTIONS) {
      const sim = fresh();
      sim.state.direction = direction;
      expect(CLIPS[playerPose(sim).bodyName]).toBeDefined();
      expect(isGameState(JSON.parse(JSON.stringify(sim.state)))).toBe(true);
      expect(migrateGame(sim.state)?.direction).toBe(direction);
    }
  });
  it('stops gait, footsteps, and distance against a wall instead of running in place', () => {
    const sim = fresh();
    sim.state.player.x = 16;
    sim.keys.add('a');
    sim.keys.add('shift');
    sim.state.needs.stamina = 30;
    sim.onSound = vi.fn();
    for (let i = 0; i < 20; i++) sim.update(0.05);
    expect(sim.moving).toBe(false);
    expect(sim.sprinting).toBe(false);
    expect(sim.gaitDistance).toBe(0);
    expect(sim.state.distance).toBe(0);
    expect(sim.onSound).not.toHaveBeenCalledWith('step');
    expect(playerPose(sim).name).toBe('idle-down');
    expect(sim.state.needs.stamina).toBeGreaterThan(30);
  });
  it('stops at a tree without sliding along the other held direction', () => {
    const sim = fresh();
    const tree = { id: 0, kind: 'tree' as const, x: 510, y: 500, hp: 3, readyAt: 0, scale: 1, variant: 0 };
    sim.state.resources = [tree];
    sim.keys.add('s');
    sim.keys.add('d');
    sim.update(Math.sqrt(50) / 58);
    expect(distance(sim.state.player, tree)).toBeGreaterThanOrEqual(10);
    expect(sim.state.distance).toBeCloseTo(distance({ x: 500, y: 500 }, sim.state.player), 6);
    expect(sim.state.player).toEqual({ x: 500, y: 500 });
    expect(sim.moving).toBe(false);
    sim.keys.delete('d');
    sim.update(0.05);
    expect(sim.state.player.x).toBe(500);
    expect(sim.state.player.y).toBeGreaterThan(500);
    expect(sim.state.direction).toBe('down');
  });
  it('selects only safe source cells at a distance-driven cadence and freezes when paused', () => {
    expect([0, 9, 18, 27, 36].map((distance) => locomotionFrame(distance))).toEqual([0, 3, 4, 7, 0]);
    expect(locomotionFrame(28, true)).toBe(0);
    expect(locomotionFrame(NaN)).toBe(0);
    const sim = fresh();
    sim.keys.add('d');
    sim.keys.add('shift');
    sim.update(0.2);
    const pose = playerPose(sim),
      before = JSON.stringify(sim.state);
    expect(pose.name).toBe('run-right');
    expect(pose.bodyName).toBe('walk-right');
    expect(STABLE_WALK_FRAMES).toContain(pose.frame);
    sim.paused = true;
    sim.update(5);
    expect(JSON.stringify(sim.state)).toBe(before);
    expect(playerPose(sim).frame).toBe(pose.frame);
  });
  it('plants the feet while collecting and excludes the overstretched reach cells', () => {
    const sim = fresh();
    sim.state.resources = [
      { id: 0, kind: 'berries', x: 520, y: 500, hp: 1, readyAt: 0, scale: 1, variant: 0 },
    ];
    expect(sim.interact()).toBe(true);
    sim.keys.add('d');
    const start = { ...sim.state.player };
    sim.update(0.3);
    expect(sim.state.inventory.berries).toBe(3);
    expect(sim.state.player).toEqual(start);
    expect(playerPose(sim).frame).toBe(2);
    sim.update(0.05);
    expect(sim.state.inventory.berries).toBe(6);
    expect(sim.state.inventory.fiber).toBe(1);
    expect(sim.state.player).toEqual(start);
    expect(playerPose(sim).item).toBeNull();
    sim.update(0.2);
    expect([0, 1, 2]).toContain(playerPose(sim).frame);
    expect(sim.state.inventory.berries).toBe(6);
    sim.update(0.2);
    expect(sim.state.player.x).toBeGreaterThan(start.x);
  });
  it('preserves the complete axe/pickaxe contact frames for all four facing directions', () => {
    for (const direction of DIRECTIONS)
      for (const item of ['hatchet', 'pickaxe'] as const) {
        const sim = fresh();
        sim.state.direction = direction;
        sim.equip(item);
        sim.attack();
        sim.state.time = sim.action!.startedAt + 1 / 3 + 0.00001;
        const pose = playerPose(sim),
          clip = CLIPS[toolActionClip(pose)!];
        expect(pose.frame).toBe(4);
        expect(clip.impactFrame).toBe(4);
        expect(clip.frames).toBe(8);
        expect(pose.flip).toBe(direction.includes('left'));
      }
  });
  it('mirrors only the carried tool around the grip, not the strike sheet or atlas', () => {
    const ctx = {
      save: vi.fn(),
      scale: vi.fn(),
      drawImage: vi.fn(),
      restore: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    const old = artImages.items;
    artImages.items = { complete: true, naturalWidth: 128 } as HTMLImageElement;
    try {
      drawCarriedTool(ctx, 'hatchet');
      expect(ctx.scale).toHaveBeenCalledExactlyOnceWith(-1, 1);
      expect(ctx.drawImage).toHaveBeenCalledTimes(1);
      expect(ctx.restore).toHaveBeenCalledTimes(1);
      expect(vi.mocked(ctx.drawImage).mock.calls[0].slice(-4)).toEqual([-8, -13, 16, 16]);
    } finally {
      if (old) artImages.items = old;
      else delete artImages.items;
    }
  });
});

describe('shared keyboard and four-way touch controls', () => {
  it('does not release a direction still owned by another finger', () => {
    const keys = new Set<string>(),
      input = new GameInput(keys);
    input.press(1, ['d']);
    input.press(2, ['d']);
    input.release(1);
    expect([...keys]).toEqual(['d']);
    input.release(2);
    expect(keys.size).toBe(0);
  });
  it('merges keyboard/pointer input and clears every owner on pause or cancellation', () => {
    const keys = new Set<string>(),
      input = new GameInput(keys);
    input.key('w', true);
    input.press(4, ['a']);
    input.release(4);
    expect([...keys]).toEqual(['w']);
    input.key('w', false);
    expect(keys.size).toBe(0);
    input.press(8, ['s']);
    input.key('shift', true);
    input.clear();
    expect(keys.size).toBe(0);
    input.release(8);
    expect(keys.size).toBe(0);
  });
});

describe('trail interface details and generated frame families', () => {
  it('clamps meters and reports actionable low conditions without flashing', () => {
    expect(meterValue(-4)).toBe(0);
    expect(meterValue(105)).toBe(100);
    expect(meterValue(NaN)).toBe(0);
    expect(condition(24.9)).toBe('critical');
    expect(condition(25)).toBe('low');
    expect(condition(50)).toBe('steady');
    expect(urgentVitals({ health: 100, hunger: 10, thirst: 45, warmth: 70, stamina: 100 })).toEqual([
      'hunger',
      'thirst',
    ]);
  });
  it('adds compact HUD to old preferences without resetting their saved choices', () => {
    let value = JSON.stringify({ sound: false, effects: 0.65, atmosphere: false });
    vi.stubGlobal('localStorage', { getItem: (key: string) => (key === SETTINGS_KEY ? value : null) });
    expect(loadSettings()).toMatchObject({
      sound: false,
      effects: 0.65,
      atmosphere: false,
      compactHud: DEFAULT_SETTINGS.compactHud,
    });
    value = JSON.stringify({ compactHud: false });
    expect(loadSettings().compactHud).toBe(false);
  });
  it('ships ten different source bitmaps with correct bounds and keeps the original title frame', () => {
    expect(registry.frames.hud.file).toBe('art/ui/panel.png');
    const assets = [
      ...(['status', 'dialog', 'slot'] as const).map((key) => registry.frames[key]),
      ...(['heart', 'food', 'water', 'thermometer', 'stamina', 'settings', 'compass'] as const).map(
        (key) => registry.icons[key],
      ),
    ];
    expect(new Set(assets.map((asset) => asset.file)).size).toBe(10);
    for (const asset of assets) {
      const png = readFileSync(`public/${asset.file}`);
      expect(png.readUInt32BE(16)).toBe(asset.width);
      expect(png.readUInt32BE(20)).toBe(asset.height);
      expect(png.equals(readFileSync(`public/${asset.sourceAsset}`))).toBe(true);
      if ('slice' in asset) {
        expect(Number(asset.slice) * 2).toBeLessThan(asset.width);
        expect(Number(asset.slice) * 2).toBeLessThan(asset.height);
      }
    }
  });
});
