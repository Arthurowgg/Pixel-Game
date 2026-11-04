import { useId, useState } from 'react';
import { Modal } from './Modal';
import { Icon, ItemIcon, Key } from './Icon';
import { ITEMS, RECIPES } from '../game/data';
import { assetUrl } from '../game/assets';
import { maxCraftable, recipeStation, RECIPE_BENEFITS, stationReady } from '../game/crafting';
import type { Simulation } from '../game/simulation';
import type { GameView, ItemId, Recipe } from '../game/types';

const CATEGORIES = [
  ['all', 'All'],
  ['survival', 'Trail kit'],
  ['camp', 'Camp'],
  ['cooking', 'Cooking'],
] as const;
type Category = (typeof CATEGORIES)[number][0];
const inCategory = (recipe: Recipe, category: Category) =>
  category === 'all' ||
  (category === 'cooking' ? !!recipe.needsFire : recipe.category === category && !recipe.needsFire);

export function CraftingDialog({
  view,
  sim,
  onBackpack,
  onClose,
  onRefresh,
  onMap,
}: {
  view: GameView;
  sim: Simulation;
  onBackpack: () => void;
  onClose: () => void;
  onRefresh: () => void;
  onMap: () => void;
}) {
  const id = useId();
  const [selected, setSelected] = useState<ItemId>('campfire');
  const [category, setCategory] = useState<Category>('all');
  const [query, setQuery] = useState('');
  const [readyOnly, setReadyOnly] = useState(false);
  const [requested, setRequested] = useState(1);
  const [feedback, setFeedback] = useState('');
  const [crafted, setCrafted] = useState<ItemId | null>(null);
  const recipes = RECIPES.filter(
    (recipe) =>
      inCategory(recipe, category) &&
      `${recipe.name} ${recipe.description}`.toLowerCase().includes(query.trim().toLowerCase()) &&
      (!readyOnly || maxCraftable(recipe, view) > 0),
  );
  const recipe = recipes.find((entry) => entry.id === selected) || recipes[0];
  const maximum = recipe ? maxCraftable(recipe, view) : 0;
  const quantity = Math.min(requested, Math.max(1, maximum));
  const choose = (item: ItemId) => {
    setSelected(item);
    setRequested(1);
    setFeedback('');
    setCrafted(null);
  };
  const activeStation = recipe ? stationReady(recipe, view) : false;
  return (
    <Modal
      title="The camp workshop"
      eyebrow="HEARTH & HAND · A LITTLE INGENUITY"
      className="crafting-dialog"
      wide
      onClose={onClose}
    >
      <div className="dialog-tabs inventory-tabs workshop-tabs">
        <button onClick={onBackpack}>
          <Icon name="pack" size={18} /> Backpack <Key>B</Key>
        </button>
        <button className="active" aria-current="page">
          <Icon name="workbench" size={20} /> Crafting <Key>C</Key>
        </button>
      </div>
      <div className="workshop-station">
        <img src={assetUrl('art/objects/workbench.png')} alt="" width={88} height={61} />
        <div>
          <strong>
            {view.workbenchNearby
              ? 'A good place to make something.'
              : 'A little ingenuity, wherever you are.'}
          </strong>
          <p>
            {view.workbenchNearby
              ? 'Your camp table is in reach. Lay out your supplies.'
              : 'Make trail essentials by hand. Tools and shelter need your camp table.'}
          </p>
        </div>
        <div className="workshop-station-tags" aria-label="Available crafting stations">
          <span className={view.workbenchNearby ? 'available' : ''}>
            <Icon name="workbench" size={16} /> {view.workbenchNearby ? 'Table ready' : 'Table out of reach'}
          </span>
          <span className={view.fireNearby ? 'available' : ''}>
            <Icon name="fire" size={14} /> {view.fireNearby ? 'Fire burning' : 'No burning fire'}
          </span>
        </div>
      </div>
      <div className="workshop-filters">
        <label className="workshop-search">
          <Icon name="compass" size={18} />
          <input
            aria-label="Find a recipe"
            placeholder="Find a recipe…"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setRequested(1);
            }}
          />
          {query && (
            <button aria-label="Clear recipe search" onClick={() => setQuery('')}>
              <Icon name="close" size={12} />
            </button>
          )}
        </label>
        <div
          className="workshop-categories"
          role="tablist"
          aria-label="Recipe categories"
          onKeyDown={(event) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const current = CATEGORIES.findIndex(([key]) => key === category);
            const next =
              CATEGORIES[
                event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? 3
                    : (current + (event.key === 'ArrowRight' ? 1 : 3)) % 4
              ][0];
            setCategory(next);
            setRequested(1);
            event.currentTarget.querySelector<HTMLButtonElement>(`[data-category="${next}"]`)?.focus();
          }}
        >
          {CATEGORIES.map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-label={label}
              id={`${id}-${key}`}
              aria-controls={`${id}-recipes`}
              aria-selected={category === key}
              tabIndex={category === key ? 0 : -1}
              data-category={key}
              className={category === key ? 'active' : ''}
              onClick={() => {
                setCategory(key);
                setRequested(1);
              }}
            >
              {label}
              <small>{RECIPES.filter((entry) => inCategory(entry, key)).length}</small>
            </button>
          ))}
        </div>
      </div>
      <div className="workshop-list-heading">
        <span>
          {recipes.length} {recipes.length === 1 ? 'RECIPE' : 'RECIPES'} IN YOUR FIELD NOTES
        </span>
        <label>
          <input
            type="checkbox"
            checked={readyOnly}
            onChange={(event) => {
              setReadyOnly(event.target.checked);
              setRequested(1);
            }}
          />{' '}
          Ready to craft
        </label>
      </div>
      <div className="workshop-layout">
        <section
          className="workshop-recipes"
          id={`${id}-recipes`}
          role="tabpanel"
          aria-labelledby={`${id}-${category}`}
        >
          {recipes.map((entry) => {
            const ready = maxCraftable(entry, view) > 0,
              station = stationReady(entry, view);
            return (
              <button
                key={entry.id}
                className={`recipe-row workshop-recipe ${recipe?.id === entry.id ? 'selected' : ''}`}
                aria-pressed={recipe?.id === entry.id}
                onClick={() => choose(entry.id)}
              >
                <span className="workshop-recipe-icon">
                  <ItemIcon item={entry.id} size={40} />
                </span>
                <span className="workshop-recipe-copy">
                  <strong>{entry.name}</strong>
                  <small>{recipeStation(entry)}</small>
                  <span className={`recipe-availability ${ready ? 'ready' : ''}`}>
                    {ready
                      ? 'Ready to craft'
                      : !station
                        ? entry.needsFire
                          ? 'Fire required'
                          : 'Table required'
                        : 'Missing supplies'}
                  </span>
                </span>
                <Icon name={ready ? 'check' : 'lock'} size={12} />
              </button>
            );
          })}
          {!recipes.length && (
            <div className="workshop-empty">
              <Icon name="journal" size={34} />
              <h3>No recipes on this page.</h3>
              <p>
                {readyOnly
                  ? 'Gather a few supplies, or turn off the ready-only filter.'
                  : 'Try “torch”, “shelter”, or “tea”.'}
              </p>
              <button
                onClick={() => {
                  setQuery('');
                  setCategory('all');
                  setReadyOnly(false);
                }}
              >
                Show all recipes
              </button>
            </div>
          )}
        </section>
        {recipe ? (
          <article className="workshop-plan" aria-label={`${recipe.name} recipe`}>
            <div className="workshop-result">
              <div className="workshop-result-icon" key={`${recipe.id}-${view.inventory[recipe.id]}`}>
                <ItemIcon item={recipe.id} size={68} />
              </div>
              <div>
                <span className="eyebrow">
                  {recipe.needsFire
                    ? 'FROM THE CAMPFIRE'
                    : recipe.needsWorkbench
                      ? 'FROM THE WORKBENCH'
                      : 'MADE BY HAND'}
                </span>
                <h3>{recipe.name}</h3>
                <span className="workshop-owned">
                  IN YOUR SATCHEL <b>×{view.inventory[recipe.id]}</b>
                </span>
              </div>
            </div>
            <p className="workshop-description">{recipe.description}</p>
            <div className="workshop-materials-heading">
              <span>LAY OUT YOUR MATERIALS</span>
              <small>HAVE / NEED</small>
            </div>
            <ul className="workshop-ingredients">
              {(Object.entries(recipe.cost) as [ItemId, number][]).map(([item, count]) => {
                const need = count * quantity,
                  have = view.inventory[item],
                  enough = have >= need;
                return (
                  <li key={item} className={enough ? 'enough' : 'missing'}>
                    <ItemIcon item={item} size={28} />
                    <div>
                      <span>{ITEMS[item].name}</span>
                      <small>{enough ? 'In your satchel' : `${need - have} more needed`}</small>
                    </div>
                    <b>
                      {have}
                      <small> / {need}</small>
                    </b>
                    <Icon name={enough ? 'check' : 'close'} size={11} />
                  </li>
                );
              })}
            </ul>
            <div className={`workshop-requirement ${activeStation ? 'ready' : ''}`}>
              <Icon
                name={recipe.needsFire ? 'fire' : recipe.needsWorkbench ? 'workbench' : 'pack'}
                size={18}
              />
              <span>
                {recipe.needsWorkbench
                  ? view.workbenchNearby
                    ? 'Crafting table in reach'
                    : 'Return to the crafting table at your first camp.'
                  : recipe.needsFire
                    ? view.fireNearby
                      ? 'Burning campfire in reach'
                      : 'Move closer to a burning campfire to cook.'
                    : 'No station needed. Make this anywhere.'}
              </span>
              {recipe.needsWorkbench && !view.workbenchNearby && (
                <button onClick={onMap}>
                  Show on map <Icon name="arrow" size={12} />
                </button>
              )}
            </div>
            <div className="workshop-batch">
              <span>HOW MANY?</span>
              <div className="workshop-stepper">
                <button
                  aria-label="Decrease crafting quantity"
                  disabled={quantity <= 1}
                  onClick={() => setRequested(quantity - 1)}
                >
                  −
                </button>
                <output aria-label="Crafting quantity">{quantity}</output>
                <button
                  aria-label="Increase crafting quantity"
                  disabled={quantity >= maximum}
                  onClick={() => setRequested(quantity + 1)}
                >
                  +
                </button>
              </div>
              <button
                className="workshop-max"
                disabled={maximum < 2}
                onClick={() => setRequested(maximum)}
                aria-label="Set crafting quantity to maximum"
              >
                MAX <small>{maximum}</small>
              </button>
            </div>
            <button
              className="button button-primary full-width workshop-craft-button"
              aria-label={`Craft ${recipe.name.toLowerCase()} +${quantity}`}
              disabled={maximum < quantity}
              onClick={() => {
                if (sim.craft(recipe.id, quantity)) {
                  setCrafted(recipe.id);
                  setRequested(1);
                }
                onRefresh();
                setFeedback(sim.toasts.at(-1)?.text || '');
              }}
            >
              <Icon name="hammer" size={19} />
              <span>
                {recipe.needsFire ? 'Make' : 'Craft'} {recipe.name.toLowerCase()}
              </span>
              <b>+{quantity}</b>
            </button>
            <p className="workshop-benefit">{RECIPE_BENEFITS[recipe.id]}</p>
          </article>
        ) : (
          <div className="workshop-plan workshop-no-selection">
            <img src={assetUrl('art/objects/workbench.png')} alt="" />
            <h3>Leave room for an idea.</h3>
            <p>Your next little project is a few supplies away.</p>
          </div>
        )}
      </div>
      {feedback && (
        <div className="workshop-feedback" role="status">
          <Icon name="check" size={18} />
          <span>{feedback}</span>
          {crafted && sim.available(crafted) && (
            <button
              onClick={() => {
                if (sim.equip(crafted)) {
                  onRefresh();
                  onClose();
                }
              }}
            >
              Hold {ITEMS[crafted].name.toLowerCase()} <Icon name="arrow" size={13} />
            </button>
          )}
        </div>
      )}
      <div className="world-paused-note">
        <Icon name="pause" size={10} /> THE FOREST IS PAUSED. TAKE YOUR TIME.
      </div>
    </Modal>
  );
}
