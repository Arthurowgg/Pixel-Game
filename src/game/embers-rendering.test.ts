import { afterEach, describe, expect, it, vi } from 'vitest';
import * as animation from './animation';
import { audio } from './audio';
import { CAMP, CAMP_BENCH, DEFAULT_SETTINGS } from './data';
import { ForestFeedback } from './feedback';
import { Renderer } from './renderer';
import { createGame, Simulation } from './simulation';
import type { Settings } from './types';

function canvasFixture(settings: Partial<Settings> = {}) {
  const fills: { style: string; args: number[] }[] = [];
  const target: Record<string, unknown> = {
    globalAlpha: 1,
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    fillRect: vi.fn((...args: number[]) => fills.push({ style: String(target.fillStyle), args })),
  };
  const ctx = new Proxy(target, {
    get: (object, key: string) => (object[key] ??= vi.fn()),
  }) as unknown as CanvasRenderingContext2D;
  const canvas = {
    clientWidth: 1001,
    clientHeight: 701,
    width: 0,
    height: 0,
    dataset: {},
    getContext: () => ctx,
  } as unknown as HTMLCanvasElement;
  vi.stubGlobal('document', { createElement: () => ({ getContext: () => ctx }) });
  const renderer = new Renderer(canvas, 42, {
    ...DEFAULT_SETTINGS,
    atmosphere: false,
    vignette: false,
    ...settings,
  });
  const sim = new Simulation(createGame('Ash', 'survivor', 42));
  sim.state.resources = [];
  sim.state.fires = [];
  sim.state.player = { x: 500, y: 500 };
  sim.state.time = 20;
  return { renderer, canvas, ctx, fills, sim };
}
afterEach(() => {
  audio.dispose();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('real render preferences, not decorative settings', () => {
  it('changes backing resolution and maps right-click positions correctly on odd viewport sizes', () => {
    const { renderer, canvas, sim } = canvasFixture();
    expect([canvas.width, canvas.height]).toEqual([501, 351]);
    expect(renderer.ctx.imageSmoothingEnabled).toBe(false);
    renderer.settings.pixelScale = 3;
    renderer.resize();
    renderer.draw(sim, 0);
    expect([canvas.width, canvas.height]).toEqual([334, 234]);
    expect(renderer.screenToWorld(1001, 701)).toEqual({
      x: renderer.camera.x + 334,
      y: renderer.camera.y + 234,
    });
    expect(renderer.screenToWorld(500.5, 350.5)).toEqual({
      x: renderer.camera.x + 167,
      y: renderer.camera.y + 117,
    });
  });
  it('turns the real vignette gradient off without mutating simulation time or health', () => {
    const { renderer, ctx, sim } = canvasFixture();
    const before = JSON.stringify(sim.state);
    renderer.draw(sim, 0);
    expect(ctx.createRadialGradient).not.toHaveBeenCalled();
    renderer.settings.vignette = true;
    renderer.draw(sim, 1);
    expect(ctx.createRadialGradient).toHaveBeenCalledOnce();
    expect(JSON.stringify(sim.state)).toBe(before);
  });
  it('hides floating text without discarding events or changing rewards', () => {
    const { renderer, ctx, sim } = canvasFixture({ floatingText: false });
    sim.floating = [{ x: 530, y: 480, text: '+4 pine wood', color: '#ffffff', life: 1 }];
    renderer.draw(sim, 0);
    expect(ctx.fillText).not.toHaveBeenCalled();
    renderer.settings.floatingText = true;
    renderer.draw(sim, 0);
    expect(ctx.fillText).toHaveBeenCalledWith('+4 pine wood', 530, 480);
    expect(sim.floating).toHaveLength(1);
  });
  it('controls damage flashes independently of atmosphere and respects reduced motion', () => {
    const { ctx, sim } = canvasFixture();
    const feedback = new ForestFeedback();
    sim.hitFlash = 0.3;
    feedback.screen(ctx, sim, { x: 0, y: 0 }, 500, 350, { ...DEFAULT_SETTINGS, atmosphere: false });
    expect(ctx.fillRect).toHaveBeenCalledTimes(4);
    vi.mocked(ctx.fillRect).mockClear();
    feedback.screen(ctx, sim, { x: 0, y: 0 }, 500, 350, {
      ...DEFAULT_SETTINGS,
      atmosphere: false,
      damageFlash: false,
    });
    feedback.screen(ctx, sim, { x: 0, y: 0 }, 500, 350, { ...DEFAULT_SETTINGS, reducedMotion: true });
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });
  it('removes storm flashes with the same flash switch', () => {
    const { renderer, sim, fills } = canvasFixture({ damageFlash: false });
    sim.state.weather = 'storm';
    sim.state.time = 238;
    renderer.draw(sim, 0);
    expect(fills.some((fill) => fill.style === '#e1e8df38')).toBe(false);
    fills.length = 0;
    renderer.settings.damageFlash = true;
    renderer.draw(sim, 0);
    expect(fills.some((fill) => fill.style === '#e1e8df38')).toBe(true);
  });
  it('keeps the wolf warning visible with motion and atmosphere disabled', () => {
    const { renderer, sim, ctx } = canvasFixture({ reducedMotion: true, damageFlash: false });
    const value = { id: 1, x: 540, y: 500, hp: 2, cooldown: 0, scared: 0 };
    sim.state.wolves = [value];
    const mind = sim.wolfPack.mind(value, sim.state.player, sim.state.time);
    mind.phase = 'windup';
    mind.startedAt = sim.state.time - 0.25;
    const draw = vi.spyOn(animation, 'drawAnimation').mockImplementation(() => {});
    renderer.draw(sim, 0);
    expect(ctx.strokeRect).toHaveBeenCalledWith(523, 493, 34, 12);
    expect(
      draw.mock.calls.some(([, name, , , , options]) => name === 'wolf-alert' && options?.frame === 0),
    ).toBe(true);
  });
  it('fades a complete existing wolf cell rather than synthesizing a death pose', () => {
    const { renderer, sim } = canvasFixture();
    const seen: { name: string; alpha: number; frame: number | undefined }[] = [];
    vi.spyOn(animation, 'drawAnimation').mockImplementation((ctx, name, _x, _y, _time, options) => {
      seen.push({ name, alpha: ctx.globalAlpha, frame: options?.frame });
      return true;
    });
    sim.wolfPack.fallen = [{ id: 1, x: 540, y: 500, startedAt: sim.state.time - 0.625, flip: false }];
    renderer.draw(sim, 0);
    expect(seen.find((value) => value.name === 'wolf-idle')).toEqual({
      name: 'wolf-idle',
      alpha: 0.5,
      frame: 0,
    });
    expect(seen.every((value) => !/sit|bite|death/.test(value.name))).toBe(true);
  });
  it('moves one whole log toward the hearth, then removes it only after contact', () => {
    const { renderer, sim } = canvasFixture();
    sim.state.player = { x: 500, y: 532 };
    sim.state.fires = [{ x: 500, y: 500, id: 0, fuel: 20 }];
    sim.state.inventory.wood = 1;
    sim.feedFire(0);
    const draw = vi.spyOn(animation, 'drawItem').mockImplementation(() => {});
    sim.state.time += 0.1;
    renderer.draw(sim, 0);
    expect(draw).toHaveBeenCalledOnce();
    const start = draw.mock.calls[0];
    draw.mockClear();
    sim.state.time += 0.4;
    renderer.draw(sim, 0);
    expect(draw).toHaveBeenCalledOnce();
    expect(draw.mock.calls[0][1]).toBe('wood');
    expect(draw.mock.calls[0].slice(2, 4)).not.toEqual(start.slice(2, 4));
    draw.mockClear();
    sim.update(0.1);
    renderer.draw(sim, 0);
    expect(draw).not.toHaveBeenCalled();
    expect(sim.state.inventory.wood).toBe(0);
  });
});

describe('real audio gains', () => {
  it('applies master, effects, ambience and mute to the actual Web Audio nodes', async () => {
    vi.useFakeTimers();
    const gains: {
      gain: {
        value: number;
        setTargetAtTime: ReturnType<typeof vi.fn>;
        setValueAtTime: ReturnType<typeof vi.fn>;
        linearRampToValueAtTime: ReturnType<typeof vi.fn>;
        exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
      };
      connect: (node: unknown) => unknown;
    }[] = [];
    const parameter = () => ({
      value: 0,
      setTargetAtTime: vi.fn(),
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    });
    const oscillator = vi.fn(() => ({
      frequency: parameter(),
      connect: (node: unknown) => node,
      start: vi.fn(),
      stop: vi.fn(),
    }));
    vi.stubGlobal('document', { hidden: false });
    vi.stubGlobal(
      'AudioContext',
      class {
        currentTime = 1;
        sampleRate = 100;
        state = 'running';
        destination = {};
        createGain() {
          const gain = { gain: parameter(), connect: (node: unknown) => node };
          gains.push(gain);
          return gain;
        }
        createBuffer() {
          return { getChannelData: () => new Float32Array(300) };
        }
        createBufferSource() {
          return { connect: (node: unknown) => node, start: vi.fn() };
        }
        createBiquadFilter() {
          return { frequency: parameter(), connect: (node: unknown) => node };
        }
        createOscillator = oscillator;
        close() {
          return Promise.resolve();
        }
      },
    );
    audio.configure({ ...DEFAULT_SETTINGS, masterVolume: 0.4, effects: 0.5, ambience: 0.2 });
    expect(await audio.unlock()).toBe(true);
    expect(gains[0].gain.value).toBeCloseTo(0.45 * 0.4);
    expect(gains[1].gain.value).toBeCloseTo(0.13 * 0.2);
    audio.play('notice');
    expect(gains[2].gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.5 * 0.08, 1.008);
    audio.configure({ ...DEFAULT_SETTINGS, sound: false, masterVolume: 0.4, ambience: 0.6 });
    expect(gains[0].gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 1, 0.15);
    expect(gains[1].gain.setTargetAtTime).toHaveBeenLastCalledWith(0.6 * 0.13, 1, 0.2);
    oscillator.mockClear();
    audio.play('notice');
    expect(oscillator).not.toHaveBeenCalled();
    audio.configure({ ...DEFAULT_SETTINGS, masterVolume: 0 });
    audio.play('notice');
    audio.configure({ ...DEFAULT_SETTINGS, effects: 0 });
    audio.play('notice');
    expect(oscillator).not.toHaveBeenCalled();
    audio.configure({ ...DEFAULT_SETTINGS, masterVolume: 0.7 });
    expect(gains[0].gain.setTargetAtTime).toHaveBeenLastCalledWith(0.45 * 0.7, 1, 0.15);
  });
  it('reports audio unavailable instead of claiming a sound check played', async () => {
    vi.stubGlobal(
      'AudioContext',
      class {
        constructor() {
          throw Error('restricted');
        }
      },
    );
    expect(await audio.unlock()).toBe(false);
  });
});

describe('whole static camp states and chopping feedback', () => {
  const names = ['campBench', 'seatedBench', 'pineStump', 'workbench'] as const;
  afterEach(() => {
    for (const name of names) delete animation.artImages[`object-${name}`];
  });
  const images = () =>
    Object.fromEntries(
      names.map((name) => {
        const image = { naturalWidth: 48, naturalHeight: 42 } as HTMLImageElement;
        animation.artImages[`object-${name}`] = image;
        return [name, image];
      }),
    );
  it('replaces both the empty bench and standing actor with one complete seated image', () => {
    const { renderer, canvas, ctx, sim } = canvasFixture();
    const sprites = images();
    sim.state.player = { ...CAMP_BENCH };
    sim.state.fires = [{ ...CAMP, id: 0, fuel: 40 }];
    for (let i = 0; i < 80; i++) sim.update(0.01);
    expect(sim.seated).toBe(true);
    const draw = vi.spyOn(animation, 'drawAnimation').mockImplementation(() => {});
    renderer.draw(sim, 0);
    expect(canvas.dataset.spriteSheet).toBe('seated-bench');
    expect(
      vi.mocked(ctx.drawImage).mock.calls.filter(([image]) => image === sprites.seatedBench),
    ).toHaveLength(1);
    expect(vi.mocked(ctx.drawImage).mock.calls.some(([image]) => image === sprites.campBench)).toBe(false);
    expect(draw.mock.calls.some(([, name]) => /^(idle|walk|feed)-/.test(name))).toBe(false);
    sim.keys.add('d');
    sim.update(0.01);
    vi.mocked(ctx.drawImage).mockClear();
    renderer.draw(sim, 0);
    expect(vi.mocked(ctx.drawImage).mock.calls.some(([image]) => image === sprites.campBench)).toBe(true);
    expect(vi.mocked(ctx.drawImage).mock.calls.some(([image]) => image === sprites.seatedBench)).toBe(false);
    expect(canvas.dataset.spriteSheet).not.toBe('seated-bench');
  });
  it('draws the generated stump after the existing fall clip finishes', () => {
    const { renderer, canvas, ctx, sim } = canvasFixture();
    const sprites = images();
    sim.state.resources = [
      { id: 0, kind: 'tree', x: 540, y: 500, hp: 0, readyAt: 200, scale: 1, variant: 0 },
    ];
    renderer.draw(sim, 0);
    expect(canvas.dataset.stumps).toBe('1');
    expect(
      vi
        .mocked(ctx.drawImage)
        .mock.calls.some(([image, , , w, h]) => image === sprites.pineStump && w === 26 && h === 22),
    ).toBe(true);
  });
  it('plays the literal falling leaf clip, then hides it with either relevant preference', () => {
    const { renderer, canvas, sim } = canvasFixture({ atmosphere: true });
    sim.fallingLeaves = [{ x: 530, y: 450, startedAt: 19.7, duration: 2, drift: 4, phase: 0 }];
    const draw = vi.spyOn(animation, 'drawAnimation').mockImplementation(() => {});
    renderer.draw(sim, 0);
    expect(canvas.dataset.chopLeaves).toBe('1');
    expect(
      draw.mock.calls.some(([, name, , , , options]) => name === 'leaf-drift' && options?.scale === 0.65),
    ).toBe(true);
    for (const settings of [
      { atmosphere: false, reducedMotion: false },
      { atmosphere: true, reducedMotion: true },
    ]) {
      Object.assign(renderer.settings, settings);
      draw.mockClear();
      renderer.draw(sim, 0);
      expect(canvas.dataset.chopLeaves).toBe('0');
      expect(
        draw.mock.calls.some(([, name, , , , options]) => name === 'leaf-drift' && options?.scale === 0.65),
      ).toBe(false);
      expect(sim.fallingLeaves).toHaveLength(1);
    }
  });
  it('keeps a pounce landing marker visible with reduced motion and scales the stronger health bar', () => {
    const { renderer, ctx, sim } = canvasFixture({ reducedMotion: true });
    const wolf = { id: 1, x: 590, y: 500, hp: 3, maxHp: 4, cooldown: 0, scared: 0 };
    sim.state.wolves = [wolf];
    const mind = sim.wolfPack.mind(wolf, sim.state.player, sim.state.time);
    mind.phase = 'windup';
    mind.attack = 'pounce';
    mind.startedAt = sim.state.time - 0.3;
    const draw = vi.spyOn(animation, 'drawAnimation').mockImplementation(() => {});
    renderer.draw(sim, 0);
    expect(ctx.strokeRect).toHaveBeenCalledWith(488, 493, 24, 14);
    expect(ctx.fillRect).toHaveBeenCalledWith(580, 470, 15, 2);
    expect(
      draw.mock.calls.some(([, name, , , , options]) => name === 'wolf-alert' && options?.frame === 0),
    ).toBe(true);
  });
  it('renders an honest placement ghost without creating or spending the workbench', () => {
    const { renderer, canvas, ctx, sim } = canvasFixture();
    const sprites = images();
    sim.state.inventory.workbench = 1;
    sim.equip('workbench');
    sim.aim = { x: 540, y: 520 };
    renderer.draw(sim, 0);
    expect(canvas.dataset.placement).toBe('valid');
    expect(canvas.dataset.workbenchCount).toBe('0');
    expect(
      vi
        .mocked(ctx.drawImage)
        .mock.calls.some(([image, , , w, h]) => image === sprites.workbench && w === 42 && h === 30),
    ).toBe(true);
    sim.aim = { ...sim.state.player };
    renderer.draw(sim, 0);
    expect(canvas.dataset.placement).toBe('blocked');
    expect(sim.state.inventory.workbench).toBe(1);
    expect(sim.state.workbenches).toEqual([]);
  });
});
