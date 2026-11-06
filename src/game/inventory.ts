import { ITEMS } from './data';
import type { ItemId } from './types';

export type InventoryCategory = 'all' | 'resources' | 'supplies' | 'tools' | 'camp';
export type InventorySort = 'category' | 'name' | 'quantity';
const GROUPS = ['TOOL', 'RESOURCE', 'MATERIAL', 'FOOD', 'SUPPLY', 'MEDICINE', 'SURVIVAL', 'CAMP'];
export function inventoryItems(
  inventory: Record<ItemId, number>,
  options: { category: InventoryCategory; sort: InventorySort; query: string; showMissing: boolean },
) {
  const query = options.query.trim().toLowerCase();
  const groups = {
    all: GROUPS,
    resources: ['RESOURCE', 'MATERIAL'],
    supplies: ['FOOD', 'SUPPLY', 'MEDICINE', 'SURVIVAL'],
    tools: ['TOOL'],
    camp: ['CAMP'],
  }[options.category];
  return (Object.keys(ITEMS) as ItemId[])
    .filter(
      (item) =>
        (options.showMissing || inventory[item] > 0) &&
        groups.includes(ITEMS[item].category) &&
        `${ITEMS[item].name} ${ITEMS[item].description}`.toLowerCase().includes(query),
    )
    .sort((a, b) => {
      const order =
        options.sort === 'quantity'
          ? inventory[b] - inventory[a]
          : options.sort === 'category'
            ? GROUPS.indexOf(ITEMS[a].category) - GROUPS.indexOf(ITEMS[b].category)
            : 0;
      return order || ITEMS[a].name.localeCompare(ITEMS[b].name, 'en');
    });
}
