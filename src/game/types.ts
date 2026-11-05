export type ItemId =
  | 'hatchet'
  | 'pickaxe'
  | 'wood'
  | 'stone'
  | 'fiber'
  | 'berries'
  | 'water'
  | 'mushroom'
  | 'bandage'
  | 'torch'
  | 'meal'
  | 'campfire'
  | 'shelter'
  | 'nuts'
  | 'tea'
  | 'workbench';
export type Direction = 'down' | 'right' | 'up' | 'left';
export type ActionKind =
  'chop' | 'mine' | 'forage' | 'eat' | 'drink' | 'bandage' | 'build' | 'light' | 'feed' | 'refill' | 'attack';
export interface PlayerAction {
  kind: ActionKind;
  item: ItemId | null;
  direction: Direction;
  startedAt: number;
  duration: number;
  impactAt: number;
  impacted: boolean;
  resourceId?: number;
}
export interface ResourceAnimation {
  kind: 'hit' | 'harvest' | 'break' | 'fell' | 'regrow';
  startedAt: number;
}
export interface WorldEffect extends Point {
  clip: string;
  startedAt: number;
  flip?: boolean;
}
export type Difficulty = 'explorer' | 'survivor' | 'wild';
export type Weather = 'clear' | 'rain' | 'storm' | 'cold' | 'wolves';
export type ResourceKind = 'tree' | 'stone' | 'berries' | 'fiber' | 'mushroom';
export type GameStatus = 'playing' | 'dead' | 'won';
export interface Point {
  x: number;
  y: number;
}
export interface Resource extends Point {
  id: number;
  kind: ResourceKind;
  hp: number;
  readyAt: number;
  scale: number;
  variant: number;
}
export interface Fire extends Point {
  id: number;
  fuel: number;
}
export interface Workbench extends Point {
  id: number;
}
export interface FallingLeaf extends Point {
  startedAt: number;
  duration: number;
  drift: number;
  phase: number;
}
export interface Wolf extends Point {
  id: number;
  hp: number;
  maxHp?: number;
  cooldown: number;
  scared: number;
}
export interface Needs {
  health: number;
  hunger: number;
  thirst: number;
  warmth: number;
  stamina: number;
}
export interface JournalEntry {
  time: number;
  text: string;
  kind: 'discovery' | 'danger' | 'craft' | 'milestone';
}
export interface GameState {
  version: 2;
  forestVersion: 1 | 2;
  explored: number[];
  seed: number;
  name: string;
  difficulty: Difficulty;
  time: number;
  player: Point;
  facing: number;
  direction: Direction;
  equipped: ItemId | null;
  hotbar: (ItemId | null)[];
  needs: Needs;
  inventory: Record<ItemId, number>;
  resources: Resource[];
  fires: Fire[];
  shelters: Point[];
  workbenches: Workbench[];
  wolves: Wolf[];
  gathered: Record<string, number>;
  crafted: ItemId[];
  journal: JournalEntry[];
  nights: number;
  weather: Weather;
  status: GameStatus;
  victoryAcknowledged: boolean;
  torchUntil: number;
  lastAttack: number;
  lastInteract: number;
  kills: number;
  distance: number;
  savedAt: number;
}
export interface GameToast {
  id: number;
  text: string;
  type: 'success' | 'warning' | 'info';
  time: number;
}
export interface Particle extends Point {
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}
export interface FloatText extends Point {
  text: string;
  life: number;
  color: string;
}
export interface NearTarget {
  kind: ResourceKind | 'fire' | 'water' | 'shelter' | 'workbench';
  id: number;
  label: string;
  detail: string;
  distance: number;
}
export interface CampView {
  id: number;
  fuel: number;
  secondsLeft: number;
  canFeed: boolean;
  feeding: boolean;
  progress: number;
  seated: boolean;
}
export interface GameView {
  time: number;
  day: number;
  hour: number;
  needs: Needs;
  inventory: Record<ItemId, number>;
  weather: Weather;
  nights: number;
  status: GameStatus;
  player: Point;
  nearest: NearTarget | null;
  gathered: Record<string, number>;
  crafted: ItemId[];
  toasts: GameToast[];
  fireNearby: boolean;
  workbenchNearby: boolean;
  workbenchCount: number;
  fireFuel: number;
  camp: CampView | null;
  wolvesNear: number;
  wolfWindup: boolean;
  wolfPounce: boolean;
  shelterNearby: boolean;
  torchActive: boolean;
  torchSeconds: number;
  exploredPercent: number;
  journal: JournalEntry[];
  name: string;
  difficulty: Difficulty;
  savedAt: number;
  equipped: ItemId | null;
  hotbar: (ItemId | null)[];
  action: PlayerAction | null;
  torchLit: boolean;
  kills: number;
  distance: number;
}
export interface Settings {
  sound: boolean;
  masterVolume: number;
  effects: number;
  ambience: number;
  reducedMotion: boolean;
  atmosphere: boolean;
  showHints: boolean;
  compactHud: boolean;
  pixelScale: 2 | 3;
  damageFlash: boolean;
  floatingText: boolean;
  vignette: boolean;
}
export interface RunRecord {
  name: string;
  nights: number;
  time: number;
  crafted: number;
  gathered: number;
  outcome: 'dead' | 'won';
  date: number;
  difficulty: Difficulty;
}
export interface Recipe {
  id: ItemId;
  name: string;
  description: string;
  cost: Partial<Record<ItemId, number>>;
  category: 'camp' | 'survival';
  needsFire?: boolean;
  needsWorkbench?: boolean;
}
