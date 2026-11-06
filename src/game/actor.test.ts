import { describe, expect, it } from 'vitest';
import { drawActor } from './actor';
import type { ActorInput } from './actor';
import type { Direction } from './types';

interface FillCall {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}

interface ScaleCall {
  x: number;
  y: number;
}

function harness() {
  const fills: FillCall[] = [];
  const scales: ScaleCall[] = [];
  let color = '#000000';
  const target: Record<string, unknown> = {
    set fillStyle(value: string) {
      color = value;
    },
    get fillStyle() {
      return color;
    },
    fillRect: (x: number, y: number, w: number, h: number) => fills.push({ x, y, w, h, color }),
    scale: (x: number, y: number) => scales.push({ x, y }),
  };
  const ctx = new Proxy(target, {
    get: (object, key: string) => (object[key] ??= () => {}),
    set: (object, key: string, value) => {
      object[key] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, fills, scales };
}

const base: ActorInput = {
  x: 100,
  y: 200,
  time: 3,
  gait: 0,
  moving: false,
  sprinting: false,
  direction: 'down',
  equipped: 'hatchet',
  torchLit: false,
  action: null,
  reducedMotion: false,
};

const BLADE = new Set(['#9aa89a', '#d8dfd0']);
const bladeFills = (fills: FillCall[]) => fills.filter((fill) => BLADE.has(fill.color));

const bounds = (fills: FillCall[]) => ({
  minX: Math.min(...fills.map((fill) => fill.x)),
  maxX: Math.max(...fills.map((fill) => fill.x + fill.w)),
  minY: Math.min(...fills.map((fill) => fill.y)),
  maxY: Math.max(...fills.map((fill) => fill.y + fill.h)),
});

describe('authored survivor rig', () => {
  it('keeps every painted pixel inside one consistent body silhouette', () => {
    for (const direction of ['down', 'up', 'left', 'right'] as Direction[]) {
      for (const action of [
        null,
        { kind: 'chop', item: 'hatchet' as const, progress: 0.45, direction },
        { kind: 'attack', item: 'hatchet' as const, progress: 0.5, direction },
        { kind: 'forage', item: null, progress: 0.5, direction },
        { kind: 'eat', item: 'berries' as const, progress: 0.5, direction },
      ]) {
        const { ctx, fills } = harness();
        drawActor(ctx, {
          ...base,
          direction,
          moving: !action,
          gait: 24,
          action: action ?? null,
        });
        const box = bounds(fills);
        // Local space (the canvas translate is stubbed out): includes the axe and
        // its swing trail, so nothing may fling an arm past this envelope.
        expect(box.minX).toBeGreaterThan(-30);
        expect(box.maxX).toBeLessThan(32);
        expect(box.minY).toBeGreaterThan(-52);
        expect(box.maxY).toBeLessThan(10);
      }
    }
  });

  it('draws one silhouette pass before the coloured body', () => {
    const { ctx, fills } = harness();
    drawActor(ctx, base);
    const outline = fills.filter((fill) => fill.color === '#2b1d14');
    expect(outline.length).toBeGreaterThan(fills.length / 3);
    expect(fills[0].color).toBe('#2b1d14');
  });

  it('shows a fading tool trail during the strike and not while idle', () => {
    const idle = harness();
    drawActor(idle.ctx, base);
    const idleBlade = bladeFills(idle.fills).length;

    const strike = harness();
    drawActor(strike.ctx, {
      ...base,
      action: { kind: 'chop', item: 'hatchet', progress: 0.42, direction: 'right' },
    });
    const strikeBlade = bladeFills(strike.fills).length;
    expect(strikeBlade).toBeGreaterThan(idleBlade);
  });

  it('mirrors the whole rig for left-facing swings so the blade always leads', () => {
    const swing = (direction: Direction) => {
      const { ctx, fills, scales } = harness();
      drawActor(ctx, {
        ...base,
        direction,
        action: { kind: 'chop', item: 'hatchet', progress: 0.45, direction },
      });
      const blade = bladeFills(fills);
      return {
        scales,
        bladeCenter: blade.reduce((sum, fill) => sum + fill.x, 0) / blade.length,
        bladeCount: blade.length,
      };
    };
    const right = swing('right');
    const left = swing('left');
    // The left-facing frame is the same drawing, mirrored by one canvas scale.
    expect(right.scales).toHaveLength(0);
    expect(left.scales).toEqual([{ x: -1, y: 1 }]);
    expect(right.bladeCount).toBeGreaterThan(5);
    expect(right.bladeCount).toBe(left.bladeCount);
    expect(right.bladeCenter).toBeCloseTo(left.bladeCenter, 5);
    // The blade is painted around the grip in local space, so mirroring cannot
    // rotate it behind the character's back.
    expect(Math.abs(right.bladeCenter)).toBeLessThan(4);
  });
});
