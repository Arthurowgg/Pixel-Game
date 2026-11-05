import { afterEach, describe, expect, it, vi } from 'vitest';
import { playerPose, CLIPS } from './animation';
import { CAMP, DEFAULT_SETTINGS, distance, SETTINGS_KEY } from './data';
import { createGame, Simulation } from './simulation';
import { loadSettings, saveSettings, isGameState } from './storage';
import { WolfPack, WOLF_FADE, WOLF_WINDUP, WOLF_SPACING } from './wolves';
import type { GameState, Point, Wolf } from './types';

const fresh = () => {
  const sim = new Simulation(createGame('Rowan', 'survivor', 42));
  sim.state.player = { x: 500, y: 500 };
  sim.state.resources = [];
  sim.state.fires = [];
  return sim;
};
const wolf = (id = 1, x = 548, y = 500, hp = 2): Wolf => ({ id, x, y, hp, cooldown: 0, scared: 0 });
const advance = (sim: Simulation, seconds: number) => {
  for (let left = seconds; left > 0.000001; left -= 0.01) sim.update(Math.min(left, 0.01));
};
const packFixture = (...wolves: Wolf[]) => {
  const state = fresh().state;
  state.time = 120;
  state.weather = 'wolves';
  state.wolves = wolves;
  const pack = new WolfPack(),
    bite = vi.fn();
  let blocked: (point: Point) => boolean = () => false;
  let torch = false;
  const tick = (seconds: number) => {
    for (let left = seconds; left > 0.000001; left -= 0.01) {
      const dt = Math.min(left, 0.01);
      state.time += dt;
      pack.update(state, dt, torch, blocked, bite);
    }
  };
  return {
    state,
    pack,
    bite,
    tick,
    block: (fn: typeof blocked) => {
      blocked = fn;
    },
    lightTorch: () => {
      torch = true;
    },
  };
};
const camp = () => {
  const sim = fresh();
  sim.state.player.y = 532;
  sim.state.fires = [{ id: 0, x: 500, y: 500, fuel: 30 }];
  sim.state.inventory.wood = 2;
  return sim;
};
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('a readable, separated wolf pack', () => {
  it('warns before lunging and bites at most once per committed attack', () => {
    const f = packFixture(wolf());
    f.tick(0.01);
    expect(f.pack.minds.get(1)?.phase).toBe('windup');
    const position = { x: f.state.wolves[0].x, y: f.state.wolves[0].y };
    f.tick(WOLF_WINDUP - 0.02);
    expect(f.state.wolves[0]).toMatchObject(position);
    expect(f.bite).not.toHaveBeenCalled();
    f.tick(0.4);
    expect(f.bite).toHaveBeenCalledTimes(1);
    expect(f.pack.minds.get(1)?.phase).toBe('recover');
    f.tick(0.7);
    expect(f.bite).toHaveBeenCalledTimes(1);
  });
  it('locks its landing point at the warning so the player can dodge on a cardinal axis', () => {
    const f = packFixture(wolf());
    f.tick(0.01);
    f.state.player.y -= 60;
    f.tick(0.9);
    expect(f.pack.minds.get(1)?.target).toEqual({ x: 500, y: 500 });
    expect(f.bite).not.toHaveBeenCalled();
    expect(f.state.wolves[0].y).toBeGreaterThan(495);
  });
  it('takes turns attacking instead of simultaneous pile-on lunges', () => {
    const f = packFixture(wolf(1, 548, 500), wolf(2, 500, 558), wolf(3, 452, 500));
    const attackers = new Set<number>();
    for (let i = 0; i < 700; i++) {
      f.tick(0.01);
      const active = [...f.pack.minds].filter(([, mind]) => ['windup', 'lunge'].includes(mind.phase));
      expect(active.length).toBeLessThanOrEqual(1);
      active.forEach(([id]) => attackers.add(id));
      for (const a of f.state.wolves)
        for (const b of f.state.wolves)
          if (a !== b) expect(distance(a, b)).toBeGreaterThanOrEqual(WOLF_SPACING - 0.001);
    }
    expect(attackers.size).toBeGreaterThanOrEqual(2);
    expect(f.bite.mock.calls.length).toBeLessThan(6);
  });
  it('separates overlapping legacy wolves without trapping them together', () => {
    const f = packFixture(wolf(1, 560, 500), wolf(2, 560, 500), wolf(3, 560, 500));
    f.tick(3);
    for (const a of f.state.wolves)
      for (const b of f.state.wolves)
        if (a !== b) expect(distance(a, b)).toBeGreaterThanOrEqual(WOLF_SPACING - 0.01);
  });
  it('cannot lunge through a solid trunk to damage the survivor', () => {
    const f = packFixture(wolf(1, 548, 500));
    f.block((point) => distance(point, { x: 524, y: 500 }) < 10);
    f.tick(1);
    expect(f.bite).not.toHaveBeenCalled();
    expect(f.state.wolves[0].x).toBeGreaterThanOrEqual(533.99);
  });
  it('steers around obstacles without entering their collision footprint', () => {
    const f = packFixture(wolf(1, 650, 500), wolf(2, 660, 530));
    const blocked = (point: Point) => distance(point, { x: 610, y: 520 }) < 18;
    f.block(blocked);
    for (let i = 0; i < 500; i++) {
      f.tick(0.01);
      for (const value of f.state.wolves) expect(blocked(value)).toBe(false);
    }
    expect(Math.min(...f.state.wolves.map((value) => distance(value, f.state.player)))).toBeLessThan(90);
  });
  it.each(['fire', 'torch'] as const)('backs away from %s instead of entering a bite loop', (source) => {
    const f = packFixture(wolf(1, 530, 500));
    if (source === 'fire') f.state.fires = [{ x: 500, y: 500, id: 0, fuel: 60 }];
    else f.lightTorch();
    f.tick(1);
    expect(f.bite).not.toHaveBeenCalled();
    expect(f.pack.minds.get(1)?.phase).toBe('retreat');
    expect(distance(f.state.wolves[0], f.state.player)).toBeGreaterThan(50);
  });
  it('walks out when a newly lit fire encloses a wolf instead of trapping it forever', () => {
    const f = packFixture(wolf(1, 510, 500));
    f.state.fires = [{ id: 0, x: 500, y: 500, fuel: 60 }];
    f.block((point) => distance(point, f.state.fires[0]) < 35);
    f.tick(1.2);
    expect(distance(f.state.wolves[0], f.state.fires[0])).toBeGreaterThanOrEqual(35);
    expect(f.bite).not.toHaveBeenCalled();
  });
  it('recovers a legacy wolf overlapping a trunk before allowing an attack', () => {
    const f = packFixture(wolf());
    const blocked = (point: Point) => distance(point, { x: 548, y: 500 }) < 10;
    f.block(blocked);
    f.tick(0.01);
    expect(f.pack.minds.get(1)?.phase).not.toBe('windup');
    f.tick(0.6);
    expect(blocked(f.state.wolves[0])).toBe(false);
    expect(f.bite).not.toHaveBeenCalled();
  });
  it('does not treat an extinguished fire as protection', () => {
    const f = packFixture(wolf());
    f.state.fires = [{ x: 500, y: 500, id: 0, fuel: 0 }];
    f.tick(1);
    expect(f.bite).toHaveBeenCalledTimes(1);
  });
  it('interrupts a warning when hit and prevents a ghost bite afterward', () => {
    const f = packFixture(wolf());
    f.tick(0.3);
    f.state.wolves[0].hp--;
    f.pack.hit(f.state.wolves[0], f.state.player, f.state.time, () => false);
    expect(f.pack.minds.get(1)?.phase).toBe('hurt');
    expect(f.state.wolves[0].x).toBe(555);
    f.tick(0.6);
    expect(f.bite).not.toHaveBeenCalled();
  });
  it('keeps knockback collision-safe and does not shove a wolf into another', () => {
    const a = wolf(1, 548),
      b = wolf(2, 580),
      f = packFixture(a, b);
    f.pack.hit(a, f.state.player, 120, () => false, [a, b]);
    expect(distance(a, b)).toBeGreaterThanOrEqual(WOLF_SPACING);
    const before = a.x;
    f.pack.hit(a, f.state.player, 121, (point) => point.x > before + 1, [a, b]);
    expect(a.x).toBe(before);
  });
  it('keeps defeat feedback transient, expires it, and rejects duplicate death entries', () => {
    const f = packFixture(wolf());
    const down = f.state.wolves[0];
    down.hp = 0;
    f.pack.hit(down, f.state.player, f.state.time, () => false);
    f.pack.hit(down, f.state.player, f.state.time, () => false);
    expect(f.pack.fallen).toHaveLength(1);
    expect(f.pack.minds.has(down.id)).toBe(false);
    f.state.wolves = [];
    expect(JSON.stringify(f.state)).not.toContain('fallen');
    f.tick(WOLF_FADE + 0.01);
    expect(f.pack.fallen).toHaveLength(0);
  });
  it('does not advance intent or cooldown on a zero-time tick', () => {
    const f = packFixture(wolf());
    f.pack.update(f.state, 0, false, () => false, f.bite);
    expect(f.pack.minds.size).toBe(0);
    expect(f.state.wolves[0]).toEqual(wolf());
  });
  it('spawns packs on free ground, not inside water, trees, or each other', () => {
    const sim = new Simulation(createGame('Ash', 'wild', 42));
    sim.state.player = { x: 1050, y: 850 };
    sim.state.time = 119.99;
    sim.update(0.02);
    expect(sim.state.wolves).toHaveLength(3);
    for (const value of sim.state.wolves) expect(sim.collision(value)).toBe(false);
    for (const a of sim.state.wolves)
      for (const b of sim.state.wolves) if (a !== b) expect(distance(a, b)).toBeGreaterThan(19);
  });
});

describe('manual tools and forgiving, aimed combat', () => {
  it.each([
    ['tree', 'hatchet', 3],
    ['stone', 'pickaxe', 2],
  ] as const)('requires the manually equipped tool for %s even when it is in the pack', (kind, tool, hp) => {
    const sim = fresh();
    sim.state.resources = [{ id: 0, kind, x: 530, y: 500, hp, readyAt: 0, scale: 1, variant: 0 }];
    sim.equip('water');
    expect(sim.interact()).toBe(false);
    expect(sim.state.equipped).toBe('water');
    advance(sim, 0.7);
    expect(sim.state.resources[0].hp).toBe(hp);
    expect(sim.toasts.at(-1)?.text).toMatch(/Equip your/);
    sim.equip(tool);
    expect(sim.interact()).toBe(true);
    advance(sim, 0.4);
    expect(sim.state.resources[0].hp).toBe(hp - 1);
  });
  it('leaves F unbound, while held primary input repeats the equipped tool action', () => {
    const sim = fresh();
    sim.state.resources = [{ id: 0, kind: 'tree', x: 530, y: 500, hp: 3, readyAt: 0, scale: 1, variant: 0 }];
    sim.keys.add('f');
    advance(sim, 1);
    expect(sim.action).toBeNull();
    expect(sim.state.resources[0].hp).toBe(3);
    sim.keys.add('primary');
    sim.aim = { x: 530, y: 470 };
    advance(sim, 2.2);
    expect(sim.state.inventory.wood).toBe(4);
    expect(sim.state.inventory.nuts).toBe(1);
  });
  it('never equips an axe implicitly for defense or mines with the wrong tool', () => {
    const sim = fresh();
    sim.state.resources = [{ id: 0, kind: 'stone', x: 530, y: 500, hp: 2, readyAt: 0, scale: 1, variant: 0 }];
    sim.useHeld({ x: 530, y: 490 });
    advance(sim, 0.7);
    expect(sim.state.resources[0].hp).toBe(2);
    sim.equip('berries');
    sim.attack();
    expect(sim.action?.item).toBe('berries');
    expect(sim.state.equipped).toBe('berries');
  });
  it('accepts a click on a nearby wolf body and lands damage only on axe contact', () => {
    const sim = fresh();
    vi.spyOn(sim.wolfPack, 'update').mockImplementation(() => {});
    const target = wolf(1, 570);
    sim.state.wolves = [target];
    expect(sim.useHeld({ x: 570, y: 478 })).toBe(true);
    expect(sim.action?.kind).toBe('attack');
    advance(sim, 0.3);
    expect(target.hp).toBe(2);
    advance(sim, 0.05);
    expect(target.hp).toBe(1);
    expect(sim.wolfPack.minds.get(1)?.phase).toBe('hurt');
    expect(sim.state.equipped).toBe('hatchet');
  });
  it('sweeps up to two targets in front without hitting behind or outside reach', () => {
    const sim = fresh();
    vi.spyOn(sim.wolfPack, 'update').mockImplementation(() => {});
    sim.state.wolves = [wolf(1, 560), wolf(2, 552, 521), wolf(3, 551, 476), wolf(4, 452), wolf(5, 577)];
    sim.attack({ x: 560, y: 500 });
    advance(sim, 0.4);
    expect(sim.state.wolves.filter((value) => value.hp === 1)).toHaveLength(2);
    expect(sim.state.wolves.find((value) => value.id === 4)?.hp).toBe(2);
    expect(sim.state.wolves.find((value) => value.id === 5)?.hp).toBe(2);
  });
  it('cancels an uncommitted attack when switching equipment', () => {
    const sim = fresh();
    vi.spyOn(sim.wolfPack, 'update').mockImplementation(() => {});
    sim.state.wolves = [wolf()];
    sim.attack();
    advance(sim, 0.2);
    sim.equip('water');
    advance(sim, 0.5);
    expect(sim.state.wolves[0].hp).toBe(2);
    expect(sim.state.kills).toBe(0);
  });
  it('counts each defeated wolf once and never reloads a corpse or pending hit', () => {
    const sim = fresh();
    vi.spyOn(sim.wolfPack, 'update').mockImplementation(() => {});
    sim.state.wolves = [wolf(1, 548, 500, 1)];
    sim.attack();
    advance(sim, 0.4);
    expect(sim.state.kills).toBe(1);
    expect(sim.state.wolves).toHaveLength(0);
    expect(sim.wolfPack.fallen).toHaveLength(1);
    const saved = JSON.parse(JSON.stringify(sim.state)) as GameState;
    expect(isGameState(saved)).toBe(true);
    const restored = new Simulation(saved);
    expect(restored.wolfPack.fallen).toHaveLength(0);
    expect(restored.action).toBeNull();
    advance(sim, 1);
    sim.attack();
    advance(sim, 0.4);
    expect(sim.state.kills).toBe(1);
  });
  it('prioritizes the aimed wolf over a nearby tree with the correct tool still equipped', () => {
    const sim = fresh();
    vi.spyOn(sim.wolfPack, 'update').mockImplementation(() => {});
    sim.state.resources = [{ id: 0, kind: 'tree', x: 530, y: 520, hp: 3, readyAt: 0, scale: 1, variant: 0 }];
    sim.state.wolves = [wolf(1, 552)];
    sim.useHeld({ x: 552, y: 488 });
    advance(sim, 0.4);
    expect(sim.state.resources[0].hp).toBe(3);
    expect(sim.state.wolves[0].hp).toBe(1);
  });
});

describe('a quiet, live hearth with one log action', () => {
  it('focuses after a short safe rest, keeps fuel burning, and preserves equipment', () => {
    const sim = camp();
    advance(sim, 0.64);
    expect(sim.view().camp).toBeNull();
    advance(sim, 0.02);
    expect(sim.view().camp?.id).toBe(0);
    expect(sim.state.equipped).toBe('hatchet');
    expect(playerPose(sim).item).toBeNull();
    expect(playerPose(sim).name).toBe('idle-up');
    const fuel = sim.state.fires[0].fuel;
    advance(sim, 1);
    expect(sim.state.fires[0].fuel).toBeLessThan(fuel);
    expect(sim.paused).toBe(false);
    sim.leaveCamp();
    expect(playerPose(sim).item).toBe('hatchet');
  });
  it('does not steal the nearby placed-workbench interaction', () => {
    const sim = fresh();
    sim.state.player = { x: 940, y: 758 };
    sim.state.fires = [{ ...CAMP, id: 0, fuel: 60 }];
    sim.onOpenCrafting = vi.fn();
    sim.state.workbenches = [{ id: 0, x: 940, y: 738 }];
    for (const x of [940, 925, 955]) {
      sim.state.player.x = x;
      advance(sim, 2);
      expect(sim.campFocus).toBeNull();
      expect(sim.nearest()?.kind).toBe('workbench');
      sim.interact();
    }
    expect(sim.onOpenCrafting).toHaveBeenCalledTimes(3);
  });
  it('spends exactly one log at the delayed contact, not at button press or recovery', () => {
    const sim = camp();
    expect(sim.feedFire(0)).toBe(true);
    expect(sim.feedFire(0)).toBe(false);
    expect(sim.view().camp?.feeding).toBe(true);
    advance(sim, 0.57);
    expect(sim.state.inventory.wood).toBe(2);
    advance(sim, 0.03);
    expect(sim.state.inventory.wood).toBe(1);
    expect(sim.state.fires[0].fuel).toBeCloseTo(65 - 0.6 * 0.25, 6);
    expect(sim.view().camp?.progress).toBeCloseTo(0.6 / 1.05);
    advance(sim, 1);
    expect(sim.action).toBeNull();
    expect(sim.feedingFire).toBeNull();
    expect(sim.state.inventory.wood).toBe(1);
  });
  it('never turns a held E into automatic log feeding in the quiet view', () => {
    const sim = camp();
    sim.keys.add('e');
    sim.interact();
    advance(sim, 2.2);
    expect(sim.state.inventory.wood).toBe(1);
    expect(sim.action).toBeNull();
  });
  it.each(['keyboard', 'route'] as const)('cancels a pending log when %s movement starts', (control) => {
    const sim = camp();
    sim.feedFire(0);
    advance(sim, 0.25);
    if (control === 'keyboard') sim.keys.add('d');
    else sim.target = { x: 550, y: 532 };
    advance(sim, 0.5);
    expect(sim.campFocus).toBeNull();
    expect(sim.feedingFire).toBeNull();
    expect(sim.state.inventory.wood).toBe(2);
    expect(sim.state.player.x).toBeGreaterThan(500);
  });
  it('cancels before contact when leaving the view or choosing another item', () => {
    for (const leave of [(sim: Simulation) => sim.leaveCamp(), (sim: Simulation) => sim.equip('berries')]) {
      const sim = camp();
      sim.feedFire(0);
      advance(sim, 0.3);
      leave(sim);
      advance(sim, 0.8);
      expect(sim.state.inventory.wood).toBe(2);
      expect(sim.action).toBeNull();
    }
  });
  it('does not refund an already placed log when movement cancels recovery', () => {
    const sim = camp();
    sim.feedFire(0);
    advance(sim, 0.6);
    sim.keys.add('d');
    advance(sim, 0.5);
    expect(sim.state.inventory.wood).toBe(1);
    expect(sim.state.fires[0].fuel).toBeCloseTo(65 - 1.1 * 0.25, 6);
  });
  it('freezes pending placement only for a real pause and resumes without duplicating it', () => {
    const sim = camp();
    sim.feedFire(0);
    advance(sim, 0.4);
    sim.paused = true;
    const before = JSON.stringify(sim.state),
      progress = sim.view().camp?.progress;
    advance(sim, 2);
    expect(JSON.stringify(sim.state)).toBe(before);
    expect(sim.view().camp?.progress).toBe(progress);
    sim.paused = false;
    advance(sim, 0.3);
    expect(sim.state.inventory.wood).toBe(1);
  });
  it.each(['health', 'hunger', 'thirst'] as const)(
    'does not hide critically low %s behind camp focus',
    (need) => {
      const sim = camp();
      sim.state.needs[need] = 5;
      advance(sim, 1);
      expect(sim.campFocus).toBeNull();
    },
  );
  it('restores the HUD and cancels a pending log when danger approaches', () => {
    const sim = camp();
    sim.state.time = 120;
    sim.state.weather = 'wolves';
    sim.feedFire(0);
    advance(sim, 0.57);
    sim.state.wolves = [wolf(1, 530, 532)];
    advance(sim, 0.4);
    expect(sim.campFocus).toBeNull();
    expect(sim.action).toBeNull();
    expect(sim.state.inventory.wood).toBe(2);
  });
  it('lets E reopen a dismissed full or empty-stock hearth without spending anything', () => {
    const sim = camp();
    advance(sim, 0.7);
    sim.leaveCamp();
    advance(sim, 1);
    expect(sim.campFocus).toBeNull();
    sim.state.inventory.wood = 0;
    sim.state.fires[0].fuel = 95;
    sim.interact();
    expect(sim.campFocus).toBe(0);
    expect(sim.view().camp?.canFeed).toBe(false);
    expect(sim.action).toBeNull();
  });
  it('respects dismissal until the survivor leaves range and comes back', () => {
    const sim = camp();
    advance(sim, 0.7);
    sim.leaveCamp();
    advance(sim, 2);
    expect(sim.campFocus).toBeNull();
    sim.state.player.y = 600;
    advance(sim, 0.1);
    sim.state.player.y = 532;
    advance(sim, 0.7);
    expect(sim.campFocus).toBe(0);
  });
  it('relights an empty fire and reports the rain-adjusted remaining time', () => {
    const sim = camp();
    sim.state.fires[0].fuel = 0;
    sim.state.time = 60;
    sim.state.weather = 'rain';
    sim.feedFire(0);
    advance(sim, 0.6);
    expect(sim.fireNearby).toBe(true);
    expect(sim.view().camp?.secondsLeft).toBe(Math.ceil(sim.state.fires[0].fuel / 0.44));
  });
  it('rejects distant, missing, overfilled, and unfunded log actions', () => {
    const sim = camp();
    expect(sim.feedFire(99)).toBe(false);
    sim.state.fires[0].fuel = 81;
    expect(sim.feedFire(0)).toBe(false);
    sim.state.fires[0].fuel = 50;
    sim.state.inventory.wood = 0;
    expect(sim.feedFire(0)).toBe(false);
    sim.state.inventory.wood = 2;
    sim.state.player.y = 600;
    expect(sim.feedFire(0)).toBe(false);
    expect(sim.state.inventory.wood).toBe(2);
  });
  it('uses only intact, safe existing feed cells and never references a pretend sitting clip', () => {
    const sim = camp();
    sim.feedFire(0);
    for (let i = 0; i < 100; i++) {
      const pose = playerPose(sim);
      expect(CLIPS[pose.bodyName]).toBeDefined();
      expect([0, 1, 2]).toContain(pose.frame);
      expect(pose.name).not.toMatch(/sit|crouch/);
      advance(sim, 0.01);
    }
  });
});

describe('functional preference storage', () => {
  it('supplies new defaults to existing preferences without changing their old choices', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => JSON.stringify({ sound: false, effects: 0.2, compactHud: false }),
    });
    expect(loadSettings()).toEqual({ ...DEFAULT_SETTINGS, sound: false, effects: 0.2, compactHud: false });
  });
  it('round-trips every added option, including true zero-volume settings', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key),
      setItem: (key: string, value: string) => values.set(key, value),
    });
    const settings = {
      ...DEFAULT_SETTINGS,
      pixelScale: 3 as const,
      masterVolume: 0,
      effects: 0,
      ambience: 0,
      damageFlash: false,
      floatingText: false,
      vignette: false,
      showHints: false,
    };
    saveSettings(settings);
    expect(values.has(SETTINGS_KEY)).toBe(true);
    expect(loadSettings()).toEqual(settings);
  });
  it('rejects non-integer scales, non-boolean switches, and unsafe volume values', () => {
    vi.stubGlobal('localStorage', {
      getItem: () =>
        JSON.stringify({
          pixelScale: 2.5,
          masterVolume: 40,
          effects: -1,
          ambience: 'loud',
          damageFlash: 'false',
          floatingText: null,
          vignette: 0,
        }),
    });
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });
  it('handles unavailable storage without throwing or modifying the defaults', () => {
    const before = structuredClone(DEFAULT_SETTINGS);
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw Error('blocked');
      },
      setItem: () => {
        throw Error('blocked');
      },
    });
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    expect(() => saveSettings({ ...DEFAULT_SETTINGS, masterVolume: 0 })).not.toThrow();
    expect(DEFAULT_SETTINGS).toEqual(before);
  });
});
