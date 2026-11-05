import type { ItemId, Point, Recipe, Workbench } from './types';

export interface CraftingContext {
  inventory: Record<ItemId, number>;
  fireNearby: boolean;
  workbenchNearby: boolean;
}
export const MAX_CRAFT_BATCH = 99;
export const WORKBENCH_REACH = 56;
export function atWorkbench(point: Point, benches: readonly Workbench[], id?: number) {
  return benches.some(
    (bench) =>
      (id === undefined || bench.id === id) &&
      Math.hypot(point.x - bench.x, point.y - bench.y) < WORKBENCH_REACH,
  );
}
export function blocksWorkbench(point: Point, benches: readonly Workbench[], padding = 0) {
  return benches.some(
    (bench) => Math.abs(point.x - bench.x) < 17 + padding && Math.abs(point.y - bench.y) < 7 + padding,
  );
}
export function recipeStation(recipe: Recipe) {
  return recipe.needsFire ? 'Workbench + burning fire' : recipe.needsWorkbench ? 'Workbench' : 'By hand';
}
export const handRecipes = (recipes: readonly Recipe[]) =>
  recipes.filter((recipe) => !recipe.needsWorkbench && !recipe.needsFire);
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
  workbench: 'Hold and place it on clear ground. Interact with your workbench to unlock the full workshop.',
  pickaxe: 'Two strikes break a boulder. Hold it with 2, or pin it to any pocket.',
  campfire: 'Place your kit on clear ground. Burn wood for warmth, cooking, and a little safety.',
  shelter: 'Build your kit in an open spot. Stay close to keep out of the cold and rain.',
  torch: '90 seconds of light and warmth. Keep it in hand to frighten wolves.',
  bandage: 'Restores 35 health. Use from your satchel, or hold it and left-click.',
  meal: '+55 hunger · +10 thirst · +8 health. A proper meal for the trail.',
  tea: '+25 thirst · +24 warmth. Carry the comfort of your campfire with you.',
};
