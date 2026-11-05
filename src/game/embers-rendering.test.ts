import { afterEach, describe, expect, it, vi } from 'vitest';
import * as animation from './animation';
import { audio } from './audio';
import { DEFAULT_SETTINGS } from './data';
import { ForestFeedback } from './feedback';
import { Renderer } from './renderer';
import { createGame, Simulation } from './simulation';
import type { Settings } from './types';

function canvasFixture(settings: Partial<Settings> = {}) {
  const fills: { style: string; args: number[] }[] = [];
  const target: Record<string, unknown> = {
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
