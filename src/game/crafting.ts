import { WORKBENCH } from './data';
import type { ItemId, Point, Recipe } from './types';

export interface CraftingContext {
  inventory: Record<ItemId, number>;
  fireNearby: boolean;
  workbenchNearby: boolean;
}
export const MAX_CRAFT_BATCH = 99;
export const WORKBENCH_REACH = 72;
export function atWorkbench(point: Point) {
  return Math.hypot(point.x - WORKBENCH.x, point.y - WORKBENCH.y) < WORKBENCH_REACH;
}
export function blocksWorkbench(point: Point, padding = 0) {
  return Math.abs(point.x - WORKBENCH.x) < 24 + padding && Math.abs(point.y - WORKBENCH.y) < 9 + padding;
}
export function recipeStation(recipe: Recipe) {
  return recipe.needsFire ? 'Burning campfire' : recipe.needsWorkbench ? 'Crafting table' : 'By hand';
}
export function stationReady(
  recipe: Recipe,
  context: Pick<CraftingContext, 'fireNearby' | 'workbenchNearby'>,
) {
  return (!recipe.needsFire || context.fireNearby) && (!recipe.needsWorkbench || context.workbenchNearby);
}
export function maxCraftable(recipe: Recipe, context: CraftingContext) {
  if (!stationReady(recipe, context)) return 0;
  return Math.max(
    0,
    Math.min(
      MAX_CRAFT_BATCH,
      1e6 - context.inventory[recipe.id],
      ...Object.entries(recipe.cost).map(([item, cost]) =>
        Math.floor(context.inventory[item as ItemId] / cost!),
      ),
    ),
  );
}
export function validCraftQuantity(quantity: number) {
  return Number.isInteger(quantity) && quantity >= 1 && quantity <= MAX_CRAFT_BATCH;
}
export const RECIPE_BENEFITS: Partial<Record<ItemId, string>> = {
  pickaxe: 'Two strikes break a boulder. Hold it with 2, or pin it to any pocket.',
  campfire: 'Place your kit on clear ground. Burn wood for warmth, cooking, and a little safety.',
  shelter: 'Build your kit in an open spot. Stay close to keep out of the cold and rain.',
  torch: '90 seconds of light and warmth. Keep it in hand to frighten wolves.',
  bandage: 'Restores 35 health. Use from your satchel, or hold it and press F.',
  meal: '+55 hunger · +10 thirst · +8 health. A proper meal for the trail.',
  tea: '+25 thirst · +24 warmth. Carry the comfort of your campfire with you.',
};
