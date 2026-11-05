import { useState } from 'react';
import { Icon, ItemIcon, Key } from './Icon';
import { Modal } from './Modal';
import { ITEMS, RECIPES } from '../game/data';
import { inventoryItems } from '../game/inventory';
import type { InventoryCategory, InventorySort } from '../game/inventory';
import type { Simulation } from '../game/simulation';
import type { GameView, ItemId } from '../game/types';

const CATEGORIES = [
  ['all', 'All', 'pack'],
  ['resources', 'Resources', 'tree'],
  ['supplies', 'Supplies', 'food'],
  ['tools', 'Tools', 'hammer'],
  ['camp', 'Camp', 'workbench'],
] as const;
const DRAG_TYPE = 'application/x-wildpine-item';

export function SatchelDialog({
  view,
  sim,
  onCraft,
  onClose,
  onRefresh,
}: {
  view: GameView;
  sim: Simulation;
  onCraft: () => void;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [selected, setSelected] = useState<ItemId>(view.equipped ?? 'berries');
  const [category, setCategory] = useState<InventoryCategory>('all');
  const [sort, setSort] = useState<InventorySort>('category');
  const [query, setQuery] = useState('');
  const [showMissing, setShowMissing] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [dragging, setDragging] = useState<ItemId | null>(null);
  const items = inventoryItems(view.inventory, { category, sort, query, showMissing });
  const active = items.includes(selected) ? selected : items[0];
  const entry = active ? ITEMS[active] : null;
  const owned = Object.values(view.inventory).filter((count) => count > 0).length;
  const total = Object.values(view.inventory).reduce((sum, count) => sum + count, 0);
  const slot = active ? view.hotbar.indexOf(active) : -1;
  const pin = (index: number, item: ItemId) => {
    if (sim.assignSlot(index, item)) {
      onRefresh();
      setFeedback(`${ITEMS[item].name} pinned to pocket ${index + 1}.`);
    }
  };
  const hold = (item: ItemId) => {
    if (sim.equip(item)) {
      onRefresh();
      onClose();
    }
  };
  const use = (item: ItemId) => {
    if (item === 'workbench') {
      if (sim.equip(item)) {
        sim.notify('Choose a clear spot for your workbench. Left-click to place it.', 'info');
        onRefresh();
        onClose();
      }
      return;
    }
    // Choosing a different item is an explicit manual equipment change. It may
    // cancel an unfinished swing/forage before starting the selected use; a
    // paused action must not make the whole satchel's use buttons unusable.
    if (sim.action && sim.state.equipped !== item) sim.equip(item, false);
    const used = sim.use(item);
    onRefresh();
    setFeedback(sim.toasts.at(-1)?.text || '');
    if (used) onClose();
  };
  return (
    <Modal
      title="Your satchel"
      eyebrow="ROOTS & REFUGE · EVERYTHING YOU CARRY"
      onClose={onClose}
      className="inventory-dialog satchel-dialog"
      wide
    >
      <div className="dialog-tabs inventory-tabs satchel-tabs">
        <button className="active" aria-current="page">
          <Icon name="pack" size={20} /> Backpack <Key>B</Key>
        </button>
        <button onClick={onCraft}>
          <Icon name="hammer" size={18} /> Handcraft <Key>C</Key>
        </button>
        <span>PACK LIGHT. MAKE IT COUNT.</span>
      </div>
      <div className="satchel-summary">
        <div className="satchel-emblem">
          <Icon name="pack" size={42} />
        </div>
        <div>
          <b>{owned}</b>
          <span>ITEM TYPES</span>
        </div>
        <div>
          <b>{total}</b>
          <span>TOTAL SUPPLIES</span>
        </div>
        <div className="satchel-hand">
          {view.equipped ? <ItemIcon item={view.equipped} size={30} /> : <Icon name="pack" size={25} />}
          <span>
            <small>IN YOUR HANDS</small>
            <strong>{view.equipped ? ITEMS[view.equipped].name : 'Nothing equipped'}</strong>
          </span>
          {view.equipped && (
            <button
              aria-label="Stow held item"
              onClick={() => {
                sim.equip(null);
                onRefresh();
                setFeedback('Hands free. Nothing was consumed.');
              }}
            >
              Stow <Key>X</Key>
            </button>
          )}
        </div>
      </div>
      <div className="satchel-layout">
        <nav className="satchel-categories inventory-filter" aria-label="Backpack categories">
          <span className="satchel-section-label">SORT THROUGH</span>
          {CATEGORIES.map(([key, label, icon]) => (
            <button
              key={key}
              className={category === key ? 'active' : ''}
              aria-pressed={category === key}
              onClick={() => {
                setCategory(key);
                setFeedback('');
              }}
            >
              <Icon name={icon} size={20} />
              <span>{label}</span>
              <small>
                {
                  inventoryItems(view.inventory, {
                    category: key,
                    query: '',
                    showMissing: false,
                    sort: 'name',
                  }).length
                }
              </small>
            </button>
          ))}
          <p className="satchel-category-note">
            A place for every find.
            <br />
            Your pockets keep the important things close.
          </p>
        </nav>
        <section className="satchel-stock" aria-label="Backpack contents">
          <div className="satchel-toolbar">
            <label className="satchel-search">
              <Icon name="compass" size={16} />
              <input
                aria-label="Search backpack"
                placeholder="Find something…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              {query && (
                <button aria-label="Clear backpack search" onClick={() => setQuery('')}>
                  <Icon name="close" size={11} />
                </button>
              )}
            </label>
            <select
              aria-label="Sort backpack"
              value={sort}
              onChange={(event) => setSort(event.target.value as InventorySort)}
            >
              <option value="category">By kind</option>
              <option value="name">By name</option>
              <option value="quantity">By quantity</option>
            </select>
          </div>
          <div className="satchel-stock-heading">
            <span>
              {items.length} {items.length === 1 ? 'ITEM' : 'ITEMS'}
            </span>
            <label>
              <input
                type="checkbox"
                checked={showMissing}
                onChange={(event) => setShowMissing(event.target.checked)}
              />{' '}
              Show missing items
            </label>
          </div>
          <div className="inventory-grid satchel-grid">
            {items.map((item) => (
              <button
                key={item}
                className={`inventory-slot satchel-slot ${active === item ? 'selected' : ''} ${!view.inventory[item] ? 'empty' : ''}`}
                data-item={item}
                aria-label={`${ITEMS[item].name}, ${view.inventory[item]} in backpack`}
                aria-pressed={active === item}
                title={ITEMS[item].name}
                draggable={sim.available(item)}
                onDragStart={(event) => {
                  event.dataTransfer.setData(DRAG_TYPE, item);
                  event.dataTransfer.effectAllowed = 'copyMove';
                  setDragging(item);
                  setSelected(item);
                }}
                onDragEnd={() => setDragging(null)}
                onClick={() => {
                  setSelected(item);
                  setFeedback('');
                }}
              >
                {view.equipped === item && <em className="inventory-held">IN HAND</em>}
                <span className="satchel-slot-picture" key={`${item}-${view.inventory[item]}`}>
                  <ItemIcon item={item} size={38} />
                </span>
                <span className="satchel-slot-name">{ITEMS[item].name}</span>
                <b>{view.inventory[item] || '–'}</b>
                {view.hotbar.includes(item) && (
                  <i className="satchel-pinned">{view.hotbar.indexOf(item) + 1}</i>
                )}
              </button>
            ))}
          </div>
          {!items.length && (
            <div className="satchel-empty">
              <Icon name="pack" size={45} />
              <h3>{query ? 'No finds by that name.' : 'Room for your next find.'}</h3>
              <p>
                {query
                  ? 'Try another name or clear your filters.'
                  : 'This part of your satchel is empty. Gather, craft, and make it yours.'}
              </p>
              <button
                onClick={() => {
                  setQuery('');
                  setCategory('all');
                  setShowMissing(false);
                }}
              >
                Clear filters
              </button>
            </div>
          )}
        </section>
        <aside className="item-detail satchel-detail" aria-label="Selected item">
          {active && entry ? (
            <>
              <div className="satchel-detail-art">
                <ItemIcon item={active} size={74} />
                <span>×{view.inventory[active]}</span>
              </div>
              <div className="item-detail-title">
                <div>
                  <span className="eyebrow">{entry.category}</span>
                  <h3>{entry.name}</h3>
                </div>
              </div>
              <p>{entry.description}</p>
              <div className="satchel-item-state">
                <span>
                  {view.equipped === active
                    ? 'Equipped'
                    : view.inventory[active] > 0
                      ? 'In your pack'
                      : 'Not gathered yet'}
                </span>
                <span>{slot >= 0 ? `Pocket ${slot + 1}` : 'Not pinned'}</span>
              </div>
              <div className="inventory-item-actions">
                <button
                  className="button button-primary full-width"
                  disabled={!sim.available(active)}
                  onClick={() => hold(active)}
                >
                  <Icon name="pack" size={16} />
                  Hold {entry.name.toLowerCase()}
                </button>
                {entry.category !== 'TOOL' && entry.action ? (
                  <button
                    className="button button-secondary full-width"
                    disabled={!sim.available(active) || (!!view.action && view.equipped === active)}
                    onClick={() => use(active)}
                  >
                    {entry.action}
                    <Icon name="arrow" size={14} />
                  </button>
                ) : entry.category === 'RESOURCE' ? (
                  <button className="button button-secondary full-width" onClick={onCraft}>
                    <Icon name="hammer" size={15} />
                    Use in handcraft
                  </button>
                ) : null}
              </div>
              {!!view.action && view.equipped === active && (
                <p className="satchel-busy">
                  This action is paused. Close your satchel to finish it, or stow the item to cancel.
                </p>
              )}
              {RECIPES.some((recipe) => recipe.cost[active]) && (
                <div className="satchel-uses">
                  <span className="satchel-section-label">USEFUL FOR</span>
                  {RECIPES.filter((recipe) => recipe.cost[active])
                    .slice(0, 3)
                    .map((recipe) => (
                      <span key={recipe.id}>
                        <ItemIcon item={recipe.id} size={18} />
                        {recipe.name}
                        <small>{recipe.needsWorkbench ? 'Workbench' : 'By hand'}</small>
                      </span>
                    ))}
                </div>
              )}
            </>
          ) : (
            <div className="satchel-no-selection">
              <Icon name="leaf" size={32} />
              <h3>A little breathing room.</h3>
              <p>Choose a find to see what it can do.</p>
            </div>
          )}
        </aside>
      </div>
      <section
        className={`satchel-pockets slot-assignment ${dragging ? 'is-dragging' : ''}`}
        aria-label="Pocket assignments"
      >
        <div className="satchel-pockets-heading">
          <Icon name="pack" size={23} />
          <div>
            <strong>Keep it close.</strong>
            <span>
              {active
                ? `Drag an item here, or tap a pocket to pin ${ITEMS[active].name.toLowerCase()}.`
                : 'Six pockets. Your choice.'}
            </span>
          </div>
        </div>
        <div className="satchel-pocket-row">
          {view.hotbar.map((item, index) => (
            <div className="satchel-pocket" key={index} data-pocket={index + 1}>
              <button
                className={active && item === active ? 'assigned' : ''}
                disabled={!active && !dragging}
                aria-label={active ? `Pin ${ITEMS[active].name} to slot ${index + 1}` : `Pocket ${index + 1}`}
                aria-pressed={!!active && item === active}
                title={`Pocket ${index + 1}: ${item ? ITEMS[item].name : 'Empty'}`}
                onClick={() => {
                  if (active) pin(index, active);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'copy';
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const value = event.dataTransfer.getData(DRAG_TYPE);
                  if (Object.hasOwn(ITEMS, value)) pin(index, value as ItemId);
                  setDragging(null);
                }}
              >
                <kbd>{index + 1}</kbd>
                {item ? <ItemIcon item={item} size={29} /> : <span className="satchel-pocket-empty">+</span>}
              </button>
              {item && (
                <button
                  className="satchel-unpin"
                  aria-label={`Clear pocket ${index + 1}`}
                  onClick={() => {
                    sim.assignSlot(index, null);
                    onRefresh();
                    setFeedback(`Pocket ${index + 1} cleared. Your items are still in the satchel.`);
                  }}
                >
                  <Icon name="close" size={9} />
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
      {feedback && (
        <div className="inventory-feedback" role="status">
          <Icon name="check" size={14} />
          {feedback}
        </div>
      )}
      <div className="world-paused-note">
        <Icon name="pause" size={10} />
        THE FOREST IS PAUSED WHILE YOU’RE HERE.
      </div>
    </Modal>
  );
}
