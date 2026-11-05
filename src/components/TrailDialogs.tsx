import { useId, useState } from 'react';
import { Modal } from './Modal';
import { Icon, ItemIcon, Key } from './Icon';
import { ITEMS, RECIPES } from '../game/data';
import { recipeStation } from '../game/crafting';
import { condition, meterValue, urgentVitals, VITALS } from '../game/vitals';
import type { Vital } from '../game/vitals';
import type { GameView, ItemId } from '../game/types';

export function ConditionDialog({ view, onClose }: { view: GameView; onClose: () => void }) {
  const urgent = urgentVitals(view.needs);
  return (
    <Modal
      title="Your condition"
      eyebrow={`${view.name.toUpperCase()} · DAY ${view.day}`}
      className="condition-dialog"
      onClose={onClose}
    >
      <p className="trail-intro">
        {urgent.length ? 'A little care before the next stretch.' : 'Steady feet. A little room to breathe.'}
      </p>
      <div className="condition-list">
        {(Object.keys(VITALS) as Vital[]).map((key) => {
          const info = VITALS[key],
            value = meterValue(view.needs[key]),
            level = condition(value);
          return (
            <section className={`condition-entry ${level}`} key={key}>
              <div>
                <Icon name={info.icon} size={24} />
                <h3>{info.label}</h3>
                <span className="condition-tag">
                  {level === 'critical' ? 'Needs care' : level === 'low' ? 'Getting low' : 'Steady'}
                </span>
                <b>
                  {Math.ceil(value)}
                  <small>/100</small>
                </b>
              </div>
              <div
                className="vital-track"
                role="meter"
                aria-label={info.label}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.ceil(value)}
              >
                <i style={{ width: `${value}%`, background: info.color }} />
              </div>
              <p>{info.advice}</p>
            </section>
          );
        })}
      </div>
      <div className="trail-run-stats" aria-label="Adventure statistics">
        <span>
          <b>{view.nights}/3</b> sunrises
        </span>
        <span>
          <b>{Object.values(view.gathered).reduce((sum, count) => sum + count, 0)}</b> gathered
        </span>
        <span>
          <b>{view.crafted.length}</b> recipes made
        </span>
      </div>
      <p className="trail-footnote">
        <Icon name="pause" size={12} /> The forest is paused. Close this window when you’re ready.
      </p>
    </Modal>
  );
}

const WHERE: Record<ItemId, string> = {
  hatchet: 'Already in your starting kit. Three strikes fell a pine.',
  pickaxe:
    'In your starting kit, or craft a replacement at your placed workbench. Two strikes break a boulder.',
  wood: 'Chop a pine: 4 wood and 1 portion of pine nuts.',
  stone: 'Mine a boulder with your pickaxe.',
  fiber: 'Gather wild grasses, or collect berries for a little extra fiber.',
  berries: 'Gather the low berry bushes around the forest.',
  water: 'Use E at the spring northeast of your first camp. Bottles refill to 5.',
  mushroom: 'Gather golden mushrooms from the forest floor.',
  nuts: 'One portion drops when a pine is felled.',
  tea: 'Brew at a workbench near a burning fire: 2 berries and 1 water.',
  bandage: 'Craft from 3 fiber and 1 berry. One is included in your starting kit.',
  torch: 'Craft from 3 wood and 2 fiber. Light it, then keep it in hand.',
  meal: 'Use a workbench near a burning fire: 3 berries and 1 mushroom.',
  campfire: 'Make the kit at your workbench, then place it in an open clearing.',
  workbench: 'Build by hand, place on clear ground, then interact for advanced recipes.',
  shelter: 'Craft the kit at your placed workbench, then build it in an open clearing.',
};

export function FieldcraftDialog({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'supplies' | 'recipes'>('supplies');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ItemId>('berries');
  const id = useId();
  const items = (Object.keys(ITEMS) as ItemId[]).filter((key) =>
    `${ITEMS[key].name} ${ITEMS[key].category}`.toLowerCase().includes(search.trim().toLowerCase()),
  );
  return (
    <Modal
      title="The fieldcraft book"
      eyebrow="KNOW YOUR KIT · THE FOREST"
      onClose={onClose}
      wide
      className="fieldcraft-dialog"
    >
      <div
        className="dialog-tabs"
        role="tablist"
        aria-label="Fieldcraft pages"
        onKeyDown={(event) => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const next =
            event.key === 'Home'
              ? 'supplies'
              : event.key === 'End'
                ? 'recipes'
                : tab === 'supplies'
                  ? 'recipes'
                  : 'supplies';
          setTab(next);
          event.currentTarget.querySelector<HTMLButtonElement>(`[data-page="${next}"]`)?.focus();
        }}
      >
        {(['supplies', 'recipes'] as const).map((key) => (
          <button
            key={key}
            role="tab"
            id={`${id}-${key}`}
            aria-controls={`${id}-panel`}
            aria-selected={tab === key}
            tabIndex={tab === key ? 0 : -1}
            data-page={key}
            className={tab === key ? 'active' : ''}
            onClick={() => setTab(key)}
          >
            <Icon name={key === 'supplies' ? 'pack' : 'hammer'} size={20} />
            {key === 'supplies' ? 'Supplies' : 'Camp recipes'}
          </button>
        ))}
      </div>
      <section
        id={`${id}-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-${tab}`}
        className="fieldcraft-page"
      >
        {tab === 'supplies' ? (
          <>
            <label className="fieldcraft-search">
              <Icon name="compass" size={20} />
              <input
                aria-label="Find an item"
                placeholder="Find an item…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <span>{items.length}/15</span>
            </label>
            <div className="fieldcraft-supplies">
              <div className="fieldcraft-items" aria-label="Forest supplies">
                {items.map((key) => (
                  <button
                    key={key}
                    aria-pressed={selected === key}
                    className={selected === key ? 'selected' : ''}
                    onClick={() => setSelected(key)}
                  >
                    <ItemIcon item={key} size={28} />
                    <span>{ITEMS[key].name}</span>
                  </button>
                ))}
                {!items.length && (
                  <p className="trail-empty" role="status">
                    No supplies match. Try “wood” or “food”.
                  </p>
                )}
              </div>
              <article className="fieldcraft-detail">
                <ItemIcon item={selected} size={64} />
                <span className="eyebrow">{ITEMS[selected].category}</span>
                <h3>{ITEMS[selected].name}</h3>
                <p>{ITEMS[selected].description}</p>
                <h4>Out on the trail</h4>
                <p>{WHERE[selected]}</p>
                <div className="fieldcraft-tip">
                  <Key>B</Key> choose &amp; hold <span>·</span>
                  <Key>LEFT CLICK</Key> use
                </div>
              </article>
            </div>
          </>
        ) : (
          <div className="fieldcraft-recipes">
            {RECIPES.map((recipe) => (
              <article key={recipe.id}>
                <div className="fieldcraft-recipe-title">
                  <ItemIcon item={recipe.id} size={36} />
                  <div>
                    <h3>{recipe.name}</h3>
                    <span>
                      {recipeStation(recipe) === 'By hand'
                        ? 'Make anywhere'
                        : `${recipeStation(recipe)} needed`}
                    </span>
                  </div>
                </div>
                <p>{recipe.description}</p>
                <ul>
                  {(Object.entries(recipe.cost) as [ItemId, number][]).map(([key, count]) => (
                    <li key={key}>
                      <ItemIcon item={key} size={20} />
                      {count} {ITEMS[key].name.toLowerCase()}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        )}
      </section>
      <p className="trail-footnote">
        <Icon name="journal" size={14} /> A reference book, not a crafting bench. Open <Key>C</Key> in the
        forest to make something.
      </p>
    </Modal>
  );
}
