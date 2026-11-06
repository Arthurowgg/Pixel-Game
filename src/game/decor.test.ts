import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DECOR_KINDS, forestDecor } from './decor';
import generatedAssets from './generated-assets.json';
import { CAMP, WORLD, distance } from './data';
import { FOREST_DECOR, inPond } from './forest';

const SEEDS = [1, 42, 777, 123456];

describe('forest undergrowth', () => {
  it('is deterministic per seed and varies between seeds', () => {
    expect(forestDecor(42)).toEqual(forestDecor(42));
    expect(JSON.stringify(forestDecor(43))).not.toBe(JSON.stringify(forestDecor(42)));
  });

  it('dresses the whole forest without crowding the camp, the pond or the rims', () => {
    for (const seed of SEEDS) {
      const props = forestDecor(seed);
      expect(props.length).toBeGreaterThan(170);
      expect(props.length).toBeLessThan(340);
      for (const prop of props) {
        expect(DECOR_KINDS).toContain(prop.kind);
        expect(Number.isInteger(prop.x) && Number.isInteger(prop.y)).toBe(true);
        expect(prop.x).toBeGreaterThanOrEqual(26);
        expect(prop.x).toBeLessThanOrEqual(WORLD.width - 26);
        expect(prop.y).toBeGreaterThanOrEqual(40);
        expect(prop.y).toBeLessThanOrEqual(WORLD.height - 18);
        expect(inPond(prop)).toBe(false);
        expect(distance(prop, CAMP)).toBeGreaterThanOrEqual(92);
        expect(prop.scale).toBeGreaterThanOrEqual(0.86);
        expect(prop.scale).toBeLessThanOrEqual(1.08);
        expect(prop.phase).toBeGreaterThanOrEqual(0);
        expect(prop.phase).toBeLessThan(Math.PI * 2);
      }
      const kinds = new Set(props.map((prop) => prop.kind));
      expect(kinds).toEqual(new Set(DECOR_KINDS));
      // Reeds belong to the shoreline, so they stay the rarest kind.
      expect(props.filter((prop) => prop.kind === 'reeds').length).toBeGreaterThanOrEqual(12);
    }
  });

  it('composes a few places rather than sprinkling noise everywhere', () => {
    const props = forestDecor(42);
    const near = (point: { x: number; y: number }, radius: number, kind?: string) =>
      props.filter((prop) => distance(prop, point) <= radius && (!kind || prop.kind === kind));
    // A fairy ring on a mossy bank.
    expect(near({ x: 744, y: 470 }, 34, 'mushrooms').length).toBeGreaterThanOrEqual(7);
    // Growth hugging the damp end of the fallen logs, and stone by the waystones.
    for (const decoration of FOREST_DECOR.filter((entry) => entry.kind === 'fallenLog'))
      expect(near(decoration, 32, 'mushrooms').length).toBeGreaterThanOrEqual(2);
  });

  it('ships five tiny generated props anchored to their ground point', () => {
    const expected: Record<string, [number, number]> = {
      mushrooms: [18, 14],
      fern: [22, 18],
      wildflowers: [18, 14],
      clover: [20, 13],
      mossBoulder: [20, 15],
      reeds: [16, 22],
    };
    for (const [name, size] of Object.entries(expected)) {
      const asset = generatedAssets.objects[name as keyof typeof generatedAssets.objects];
      expect([asset.width, asset.height]).toEqual(size);
      expect(asset.source).toBe('generated');
      expect(asset.sourceAsset).toBe(`art/generated/decor-pass/${name}.png`);
      // Bottom-centre anchor: the prop stands on the point it is drawn at.
      expect(asset.anchor[1]).toBe(asset.height - 1);
      expect(asset.anchor[0]).toBe(Math.floor(asset.width / 2));
      const png = readFileSync(`public/${asset.file}`);
      expect(png.readUInt32BE(16)).toBe(asset.width);
      expect(png.readUInt32BE(20)).toBe(asset.height);
      expect(png.equals(readFileSync(`public/${asset.sourceAsset}`))).toBe(true);
    }
  });
});
