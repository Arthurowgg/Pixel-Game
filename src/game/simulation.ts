import { WolfPack } from './wolves';
import { facingDirection, movementVector, moveWithCollision } from './movement';
import { atWorkbench, blocksWorkbench, maxCraftable, validCraftQuantity } from './crafting';
import {
  CAMP,
  DAY_LENGTH,
  ITEMS,
  POND,
  QUICK_ITEMS,
  RECIPES,
  SPRING,
  WORLD,
  WORKBENCH,
  clamp,
  distance,
  random,
} from './data';
import type {
  ActionKind,
  PlayerAction,
  ResourceAnimation,
  WorldEffect,
  Difficulty,
  FloatText,
  GameState,
  GameToast,
  GameView,
  ItemId,
  NearTarget,
  Particle,
  Point,
  Fire,
  Resource,
  ResourceKind,
  Weather,
} from './types';

const RESOURCE_HP: Record<ResourceKind, number> = { tree: 3, stone: 2, berries: 1, fiber: 1, mushroom: 1 };
const RESOURCE_LABEL: Record<ResourceKind, string> = {
  tree: 'Chop pine',
  stone: 'Mine river stone',
  berries: 'Pick wild berries',
  fiber: 'Gather wild fiber',
  mushroom: 'Pick mushrooms',
};
const RESOURCE_REWARD: Record<ResourceKind, [ItemId, number]> = {
  tree: ['wood', 4],
  stone: ['stone', 3],
  berries: ['berries', 3],
  fiber: ['fiber', 3],
  mushroom: ['mushroom', 2],
};
export function inWater(p: Point, padding = 0) {
  return ((p.x - POND.x) / (POND.rx + padding)) ** 2 + ((p.y - POND.y) / (POND.ry + padding)) ** 2 < 1;
}
export function createWorld(seed: number): Resource[] {
  const rng = random(seed);
  const result: Resource[] = [];
  const add = (kind: ResourceKind, x: number, y: number) =>
    result.push({
      id: result.length,
      kind,
      x,
      y,
      hp: RESOURCE_HP[kind],
      readyAt: 0,
      scale: 0.85 + rng() * 0.4,
      variant: rng(),
    });
  // A generous first clearing makes the survival loop discoverable immediately.
  add('tree', 943, 787);
  add('tree', 825, 752);
  add('tree', 970, 697);
  add('stone', 860, 821);
  add('berries', 845, 786);
  add('fiber', 916, 839);
  add('fiber', 966, 852);
  add('mushroom', 919, 678);
  const counts: [ResourceKind, number][] = [
    ['tree', 385],
    ['stone', 65],
    ['berries', 55],
    ['fiber', 65],
    ['mushroom', 28],
  ];
  for (const [kind, count] of counts) {
    for (let i = 0; i < count; i++) {
      const x = 35 + rng() * (WORLD.width - 70),
        y = 50 + rng() * (WORLD.height - 90);
      const onPath = Math.abs(y - (760 + Math.sin(x / 175) * 30)) < 28;
      if (distance({ x, y }, CAMP) < 125 || inWater({ x, y }, 22) || (kind === 'tree' && onPath)) continue;
      if (result.some((r) => distance(r, { x, y }) < (kind === 'tree' ? 27 : 14))) continue;
      add(kind, x, y);
    }
  }
  return result;
}
export function createGame(
  name: string,
  difficulty: Difficulty,
  seed = Math.floor(Math.random() * 1e8),
): GameState {
  return {
    version: 2,
    seed,
    name: name.trim().slice(0, 20) || 'Wanderer',
    difficulty,
    time: 0,
    player: { x: 900, y: 790 },
    facing: 1,
    direction: 'down',
    equipped: 'hatchet',
    hotbar: [...QUICK_ITEMS],
    needs: { health: 100, hunger: 90, thirst: 90, warmth: 90, stamina: 100 },
    inventory: {
      hatchet: 1,
      pickaxe: 1,
      wood: 0,
      stone: 0,
      fiber: 0,
      berries: 3,
      water: 3,
      mushroom: 0,
      bandage: 1,
      torch: 0,
      meal: 0,
      campfire: 0,
      shelter: 0,
      nuts: 0,
      tea: 0,
    },
    resources: createWorld(seed),
    fires: [{ ...CAMP, id: 0, fuel: 80 }],
    shelters: [],
    wolves: [],
    gathered: {},
    crafted: [],
    journal: [{ time: 0, text: 'A clearing. A fading campfire. A place to begin.', kind: 'discovery' }],
    nights: 0,
    weather: 'clear',
    status: 'playing',
    victoryAcknowledged: false,
    torchUntil: 0,
    lastAttack: -10,
    lastInteract: -10,
    kills: 0,
    distance: 0,
    savedAt: Date.now(),
  };
}
export function weatherAt(time: number): Weather {
  const day = Math.floor(time / DAY_LENGTH),
    phase = time % DAY_LENGTH;
  if (phase >= 48 && phase < 83) return day % 2 === 0 ? 'rain' : 'storm';
  if (phase >= 92 && phase < 119) return 'cold';
  if (phase >= 120 && phase < 154) return 'wolves';
  return 'clear';
}
export class Simulation {
  state: GameState;
  keys = new Set<string>();
  particles: Particle[] = [];
  floating: FloatText[] = [];
  toasts: GameToast[] = [];
  paused = false;
  moving = false;
  gaitDistance = 0;
  hitFlash = 0;
  swing = 0;
  sprinting = false;
  action: PlayerAction | null = null;
  resourceAnimations = new Map<number, ResourceAnimation>();
  effects: WorldEffect[] = [];
  private pendingImpact: (() => void) | null = null;
  wolfPack = new WolfPack();
  aim: Point | null = null;
  campFocus: number | null = null;
  feedingFire: Fire | null = null;
  private campStill = 0;
  private dismissedFire: number | null = null;
  private destination: Point | null = null;
  private targetAxis: 'x' | 'y' | null = null;
  get target(): Point | null {
    return this.destination;
  }
  set target(point: Point | null) {
    this.destination = point && Number.isFinite(point.x) && Number.isFinite(point.y) ? { ...point } : null;
    this.targetAxis = null;
  }
  onSound?: (
    sound: 'gather' | 'craft' | 'hit' | 'eat' | 'step' | 'notice' | 'chop' | 'mine' | 'swish',
  ) => void;
  onOpenCrafting?: () => void;
  private toastId = 0;
  private lastStep = 0;
  private rng: () => number;
  constructor(state: GameState) {
    this.state = state;
    state.wolves = state.wolves.filter((wolf) => wolf.hp > 0);
    // A pre-table save can have its feet inside the new furniture. Move only that
    // overlap to the nearest free edge rather than trapping or resetting the survivor.
    if (blocksWorkbench(state.player)) {
      const exits = [
        { x: state.player.x, y: WORKBENCH.y + 16 },
        { x: state.player.x, y: WORKBENCH.y - 16 },
        { x: WORKBENCH.x - 32, y: state.player.y },
        { x: WORKBENCH.x + 32, y: state.player.y },
      ].sort((a, b) => distance(a, state.player) - distance(b, state.player));
      const free = exits.find((point) => !this.collision(point));
      if (free) state.player = free;
    }
    this.rng = random(state.seed + Math.floor(state.time));
    this.notify(
      state.time < 1
        ? 'A clearing, a campfire, a fresh start. Make yourself at home.'
        : 'Welcome back to your little corner of the forest.',
      'info',
    );
  }
  get hour() {
    return (8 + ((this.state.time % DAY_LENGTH) / DAY_LENGTH) * 24) % 24;
  }
  get night() {
    return this.hour >= 20 || this.hour < 6;
  }
  get fireNearby() {
    return this.state.fires.some((f) => f.fuel > 0 && distance(f, this.state.player) < 82);
  }
  get workbenchNearby() {
    return atWorkbench(this.state.player);
  }
  get shelterNearby() {
    return this.state.shelters.some((s) => distance(s, this.state.player) < 56);
  }
  get torchLit() {
    return this.state.torchUntil > this.state.time;
  }
  get torchActive() {
    return this.torchLit && this.state.equipped === 'torch';
  }
  notify(text: string, type: GameToast['type'] = 'success') {
    this.toasts = [...this.toasts.slice(-2), { id: ++this.toastId, text, type, time: this.state.time }];
  }
  log(text: string, kind: 'discovery' | 'danger' | 'craft' | 'milestone') {
    this.state.journal.unshift({ time: this.state.time, text, kind });
    this.state.journal = this.state.journal.slice(0, 60);
  }
  nearest(): NearTarget | null {
    const p = this.state.player;
    const hearth = this.state.fires
      .filter((fire) => distance(fire, p) < 40)
      .sort((a, b) => distance(a, p) - distance(b, p))[0];
    const tableCloser = hearth && distance(WORKBENCH, p) < Math.min(48, distance(hearth, p));
    if (hearth && !tableCloser)
      return {
        kind: 'fire',
        id: hearth.id,
        distance: distance(hearth, p),
        label: hearth.fuel > 0 ? 'Feed the campfire' : 'Relight campfire',
        detail: `1 pine wood · ${Math.ceil(hearth.fuel)}% fuel`,
      };
    const candidates: NearTarget[] = this.state.resources
      .filter((r) => r.hp > 0 && distance(r, p) < 47)
      .map((r) => ({
        kind: r.kind,
        id: r.id,
        distance: distance(r, p),
        label: RESOURCE_LABEL[r.kind],
        detail:
          r.kind === 'tree'
            ? `${this.state.equipped === 'hatchet' ? 'Axe' : 'Equip axe'} · ${r.hp} chops · +4 wood, +1 pine nuts`
            : r.kind === 'stone'
              ? `${this.state.equipped === 'pickaxe' ? 'Pickaxe' : 'Equip pickaxe'} · ${r.hp} strikes · +3 stone`
              : `+${RESOURCE_REWARD[r.kind][1]} ${RESOURCE_REWARD[r.kind][0]}`,
      }));
    for (const f of this.state.fires)
      if (distance(f, p) < 43)
        candidates.push({
          kind: 'fire',
          id: f.id,
          distance: distance(f, p),
          label: f.fuel > 0 ? 'Feed the campfire' : 'Relight campfire',
          detail: `1 wood · ${Math.round(f.fuel)}% fuel`,
        });
    if (distance(p, SPRING) < 51)
      candidates.push({
        kind: 'water',
        id: 0,
        distance: distance(p, SPRING),
        label: 'Fill your water bottles',
        detail: 'Fresh spring water · refill to 5',
      });
    for (let i = 0; i < this.state.shelters.length; i++)
      if (distance(p, this.state.shelters[i]) < 35)
        candidates.push({
          kind: 'shelter',
          id: i,
          distance: distance(p, this.state.shelters[i]),
          label: 'Rest under shelter',
          detail: 'Recover stamina · stay warm',
        });
    if (distance(p, WORKBENCH) < 48)
      candidates.push({
        kind: 'workbench',
        id: 0,
        distance: distance(p, WORKBENCH),
        label: 'Use crafting table',
        detail: 'Tools, shelter & supplies · open workshop',
      });
    candidates.sort((a, b) => a.distance - b.distance);
    return candidates[0] || null;
  }
  burst(p: Point, color: string, count = 8) {
    for (let i = 0; i < count; i++)
      this.particles.push({
        ...p,
        vx: (this.rng() - 0.5) * 45,
        vy: -this.rng() * 35 - 8,
        color,
        life: 0.45 + this.rng() * 0.45,
        size: 1 + Math.floor(this.rng() * 2),
      });
  }
  available(item: ItemId) {
    return this.state.inventory[item] > 0 || (item === 'torch' && this.torchLit);
  }
  equip(item: ItemId | null, announce = true) {
    if (this.state.status !== 'playing') return false;
    if (item && !this.available(item)) {
      if (announce) this.notify(`You don't have ${ITEMS[item].name.toLowerCase()} to hold yet.`, 'info');
      return false;
    }
    // Switching before the impact frame cancels an action without consuming it.
    // After impact, effects stay committed; switching never duplicates rewards.
    if (item !== this.state.equipped) {
      this.action = null;
      this.pendingImpact = null;
      this.feedingFire = null;
    }
    this.state.equipped = item;
    return true;
  }
  selectSlot(index: number) {
    if (!Number.isInteger(index) || index < 0 || index >= 6) return false;
    return this.equip(this.state.hotbar[index]);
  }
  assignSlot(index: number, item: ItemId | null) {
    if (!Number.isInteger(index) || index < 0 || index >= 6 || (item && !Object.hasOwn(ITEMS, item)))
      return false;
    const previous = item === null ? -1 : this.state.hotbar.indexOf(item);
    if (previous >= 0 && previous !== index) this.state.hotbar[previous] = this.state.hotbar[index];
    this.state.hotbar[index] = item;
    return true;
  }
  private face(point: Point) {
    const dx = point.x - this.state.player.x,
      dy = point.y - this.state.player.y;
    this.state.direction = facingDirection(dx, dy, this.state.direction);
    if (dx) this.state.facing = dx < 0 ? -1 : 1;
  }
  private beginAction(
    kind: ActionKind,
    item: ItemId | null,
    effect: () => void,
    duration = 2 / 3,
    impact = 1 / 3,
  ) {
    if (this.action || this.state.status !== 'playing') return false;
    this.action = {
      kind,
      item,
      direction: this.state.direction,
      startedAt: this.state.time,
      duration,
      impactAt: impact,
      impacted: false,
    };
    this.pendingImpact = effect;
    this.target = null;
    if (kind === 'chop' || kind === 'mine' || kind === 'attack') this.onSound?.('swish');
    return true;
  }
  private effect(clip: string, point: Point, flip = false) {
    this.effects.push({ ...point, clip, startedAt: this.state.time, flip });
  }
  private processAction() {
    if (!this.action) return;
    const action = this.action;
    const elapsed = this.state.time - action.startedAt;
    if (!action.impacted && elapsed >= action.impactAt) {
      action.impacted = true;
      const effect = this.pendingImpact;
      this.pendingImpact = null;
      effect?.();
    }
    if (elapsed >= action.duration) {
      this.action = null;
      this.pendingImpact = null;
      this.feedingFire = null;
    }
    this.effects = this.effects.filter((effect) => this.state.time - effect.startedAt < 1.1);
  }
  interact() {
    const s = this.state;
    if (s.status !== 'playing' || this.paused || this.action || s.time - s.lastInteract < 0.68) return false;
    const near = this.nearest();
    if (!near) {
      this.notify('Get a little closer to a tree, plant, stone, or campfire.', 'info');
      s.lastInteract = s.time;
      return false;
    }
    s.lastInteract = s.time;
    if (near.kind === 'workbench') {
      this.face(WORKBENCH);
      this.target = null;
      this.onOpenCrafting?.();
      return true;
    }
    if (near.kind === 'fire') {
      const fire = s.fires.find((candidate) => candidate.id === near.id)!;
      if (!this.campUnsafe) {
        this.campFocus = fire.id;
        this.dismissedFire = null;
        this.face(fire);
        this.target = null;
      }
      return this.feedFire(near.id);
    }
    if (near.kind === 'water') {
      this.face(SPRING);
      return this.beginAction('refill', 'water', () => {
        if (distance(s.player, SPRING) > 60) return;
        s.inventory.water = Math.max(s.inventory.water, 5);
        this.effect('water-drops', s.player);
        this.notify('Fresh spring water. Bottles refilled to 5.');
        this.onSound?.('eat');
      });
    }
    if (near.kind === 'shelter') {
      return this.beginAction('bandage', null, () => {
        s.needs.stamina = 100;
        s.needs.warmth = clamp(s.needs.warmth + 8);
        this.effect('recovery', s.player);
        this.notify('A moment to catch your breath. Stamina restored.');
      });
    }
    return this.gatherResource(s.resources.find((resource) => resource.id === near.id)!);
  }
  private gatherResource(resource: Resource) {
    const s = this.state;
    const tool = resource.kind === 'tree' ? 'hatchet' : resource.kind === 'stone' ? 'pickaxe' : null;
    if (resource.hp <= 0 || distance(resource, s.player) > 48) return false;
    if (tool && s.equipped !== tool) {
      this.notify(
        s.inventory[tool]
          ? `Equip your ${ITEMS[tool].name.toLowerCase()} first.`
          : `You need a ${ITEMS[tool].name.toLowerCase()}. Craft one at the camp table.`,
        'warning',
      );
      return false;
    }
    this.face(resource);
    return this.beginAction(tool === 'hatchet' ? 'chop' : tool === 'pickaxe' ? 'mine' : 'forage', tool, () =>
      this.harvest(resource),
    );
  }
  leaveCamp() {
    this.dismissedFire = this.campFocus;
    this.campFocus = null;
    this.campStill = 0;
    if (this.action?.kind === 'feed') {
      this.action = null;
      this.pendingImpact = null;
      this.feedingFire = null;
    }
  }
  feedFire(id: number) {
    const s = this.state,
      fire = s.fires.find((candidate) => candidate.id === id);
    if (this.paused || s.status !== 'playing' || this.action || !fire || distance(fire, s.player) > 43)
      return false;
    if (!s.inventory.wood) {
      this.notify('You need pine wood to keep the fire going.', 'warning');
      return false;
    }
    if (fire.fuel > 80) {
      this.notify('The fire has plenty of wood for now.', 'info');
      return false;
    }
    this.face(fire);
    this.feedingFire = fire;
    this.dismissedFire = null;
    if (!this.campUnsafe) this.campFocus = fire.id;
    return this.beginAction(
      'feed',
      'wood',
      () => {
        if (distance(s.player, fire) > 45 || !s.inventory.wood || !s.fires.includes(fire)) return;
        s.inventory.wood--;
        fire.fuel = clamp(fire.fuel + 35);
        this.burst(fire, '#e9b66f', 12);
        this.effect('wood-chips', fire);
        this.onSound?.('chop');
        this.clearUnavailableEquipment();
      },
      1.05,
      0.58,
    );
  }
  private get campUnsafe() {
    const s = this.state;
    return (
      s.wolves.some((wolf) => wolf.hp > 0 && distance(wolf, s.player) < 105) ||
      s.needs.health < 30 ||
      s.needs.hunger < 12 ||
      s.needs.thirst < 12
    );
  }
  private updateCamp(dt: number) {
    const s = this.state;
    const near = s.fires
      .filter((fire) => distance(fire, s.player) < 40)
      .sort((a, b) => distance(a, s.player) - distance(b, s.player))[0];
    if (!near || near.id !== this.dismissedFire) this.dismissedFire = null;
    const direction = movementVector(this.keys);
    const unsafe = this.campUnsafe;
    const tableCloser = near && distance(WORKBENCH, s.player) < Math.min(48, distance(near, s.player));
    if (unsafe && this.action?.kind === 'feed' && !this.action.impacted) this.leaveCamp();
    if (
      !near ||
      tableCloser ||
      direction.x ||
      direction.y ||
      this.moving ||
      this.target ||
      unsafe ||
      (this.action && this.action.kind !== 'feed')
    ) {
      this.campFocus = null;
      this.campStill = 0;
      return;
    }
    if (this.dismissedFire === near.id) return;
    this.campStill += dt;
    if (this.campStill >= 0.65 && this.campFocus !== near.id) {
      this.campFocus = near.id;
      this.face(near);
    }
  }
  private harvest(resource: Resource) {
    const s = this.state;
    if (resource.hp <= 0 || distance(s.player, resource) > 53) return;
    resource.hp--;
    this.swing = 0.25;
    this.resourceAnimations.set(resource.id, { kind: 'hit', startedAt: s.time });
    const effect =
      resource.kind === 'tree' ? 'wood-chips' : resource.kind === 'stone' ? 'stone-dust' : 'leaf-burst';
    this.effect(effect, resource);
    this.onSound?.(resource.kind === 'tree' ? 'chop' : resource.kind === 'stone' ? 'mine' : 'gather');
    if (resource.hp <= 0) {
      this.resourceAnimations.set(resource.id, {
        kind: resource.kind === 'tree' ? 'fell' : resource.kind === 'stone' ? 'break' : 'harvest',
        startedAt: s.time,
      });
      const [item, amount] = RESOURCE_REWARD[resource.kind];
      s.inventory[item] += amount;
      s.gathered[item] = (s.gathered[item] || 0) + amount;
      resource.readyAt = s.time + (resource.kind === 'tree' ? 240 : 140);
      this.floating.push({
        x: resource.x,
        y: resource.y - 22,
        text: `+${amount} ${ITEMS[item].name.toLowerCase()}`,
        color: '#e6d7ad',
        life: 1.8,
      });
      if (resource.kind === 'tree') {
        s.inventory.nuts++;
        s.gathered.nuts = (s.gathered.nuts || 0) + 1;
        this.floating.push({
          x: resource.x,
          y: resource.y - 7,
          text: '+1 pine nuts',
          color: '#d1bc83',
          life: 1.8,
        });
        if (s.gathered.nuts === 1)
          this.log('Found pine nuts in a fallen cone. A small snack for the trail.', 'discovery');
      }
      if (resource.kind === 'berries') {
        s.inventory.fiber++;
        s.gathered.fiber = (s.gathered.fiber || 0) + 1;
      }
      if (s.gathered[item] === amount)
        this.log(`Found ${ITEMS[item].name.toLowerCase()} in the forest.`, 'discovery');
    }
  }
  private clearUnavailableEquipment() {
    if (this.state.equipped && !this.available(this.state.equipped)) this.state.equipped = null;
  }
  maxCraftable(item: ItemId) {
    const recipe = RECIPES.find((candidate) => candidate.id === item);
    return recipe
      ? maxCraftable(recipe, {
          inventory: this.state.inventory,
          fireNearby: this.fireNearby,
          workbenchNearby: this.workbenchNearby,
        })
      : 0;
  }
  canCraft(item: ItemId, quantity = 1) {
    return (
      this.state.status === 'playing' && validCraftQuantity(quantity) && this.maxCraftable(item) >= quantity
    );
  }
  craft(item: ItemId, quantity = 1) {
    if (this.state.status !== 'playing' || !validCraftQuantity(quantity)) return false;
    const recipe = RECIPES.find((r) => r.id === item);
    if (!recipe || !this.canCraft(item, quantity)) {
      this.notify(
        recipe?.needsWorkbench && !this.workbenchNearby
          ? 'Return to the crafting table at your first camp to make this.'
          : recipe?.needsFire && !this.fireNearby
            ? 'Come closer to a burning campfire to cook.'
            : 'Gather a few more supplies first.',
        'warning',
      );
      return false;
    }
    // Validate the whole batch before spending anything. Never partially fulfill it.
    for (const [id, amount] of Object.entries(recipe.cost))
      this.state.inventory[id as ItemId] -= amount! * quantity;
    this.state.inventory[item] += quantity;
    this.clearUnavailableEquipment();
    if (!this.state.crafted.includes(item)) this.state.crafted.push(item);
    this.log(
      `Crafted ${quantity > 1 ? `${quantity} × ` : ''}${recipe.name.toLowerCase()}. One small step toward morning.`,
      'craft',
    );
    this.notify(
      `${recipe.name} crafted${quantity > 1 ? ` ×${quantity}` : ''}. ${item === 'shelter' || item === 'campfire' ? 'Use it from your backpack to place it.' : 'Find it in your backpack.'}`,
    );
    this.onSound?.('craft');
    return true;
  }
  private placementBlocked(p: Point) {
    const s = this.state;
    return (
      inWater(p, 16) ||
      blocksWorkbench(p, 22) ||
      s.resources.some((r) => r.hp > 0 && (r.kind === 'tree' || r.kind === 'stone') && distance(r, p) < 24) ||
      s.fires.some((f) => distance(f, p) < 35) ||
      s.shelters.some((sh) => distance(sh, p) < 48)
    );
  }
  useHeld(aim: Point | null = null) {
    if (this.paused || this.action || this.state.status !== 'playing') return false;
    if (this.campFocus !== null) return false; // The hearth's single action is its log button/E.
    const item = this.state.equipped;
    if (!item) return this.attack(aim);
    if (item === 'hatchet' || item === 'pickaxe') {
      const wolf = this.state.wolves.some(
        (candidate) =>
          candidate.hp > 0 &&
          distance(candidate, this.state.player) < 74 &&
          (!aim || distance(candidate, aim) < 38),
      );
      if (wolf) return this.attack(aim);
      const resource = this.state.resources
        .filter(
          (candidate) =>
            candidate.hp > 0 &&
            candidate.kind === (item === 'hatchet' ? 'tree' : 'stone') &&
            distance(candidate, this.state.player) < 48 &&
            (!aim ||
              (Math.abs(candidate.x - aim.x) < 25 &&
                aim.y > candidate.y - (candidate.kind === 'tree' ? 85 : 30) &&
                aim.y < candidate.y + 14)),
        )
        .sort((a, b) => distance(a, aim ?? this.state.player) - distance(b, aim ?? this.state.player))[0];
      return resource ? this.gatherResource(resource) : this.attack(aim);
    }
    if (item === 'wood' && this.nearest()?.kind === 'fire') return this.interact();
    return this.use(item);
  }
  use(item: ItemId) {
    const s = this.state;
    if (s.status !== 'playing' || this.action) return false;
    if (!this.available(item)) {
      this.notify(`No ${ITEMS[item].name.toLowerCase()} in your backpack yet.`, 'info');
      return false;
    }
    if (item === 'hatchet' || item === 'pickaxe') {
      this.equip(item, false);
      this.notify(`${ITEMS[item].name} equipped.`, 'info');
      return true;
    }
    if (!ITEMS[item].action) {
      this.notify(`${ITEMS[item].name} can be held or used in crafting. Open crafting with C.`, 'info');
      return false;
    }
    if (item === 'torch' && this.torchLit) {
      this.equip('torch', false);
      this.notify('Your torch is already burning. Keep it in hand to stay warm.', 'info');
      return true;
    }
    let placement: Point | null = null;
    if (item === 'campfire' || item === 'shelter') {
      placement = {
        x: clamp(s.player.x + (s.facing < 0 ? -35 : 35), 30, WORLD.width - 30),
        y: clamp(s.player.y + 18, 40, WORLD.height - 30),
      };
      if (this.placementBlocked(placement)) {
        this.notify('Find an open patch of ground to place this.', 'warning');
        return false;
      }
    }
    this.equip(item, false);
    const kind: ActionKind = placement
      ? 'build'
      : item === 'water' || item === 'tea'
        ? 'drink'
        : item === 'bandage'
          ? 'bandage'
          : item === 'torch'
            ? 'light'
            : 'eat';
    return this.beginAction(kind, item, () => {
      if (!s.inventory[item]) return;
      if (placement) {
        if (this.placementBlocked(placement) || distance(s.player, placement) > 65) {
          this.notify('That spot is no longer clear. Your kit is still in your backpack.', 'warning');
          return;
        }
        if (item === 'campfire') s.fires.push({ ...placement, id: s.fires.length, fuel: 100 });
        else s.shelters.push(placement);
        this.effect('build-dust', placement);
        this.log(
          `Built a ${item === 'shelter' ? 'forest shelter' : 'new campfire'}. This place feels a little more like home.`,
          'milestone',
        );
      }
      const n = s.needs;
      if (item === 'berries') {
        n.hunger = clamp(n.hunger + 22);
        n.thirst = clamp(n.thirst + 5);
      }
      if (item === 'water') {
        n.thirst = clamp(n.thirst + 35);
        this.effect('water-drops', s.player);
      }
      if (item === 'mushroom') n.hunger = clamp(n.hunger + 12);
      if (item === 'nuts') n.hunger = clamp(n.hunger + 14);
      if (item === 'tea') {
        n.thirst = clamp(n.thirst + 25);
        n.warmth = clamp(n.warmth + 24);
        this.effect('water-drops', s.player);
      }

      if (item === 'bandage') {
        n.health = clamp(n.health + 35);
        this.effect('recovery', s.player);
      }
      if (item === 'meal') {
        n.hunger = clamp(n.hunger + 55);
        n.thirst = clamp(n.thirst + 10);
        n.health = clamp(n.health + 8);
      }
      if (item === 'torch') s.torchUntil = s.time + 90;
      s.inventory[item]--;
      this.clearUnavailableEquipment();
      const messages: Partial<Record<ItemId, string>> = {
        berries: 'A handful of berries. +22 hunger.',
        water: 'A cool drink. +35 thirst.',
        mushroom: 'Earthy, but edible. +12 hunger.',
        nuts: 'A pocketful of pine nuts. +14 hunger.',
        tea: 'Warm from the inside. +25 thirst. +24 warmth.',
        bandage: 'Patched up. +35 health.',
        meal: 'A warm meal. +55 hunger. +8 health.',
        torch: 'A light in your hands. Your torch burns for 90 seconds.',
        campfire: 'Your campfire is ready. Keep it fed with wood.',
        shelter: 'Home is where you make it. Shelter built.',
      };
      this.notify(messages[item] || 'Ready.');
      this.onSound?.('eat');
    });
  }
  attack(aim: Point | null = null) {
    const s = this.state;
    if (this.paused || s.status !== 'playing' || this.action || s.time - s.lastAttack < 0.68) return false;
    s.lastAttack = s.time;
    this.campFocus = null;
    this.campStill = 0;
    const weapon = s.equipped;
    const reach = weapon === 'hatchet' ? 68 : weapon === 'pickaxe' ? 62 : 34;
    const candidates = s.wolves
      .filter((wolf) => wolf.hp > 0 && distance(wolf, s.player) < reach + 6)
      .sort((a, b) => distance(a, aim ?? s.player) - distance(b, aim ?? s.player));
    const focused = candidates.find((wolf) => !aim || distance(wolf, aim) < 38);
    const facing = focused ?? aim;
    if (facing) this.face(facing);
    const angle = facing
      ? Math.atan2(facing.y - s.player.y, facing.x - s.player.x)
      : { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[s.direction];
    return this.beginAction('attack', weapon, () => {
      this.swing = 0.28;
      this.effect('tool-swipe', s.player, s.facing < 0);
      const targets = s.wolves
        .filter((wolf) => {
          if (wolf.hp <= 0) return false;
          const gap = distance(wolf, s.player);
          if (gap > reach + (wolf === focused ? 6 : 0)) return false;
          const dot = Math.cos(Math.atan2(wolf.y - s.player.y, wolf.x - s.player.x) - angle);
          return dot >= (wolf === focused ? 0 : 0.34);
        })
        .sort(
          (a, b) =>
            Number(b === focused) - Number(a === focused) || distance(a, s.player) - distance(b, s.player),
        )
        .slice(0, weapon === 'hatchet' ? 2 : 1);
      for (const wolf of targets) {
        wolf.hp -= weapon === 'hatchet' || weapon === 'pickaxe' ? 1 : 0.5;
        this.wolfPack.hit(
          wolf,
          s.player,
          s.time,
          (point) =>
            this.collision(point) || s.fires.some((fire) => fire.fuel > 0 && distance(fire, point) < 35),
          s.wolves,
        );
        this.burst(wolf, '#c79a7b');
        this.floating.push({
          x: wolf.x,
          y: wolf.y - 28,
          text: weapon === 'hatchet' || weapon === 'pickaxe' ? '−1' : '−½',
          life: 0.7,
          color: '#e1ba86',
        });
        this.onSound?.('hit');
        if (wolf.hp <= 0) {
          s.kills++;
          this.notify('The wolf is down.');
        }
      }
      s.wolves = s.wolves.filter((wolf) => wolf.hp > 0);
    });
  }
  collision(p: Point) {
    if (
      p.x < 16 ||
      p.y < 30 ||
      p.x > WORLD.width - 16 ||
      p.y > WORLD.height - 16 ||
      inWater(p, 5) ||
      blocksWorkbench(p)
    )
      return true;
    return this.state.resources.some(
      (r) =>
        r.hp > 0 &&
        (r.kind === 'tree' || r.kind === 'stone') &&
        distance(p, r) < (r.kind === 'tree' ? 10 : 9),
    );
  }
  update(dt: number) {
    if (this.paused || this.state.status !== 'playing') return;
    const s = this.state,
      n = s.needs;
    const previousTime = s.time;
    const movement = movementVector(this.keys);
    if (this.action?.kind === 'feed' && (movement.x || movement.y || this.target || this.campUnsafe))
      this.leaveCamp();
    s.time += dt;
    this.processAction();
    this.clearUnavailableEquipment();
    this.effects = this.effects.filter((effect) => s.time - effect.startedAt < 1.1);
    for (const [id, animation] of this.resourceAnimations)
      if (s.time - animation.startedAt > 1.2) this.resourceAnimations.delete(id);
    const factor = s.difficulty === 'explorer' ? 0.55 : s.difficulty === 'wild' ? 1.35 : 0.9;
    let { x: dx, y: dy } = movementVector(this.keys);
    let targetDistance = Infinity;
    if (dx || dy) this.target = null;
    else if (this.target) {
      const remaining = { x: this.target.x - s.player.x, y: this.target.y - s.player.y };
      if (Math.max(Math.abs(remaining.x), Math.abs(remaining.y)) < 0.000001) this.target = null;
      else {
        // Finish one straight leg before turning. Re-selecting the dominant axis
        // each frame would form a staircase that still looks like diagonal travel.
        this.targetAxis ??= Math.abs(remaining.x) > Math.abs(remaining.y) ? 'x' : 'y';
        if (Math.abs(remaining[this.targetAxis]) < 0.000001)
          this.targetAxis = this.targetAxis === 'x' ? 'y' : 'x';
        targetDistance = Math.abs(remaining[this.targetAxis]);
        dx = this.targetAxis === 'x' ? Math.sign(remaining.x) : 0;
        dy = this.targetAxis === 'y' ? Math.sign(remaining.y) : 0;
      }
    }
    // Plant gathering occupies both hands and keeps the feet planted for its short action.
    if (this.action?.kind === 'forage' || this.action?.kind === 'feed') {
      dx = 0;
      dy = 0;
      this.target = null;
    }
    const before = { ...s.player };
    const intent = Boolean(dx || dy);
    const sprint = intent && this.keys.has('shift') && n.stamina > 2 && !this.action;
    if (intent) {
      const speed = Math.min((sprint ? 87 : 58) * dt * (this.action ? 0.38 : 1), targetDistance);
      dx *= speed;
      dy *= speed;
      const next = moveWithCollision(s.player, dx, dy, (point) => this.collision(point));
      Object.assign(s.player, next);
      const actualX = s.player.x - before.x,
        actualY = s.player.y - before.y;
      if (!this.action && Math.hypot(actualX, actualY) > 0.0001) {
        s.direction = facingDirection(actualX, actualY, s.direction);
        if (actualX) s.facing = actualX < 0 ? -1 : 1;
      }
    }
    const travelled = distance(before, s.player);
    if (this.target && intent && dt > 0 && travelled < 0.000001) this.target = null;
    this.moving = travelled > 0.0001;
    this.sprinting = this.moving && sprint;
    if (this.moving) {
      this.gaitDistance += travelled;
      s.distance += travelled;
      n.stamina = clamp(n.stamina + (sprint ? -15 : 5) * dt);
      if (s.time - this.lastStep > (sprint ? 0.22 : 0.36)) {
        this.lastStep = s.time;
        this.onSound?.('step');
      }
    } else {
      n.stamina = clamp(n.stamina + 12 * dt);
    }
    if (this.keys.has(' ')) this.attack();
    else if (this.keys.has('primary') && (s.equipped === 'hatchet' || s.equipped === 'pickaxe'))
      this.useHeld(this.aim);
    else if (this.keys.has('e') && this.campFocus === null) this.interact();
    const weather = weatherAt(s.time);
    if (weather !== s.weather) {
      s.weather = weather;
      if (weather === 'rain' || weather === 'storm') {
        this.notify(
          weather === 'storm'
            ? 'Thunder in the treetops. Get to shelter.'
            : 'Rain is rolling in. Keep warm and stay close to camp.',
          'warning',
        );
        this.log(
          weather === 'storm'
            ? 'A thunderstorm swept through the forest.'
            : 'The forest disappeared under a curtain of rain.',
          'danger',
        );
      } else if (weather === 'cold') {
        this.notify('A cold wind is rising. Find the warmth of a fire.', 'warning');
        this.log('The night brought a bitter cold snap.', 'danger');
      } else if (weather === 'wolves') {
        this.notify('A howl in the distance. Keep your hatchet ready.', 'warning');
        this.log('Wolves called from somewhere beyond the firelight.', 'danger');
        const count = s.difficulty === 'explorer' ? 1 : s.difficulty === 'wild' ? 3 : 2;
        for (let i = 0; i < count; i++) {
          const angle = this.rng() * Math.PI * 2;
          const spawn = Array.from({ length: 16 }, (_, attempt) => ({
            x: clamp(
              s.player.x + Math.cos(angle + attempt * 2.399) * (205 + (attempt % 3) * 18),
              30,
              WORLD.width - 30,
            ),
            y: clamp(
              s.player.y + Math.sin(angle + attempt * 2.399) * (205 + (attempt % 3) * 18),
              30,
              WORLD.height - 30,
            ),
          })).find(
            (point) =>
              !this.collision(point) &&
              s.wolves.every((wolf) => distance(wolf, point) >= 30) &&
              s.fires.every((fire) => fire.fuel <= 0 || distance(fire, point) >= 40),
          );
          if (!spawn) continue;
          s.wolves.push({
            id: Math.floor(s.time) * 10 + i,
            ...spawn,
            hp: 2,
            cooldown: 1,
            scared: 0,
          });
        }
      } else this.notify('The forest settles. A little quiet, for now.', 'info');
      this.onSound?.('notice');
    }
    const warm = this.fireNearby,
      sheltered = this.shelterNearby;
    n.hunger = clamp(n.hunger - dt * 0.135 * factor);
    n.thirst = clamp(n.thirst - dt * 0.175 * factor);
    const wet = s.weather === 'rain' || s.weather === 'storm';
    let warmthChange = this.night ? -0.2 * factor : 0.4;
    if (wet) warmthChange -= 0.5 * factor;
    if (s.weather === 'cold') warmthChange -= 0.75 * factor;
    if (warm) warmthChange += 1.8;
    if (sheltered) warmthChange += wet ? 1 : 0.65;
    if (this.torchActive) warmthChange += 0.5;
    n.warmth = clamp(n.warmth + warmthChange * dt);
    for (const stat of [n.hunger, n.thirst, n.warmth])
      if (stat < 8) n.health = clamp(n.health - dt * 0.85 * factor);
    if (warm && n.hunger > 40 && n.thirst > 35) n.health = clamp(n.health + dt * 0.22);
    for (const fire of s.fires) fire.fuel = clamp(fire.fuel - dt * (wet ? 0.44 : 0.25));
    for (const resource of s.resources)
      if (resource.hp <= 0 && s.time > resource.readyAt) {
        resource.hp = RESOURCE_HP[resource.kind];
        this.resourceAnimations.set(resource.id, { kind: 'regrow', startedAt: s.time });
      }
    this.wolfPack.update(
      s,
      dt,
      this.torchActive,
      (point) => this.collision(point) || s.fires.some((fire) => fire.fuel > 0 && distance(fire, point) < 35),
      () => {
        n.health = clamp(n.health - 7 * factor);
        this.hitFlash = 0.35;
        this.burst(s.player, '#cf846d');
        this.onSound?.('hit');
      },
    );
    if (s.weather !== 'wolves') s.wolves = s.wolves.filter((wolf) => distance(wolf, s.player) < 220);
    this.updateCamp(dt);
    const nights = Math.max(0, Math.floor((s.time + 15) / DAY_LENGTH));
    if (nights > s.nights) {
      s.nights = nights;
      this.notify(`You made it. ${nights === 1 ? 'Your first night' : `Night ${nights}`} survived.`);
      this.log(`Watched the sun rise after night ${nights}. Still here. Still breathing.`, 'milestone');
      if (nights >= 3 && !s.victoryAcknowledged) s.status = 'won';
    }
    if (n.health <= 0) {
      s.status = 'dead';
      this.log('The forest keeps its own time. Your journey ends here.', 'milestone');
    }
    if (Math.floor(previousTime / 30) !== Math.floor(s.time / 30)) {
      if (n.thirst < 25) this.notify('You’re getting thirsty. Drink some spring water.', 'warning');
      else if (n.hunger < 25)
        this.notify('Your stomach is growling. Eat something from your supplies.', 'warning');
      else if (n.warmth < 25) this.notify('You’re getting cold. Find a fire or shelter.', 'warning');
    }
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.swing = Math.max(0, this.swing - dt);
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += dt * 40;
      p.life -= dt;
    }
    this.floating = this.floating.filter((f) => f.life > 0);
    for (const f of this.floating) {
      f.y -= dt * 10;
      f.life -= dt;
    }
    this.toasts = this.toasts.filter((t) => s.time - t.time < 7);
  }
  view(): GameView {
    const s = this.state;
    const nearestFire = [...s.fires].sort((a, b) => distance(a, s.player) - distance(b, s.player))[0];
    const hearth = s.fires.find((fire) => fire.id === this.campFocus);
    const feeding = this.action?.kind === 'feed';
    return {
      time: s.time,
      day: Math.floor(s.time / DAY_LENGTH) + 1,
      hour: this.hour,
      needs: { ...s.needs },
      inventory: { ...s.inventory },
      weather: s.weather,
      nights: s.nights,
      status: s.status,
      player: { ...s.player },
      nearest: this.nearest(),
      gathered: { ...s.gathered },
      crafted: [...s.crafted],
      toasts: [...this.toasts],
      fireNearby: this.fireNearby,
      workbenchNearby: this.workbenchNearby,
      fireFuel: nearestFire?.fuel || 0,
      camp: hearth
        ? {
            id: hearth.id,
            fuel: hearth.fuel,
            secondsLeft: Math.ceil(
              hearth.fuel / (s.weather === 'rain' || s.weather === 'storm' ? 0.44 : 0.25),
            ),
            canFeed: s.inventory.wood > 0 && hearth.fuel <= 80 && !this.action,
            feeding,
            progress: feeding ? Math.min(1, (s.time - this.action!.startedAt) / this.action!.duration) : 0,
          }
        : null,
      wolvesNear: s.wolves.filter((wolf) => wolf.hp > 0 && distance(wolf, s.player) < 130).length,
      wolfWindup: [...this.wolfPack.minds.values()].some((mind) => mind.phase === 'windup'),
      shelterNearby: this.shelterNearby,
      torchActive: this.torchActive,
      journal: [...s.journal],
      name: s.name,
      difficulty: s.difficulty,
      savedAt: s.savedAt,
      equipped: s.equipped,
      hotbar: [...s.hotbar],
      action: this.action ? { ...this.action } : null,
      torchLit: this.torchLit,
      kills: s.kills,
      distance: s.distance,
    };
  }
}
