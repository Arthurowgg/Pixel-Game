import type { ItemId, Recipe, Settings, Weather } from './types';

export const WORLD = { width: 1800, height: 1400 };
export const CAMP = { x: 900, y: 740 };
/** The camp has a resting bench, never a free crafting station. */
export const CAMP_BENCH = { x: 878, y: 716 };
export const SPAWN = { x: 900, y: 796 };
export const POND = { x: 1220, y: 660, rx: 110, ry: 76 };
export const SPRING = { x: 1098, y: 660 };
export const DAY_LENGTH = 180;
export const SAVE_KEY = 'wildpine.save.v2';
export const LEGACY_SAVE_KEY = 'wildpine.save.v1';
export const SETTINGS_KEY = 'wildpine.settings.v1';
export const RECORDS_KEY = 'wildpine.records.v1';
export const ITEMS: Record<ItemId, { name: string; description: string; action?: string; category: string }> =
  {
    hatchet: {
      name: 'Old hatchet',
      description:
        'A little worn, but still sharp. Equip it yourself, then left-click to chop or swing. E interacts with nearby trees.',
      action: 'Ready hatchet',
      category: 'TOOL',
    },
    pickaxe: {
      name: 'Stone pickaxe',
      description:
        'Equip this pick before mining. Left-click or E near a boulder; each strike lands on the downswing.',
      action: 'Ready pickaxe',
      category: 'TOOL',
    },
    wood: {
      name: 'Pine wood',
      description: 'Dry, fragrant pine. Build something that lasts, or burn it to last another night.',
      category: 'RESOURCE',
    },
    stone: {
      name: 'River stone',
      description: 'Smoothed by the seasons. A sturdy foundation for a campfire.',
      category: 'RESOURCE',
    },
    fiber: {
      name: 'Wild fiber',
      description: 'Tough forest grasses. Useful for shelter, bandages, and a little ingenuity.',
      category: 'RESOURCE',
    },
    berries: {
      name: 'Wild berries',
      description: 'A tart handful of forest berries. Restores 22 hunger and 5 thirst.',
      action: 'Eat berries',
      category: 'FOOD',
    },
    water: {
      name: 'Spring water',
      description: 'Cool, clean spring water. Restores 35 thirst. Refill at the spring east of camp.',
      action: 'Drink water',
      category: 'SUPPLY',
    },
    mushroom: {
      name: 'Golden mushroom',
      description: 'A familiar edible mushroom. Restores 12 hunger, or cook it into a much better meal.',
      action: 'Eat mushroom',
      category: 'FOOD',
    },
    nuts: {
      name: 'Pine nuts',
      description:
        'A little food hidden in the pines. Felling a tree yields one portion. Restores 14 hunger.',
      action: 'Eat pine nuts',
      category: 'FOOD',
    },
    tea: {
      name: 'Berry tea',
      description:
        'A steaming campfire brew. Restores 25 thirst and 24 warmth. Brew at a workbench near a burning fire, using two berries and one water.',
      action: 'Drink berry tea',
      category: 'SUPPLY',
    },
    bandage: {
      name: 'Herbal bandage',
      description: 'Soft fibers and crushed berries. Restores 35 health.',
      action: 'Apply bandage',
      category: 'MEDICINE',
    },
    torch: {
      name: 'Pine torch',
      description: 'A small light in a big forest. Keeps you warm and frightens wolves for 35 seconds.',
      action: 'Light torch',
      category: 'SURVIVAL',
    },
    meal: {
      name: 'Forest stew',
      description: 'A proper campfire meal. Restores 55 hunger, 10 thirst, and 8 health.',
      action: 'Eat stew',
      category: 'FOOD',
    },
    campfire: {
      name: 'Campfire kit',
      description: 'A home wherever you need one. Place a fire nearby, then feed it pine wood with E.',
      action: 'Place campfire',
      category: 'CAMP',
    },
    workbench: {
      name: 'Workbench',
      description:
        'A small field workshop you build yourself. Hold it and place it on clear ground, then interact with it to make equipment, camp kits and food.',
      action: 'Place workbench',
      category: 'CAMP',
    },
    shelter: {
      name: 'Forest shelter',
      description: 'A roof against the rain and cold. Place it nearby, then stay close for protection.',
      action: 'Build shelter',
      category: 'CAMP',
    },
    rope: {
      name: 'Twisted rope',
      description: 'Three strands of wild fiber worked tight. Binding for anything you build.',
      category: 'MATERIAL',
    },
    plank: {
      name: 'Pine plank',
      description: 'A board split from clean pine. Half the work of a proper shelter, already done.',
      category: 'MATERIAL',
    },
    moss: {
      name: 'Forest moss',
      description: 'Scraped from the mossy boulders. Cool on the skin, and the base of a good salve.',
      category: 'RESOURCE',
    },
    salve: {
      name: 'Moss salve',
      description: 'Moss and fiber worked into a pot of green balm. Restores 25 health.',
      action: 'Apply salve',
      category: 'MEDICINE',
    },
  };
export const RECIPES: Recipe[] = [
  {
    id: 'workbench',
    name: 'Workbench',
    description: 'A few planks. A place for your next idea.',
    cost: { wood: 6, fiber: 3 },
    category: 'camp',
  },
  {
    id: 'pickaxe',
    needsWorkbench: true,
    name: 'Stone pickaxe',
    description: 'A wooden grip. A stone head. A little leverage.',
    cost: { wood: 3, stone: 3, fiber: 1 },
    category: 'survival',
  },
  {
    id: 'campfire',
    needsWorkbench: true,
    name: 'Campfire',
    description: 'Warm hands. Safe nights. A place to start.',
    cost: { wood: 5, stone: 3 },
    category: 'camp',
  },
  {
    id: 'shelter',
    needsWorkbench: true,
    name: 'Forest shelter',
    description: 'A little cover from a very big sky.',
    cost: { wood: 10, fiber: 6 },
    category: 'camp',
  },
  {
    id: 'torch',
    name: 'Pine torch',
    description: 'Keep the dark—and the wolves—at a distance.',
    cost: { wood: 3, fiber: 2 },
    category: 'survival',
  },
  {
    id: 'bandage',
    name: 'Herbal bandage',
    description: 'Patch yourself up and keep moving.',
    cost: { fiber: 3, berries: 1 },
    category: 'survival',
  },
  {
    id: 'meal',
    needsWorkbench: true,
    name: 'Forest stew',
    description: 'A warm meal makes all the difference.',
    cost: { berries: 3, mushroom: 1 },
    category: 'survival',
    needsFire: true,
  },
  {
    id: 'rope',
    name: 'Twisted rope',
    description: 'Three fibers, one strand. Useful binding for the work ahead.',
    cost: { fiber: 3 },
    category: 'survival',
  },
  {
    id: 'plank',
    name: 'Pine plank',
    description: 'Split a log into a flat board you can build with.',
    cost: { wood: 2 },
    category: 'survival',
  },
  {
    id: 'salve',
    needsWorkbench: true,
    name: 'Moss salve',
    description: 'Boulder moss and crushed fiber. Cools a wound and closes it.',
    cost: { moss: 2, fiber: 2 },
    category: 'survival',
  },
  {
    id: 'tea',
    needsWorkbench: true,
    name: 'Berry tea',
    description: 'A little warmth to carry into the cold.',
    cost: { berries: 2, water: 1 },
    category: 'survival',
    needsFire: true,
  },
];
export const WEATHER: Record<Weather, { name: string; description: string; icon: string; color: string }> = {
  clear: {
    name: 'Clear skies',
    description: 'A little breathing room. Make it count.',
    icon: 'sun',
    color: '#e6c589',
  },
  rain: {
    name: 'Passing rain',
    description: 'The rain is cooling you down. Find a fire or shelter.',
    icon: 'rain',
    color: '#98bec2',
  },
  storm: {
    name: 'Thunderstorm',
    description: 'A storm is rolling through. Stay under cover.',
    icon: 'storm',
    color: '#acb4d3',
  },
  cold: {
    name: 'Cold snap',
    description: 'The temperature is falling. Keep your fire burning.',
    icon: 'snow',
    color: '#b4ced0',
  },
  wolves: {
    name: 'Wolves nearby',
    description: 'You hear something in the pines. Fire keeps it away.',
    icon: 'paw',
    color: '#dba080',
  },
};
export const RESOURCE_HP = { tree: 6, stone: 4, berries: 1, fiber: 1, mushroom: 1 } as const;
export const BERRY_COLLECT_TIME = 1.8;
export const TORCH_DURATION = 35;
export const QUICK_ITEMS: ItemId[] = ['hatchet', 'pickaxe', 'berries', 'water', 'bandage', 'torch'];
export const DEFAULT_SETTINGS: Settings = {
  sound: true,
  masterVolume: 1,
  effects: 0.35,
  ambience: 0.2,
  reducedMotion: false,
  atmosphere: true,
  showHints: true,
  compactHud: true,
  pixelScale: 2,
  damageFlash: true,
  floatingText: true,
  vignette: true,
};
export const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);
export const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));
export const clock = (time: number) => {
  const hours = (8 + ((time % DAY_LENGTH) / DAY_LENGTH) * 24) % 24;
  return `${String(Math.floor(hours)).padStart(2, '0')}:${String(Math.floor(((hours % 1) * 60) / 5) * 5).padStart(2, '0')}`;
};
export function random(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
