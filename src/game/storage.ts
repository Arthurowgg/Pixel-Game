import { EXPLORE_CELLS, initialExploration } from './exploration';
import { DIRECTIONS } from './movement';
import {
  DEFAULT_SETTINGS,
  ITEMS,
  LEGACY_SAVE_KEY,
  QUICK_ITEMS,
  RESOURCE_HP,
  TORCH_DURATION,
  RECORDS_KEY,
  SAVE_KEY,
  SETTINGS_KEY,
} from './data';
import type { Direction, GameState, RunRecord, Settings, ResourceKind, Point } from './types';

function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
const object = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const finite = (v: unknown, min = 0, max = 1e9): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
/** The forest is endless, so positions are only bounded by float sanity, not by the
 * authored home valley. The home props still live inside WORLD. */
const point = (v: unknown): boolean => object(v) && finite(v.x, -1e6, 1e6) && finite(v.y, -1e6, 1e6);
export function isGameState(value: unknown): value is GameState {
  if (
    !object(value) ||
    value.version !== 2 ||
    ![1, 2].includes(Number(value.forestVersion)) ||
    typeof value.forestVersion !== 'number' ||
    !Array.isArray(value.explored) ||
    value.explored.length > EXPLORE_CELLS ||
    !value.explored.every((cell) => Number.isInteger(cell) && finite(cell, 0, EXPLORE_CELLS - 1)) ||
    new Set(value.explored).size !== value.explored.length ||
    typeof value.name !== 'string' ||
    !['explorer', 'survivor', 'wild'].includes(String(value.difficulty))
  )
    return false;
  if (
    !finite(value.seed) ||
    !finite(value.time) ||
    !point(value.player) ||
    !object(value.needs) ||
    !object(value.inventory)
  )
    return false;
  if (
    !['health', 'hunger', 'thirst', 'warmth', 'stamina'].every((k) =>
      finite((value.needs as Record<string, unknown>)[k], 0, 100),
    )
  )
    return false;
  if (!Object.keys(ITEMS).every((k) => finite((value.inventory as Record<string, unknown>)[k], 0, 1e6)))
    return false;
  const inventory = value.inventory as Record<string, number>;
  const item = (v: unknown) => typeof v === 'string' && Object.hasOwn(ITEMS, v);
  if (typeof value.direction !== 'string' || !(DIRECTIONS as readonly string[]).includes(value.direction))
    return false;
  if (
    value.equipped !== null &&
    (!item(value.equipped) ||
      !(
        inventory[String(value.equipped)] > 0 ||
        (value.equipped === 'torch' && finite(value.torchUntil) && value.torchUntil > value.time)
      ))
  )
    return false;
  if (
    !Array.isArray(value.hotbar) ||
    value.hotbar.length !== 6 ||
    !value.hotbar.every((v) => v === null || item(v))
  )
    return false;
  const occupied = value.hotbar.filter((v) => v !== null);
  if (new Set(occupied).size !== occupied.length) return false;

  if (
    !Array.isArray(value.resources) ||
    value.resources.length > 2000 ||
    !value.resources.every(
      (r) =>
        object(r) &&
        point(r) &&
        finite(r.id) &&
        ['tree', 'stone', 'berries', 'fiber', 'mushroom'].includes(String(r.kind)) &&
        finite(r.hp, 0, RESOURCE_HP[String(r.kind) as ResourceKind]) &&
        finite(r.readyAt) &&
        finite(r.scale, 0.1, 3) &&
        finite(r.variant, 0, 1),
    )
  )
    return false;
  if (
    !Array.isArray(value.fires) ||
    !value.fires.every((f) => object(f) && point(f) && finite(f.id) && finite(f.fuel, 0, 100))
  )
    return false;
  if (!Array.isArray(value.shelters) || !value.shelters.every(point)) return false;
  if (
    !Array.isArray(value.workbenches) ||
    value.workbenches.length > 100 ||
    !value.workbenches.every(
      (bench) => object(bench) && point(bench) && Number.isInteger(bench.id) && finite(bench.id),
    ) ||
    new Set(value.workbenches.map((bench) => bench.id)).size !== value.workbenches.length
  )
    return false;
  if (
    !Array.isArray(value.wolves) ||
    !value.wolves.every(
      (w) =>
        object(w) &&
        point(w) &&
        finite(w.id) &&
        finite(w.hp, 0, w.maxHp === undefined ? 2 : Number(w.maxHp)) &&
        (w.maxHp === undefined || (Number.isInteger(w.maxHp) && finite(w.maxHp, 2, 6))) &&
        finite(w.cooldown, -1e9) &&
        finite(w.scared, -1e9),
    )
  )
    return false;
  if (
    !Array.isArray(value.crafted) ||
    !value.crafted.every((k) => typeof k === 'string' && k in ITEMS) ||
    !object(value.gathered) ||
    !Object.values(value.gathered).every((v) => finite(v))
  )
    return false;
  if (
    !Array.isArray(value.journal) ||
    !value.journal.every(
      (j) =>
        object(j) &&
        finite(j.time) &&
        typeof j.text === 'string' &&
        ['discovery', 'danger', 'craft', 'milestone'].includes(String(j.kind)),
    )
  )
    return false;
  if (
    !['playing', 'dead', 'won'].includes(String(value.status)) ||
    !['clear', 'rain', 'storm', 'cold', 'wolves'].includes(String(value.weather))
  )
    return false;
  return (
    finite(value.nights) &&
    finite(value.torchUntil) &&
    finite(value.lastAttack, -100) &&
    finite(value.lastInteract, -100) &&
    finite(value.kills) &&
    finite(value.distance) &&
    finite(value.savedAt, 0, 1e15) &&
    finite(value.facing, -1, 1) &&
    typeof value.victoryAcknowledged === 'boolean'
  );
}
// v0.6/v0.7 stored eight-way facings. Preserve those camps, but normalize their
// old diagonal pose to its existing front/back art; new saves are cardinal only.
const LEGACY_DIRECTIONS: Record<string, Direction> = {
  'up-right': 'up',
  'up-left': 'up',
  'down-right': 'down',
  'down-left': 'down',
};
export function migrateGame(value: unknown): GameState | null {
  if (isGameState(value)) return value;
  if (!object(value) || !object(value.inventory)) return null;
  // Existing v2 saves predate the forager items. Only absent new fields default;
  // explicit invalid values and missing original items must still be rejected.
  const inventory = {
    nuts: 0,
    tea: 0,
    workbench: 0,
    rope: 0,
    plank: 0,
    moss: 0,
    salve: 0,
    ...value.inventory,
  };
  // An absent old permanent station is not gifted back: new progression starts
  // with handcraft. Explicitly invalid station data is never replaced.
  const workbenches = Object.hasOwn(value, 'workbenches') ? value.workbenches : [];
  const oldForest = !Object.hasOwn(value, 'forestVersion');
  // Preserve old resource coordinates and damage proportion; never regenerate a
  // saved world or grant its entire map. The revision makes this upgrade one-time.
  const forestVersion = oldForest ? 1 : value.forestVersion;
  let resources = value.resources;
  if (oldForest && Array.isArray(resources)) {
    const oldHP: Record<string, number> = { tree: 3, stone: 2, berries: 1, fiber: 1, mushroom: 1 };
    if (
      !resources.every(
        (r) => object(r) && Object.hasOwn(oldHP, String(r.kind)) && finite(r.hp, 0, oldHP[String(r.kind)]),
      )
    )
      return null;
    resources = resources.map((r: Record<string, unknown>) => ({
      ...r,
      hp: Number(r.hp) * (r.kind === 'tree' || r.kind === 'stone' ? 2 : 1),
    }));
  }
  const explored = Object.hasOwn(value, 'explored')
    ? value.explored
    : point(value.player)
      ? initialExploration(value.player as unknown as Point)
      : [];
  const torchUntil =
    oldForest && finite(value.torchUntil) && finite(value.time)
      ? Math.min(value.torchUntil, value.time + TORCH_DURATION)
      : value.torchUntil;
  const forest = { forestVersion, resources, explored, torchUntil };
  if (value.version === 2) {
    const direction =
      typeof value.direction === 'string' && Object.hasOwn(LEGACY_DIRECTIONS, value.direction)
        ? LEGACY_DIRECTIONS[value.direction]
        : value.direction;
    const upgraded = { ...value, ...forest, inventory, direction, workbenches };
    return isGameState(upgraded) ? upgraded : null;
  }
  if (value.version !== 1) return null;
  const upgraded: unknown = {
    ...value,
    version: 2,
    ...forest,
    workbenches,
    inventory: { ...inventory, pickaxe: 1 },
    direction: value.facing === -1 ? 'left' : 'down',
    equipped: Number(value.inventory.hatchet) > 0 ? 'hatchet' : null,
    hotbar: [...QUICK_ITEMS],
  };
  return isGameState(upgraded) ? upgraded : null;
}
export function loadGame(): GameState | null {
  const value = migrateGame(read(SAVE_KEY)) || migrateGame(read(LEGACY_SAVE_KEY));
  return value?.status === 'playing' ? value : null;
}
export function saveGame(state: GameState): boolean {
  try {
    if (state.status !== 'playing' || !isGameState(state)) return false;
    state.savedAt = Date.now();
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    localStorage.removeItem(LEGACY_SAVE_KEY);
    return true;
  } catch {
    return false;
  }
}
export function clearGame() {
  try {
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem(LEGACY_SAVE_KEY);
  } catch {
    /* storage is optional */
  }
}
export function loadSettings(): Settings {
  const value = read(SETTINGS_KEY);
  const prefersReducedMotion =
    typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (!object(value)) return { ...DEFAULT_SETTINGS, reducedMotion: prefersReducedMotion };
  return {
    sound: typeof value.sound === 'boolean' ? value.sound : true,
    masterVolume: finite(value.masterVolume, 0, 1) ? value.masterVolume : DEFAULT_SETTINGS.masterVolume,
    effects: finite(value.effects, 0, 1) ? value.effects : DEFAULT_SETTINGS.effects,
    ambience: finite(value.ambience, 0, 1) ? value.ambience : DEFAULT_SETTINGS.ambience,
    reducedMotion: typeof value.reducedMotion === 'boolean' ? value.reducedMotion : prefersReducedMotion,
    atmosphere: typeof value.atmosphere === 'boolean' ? value.atmosphere : true,
    showHints: typeof value.showHints === 'boolean' ? value.showHints : true,
    compactHud: typeof value.compactHud === 'boolean' ? value.compactHud : DEFAULT_SETTINGS.compactHud,
    pixelScale: value.pixelScale === 3 ? 3 : 2,
    damageFlash: typeof value.damageFlash === 'boolean' ? value.damageFlash : DEFAULT_SETTINGS.damageFlash,
    floatingText:
      typeof value.floatingText === 'boolean' ? value.floatingText : DEFAULT_SETTINGS.floatingText,
    vignette: typeof value.vignette === 'boolean' ? value.vignette : DEFAULT_SETTINGS.vignette,
  };
}
export function saveSettings(settings: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* local-only preference */
  }
}
export function loadRecords(): RunRecord[] {
  const value = read(RECORDS_KEY);
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (r) =>
        object(r) &&
        typeof r.name === 'string' &&
        finite(r.nights) &&
        finite(r.time) &&
        finite(r.crafted) &&
        finite(r.gathered) &&
        finite(r.date, 0, 1e15) &&
        ['dead', 'won'].includes(String(r.outcome)) &&
        ['explorer', 'survivor', 'wild'].includes(String(r.difficulty)),
    )
    .slice(0, 50) as unknown as RunRecord[];
}
export function recordRun(state: GameState) {
  const record: RunRecord = {
    name: state.name,
    nights: state.nights,
    time: state.time,
    crafted: state.crafted.length,
    gathered: Object.values(state.gathered).reduce((a, b) => a + b, 0),
    outcome: state.status === 'won' ? 'won' : 'dead',
    date: Date.now(),
    difficulty: state.difficulty,
  };
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify([record, ...loadRecords()].slice(0, 50)));
  } catch {
    /* a full storage should never end a run */
  }
}
