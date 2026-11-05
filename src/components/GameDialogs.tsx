import { CraftingDialog } from './CraftingDialog';
import { PixelPreview } from './PixelPreview';
import { useEffect, useRef, useState } from 'react';
import { Icon, ItemIcon, Key } from './Icon';
import { Modal } from './Modal';
import { ITEMS, clock } from '../game/data';
import { drawMap } from '../game/renderer';
import type { Simulation } from '../game/simulation';
import type { GameView, ItemId } from '../game/types';

export function BackpackDialog({
  tab,
  view,
  sim,
  onTab,
  onClose,
  onRefresh,
  onMap,
}: {
  tab: 'inventory' | 'craft';
  view: GameView;
  sim: Simulation;
  onTab: (tab: 'inventory' | 'craft') => void;
  onClose: () => void;
  onRefresh: () => void;
  onMap: () => void;
}) {
  const [selected, setSelected] = useState<ItemId>('berries');
  const [filter, setFilter] = useState('all');
  const [feedback, setFeedback] = useState('');
  if (tab === 'craft')
    return (
      <CraftingDialog
        view={view}
        sim={sim}
        onBackpack={() => onTab('inventory')}
        onClose={onClose}
        onRefresh={onRefresh}
        onMap={onMap}
      />
    );
  const total = Object.entries(view.inventory).filter(([, count]) => count > 0).length;
  const items = (Object.keys(ITEMS) as ItemId[]).filter(
    (id) =>
      filter === 'all' ||
      (filter === 'resources'
        ? ITEMS[id].category === 'RESOURCE'
        : filter === 'tools'
          ? ITEMS[id].category === 'TOOL'
          : ['FOOD', 'SUPPLY', 'MEDICINE'].includes(ITEMS[id].category)),
  );
  const use = () => {
    const used = sim.use(selected);
    onRefresh();
    setFeedback(sim.toasts.at(-1)?.text || '');
    if (used) onClose();
  };
  return (
    <Modal
      title="Your satchel"
      eyebrow="SUPPLIES FOR THE TRAIL"
      onClose={onClose}
      className="inventory-dialog"
    >
      <div className="dialog-tabs inventory-tabs">
        <button
          className="active"
          onClick={() => {
            onTab('inventory');
            setFeedback('');
          }}
        >
          <Icon name="pack" size={16} />
          Backpack<Key>B</Key>
        </button>
        <button
          onClick={() => {
            onTab('craft');
            setFeedback('');
          }}
        >
          <Icon name="hammer" size={16} />
          Crafting<Key>C</Key>
        </button>
      </div>
      <>
        <div className="inventory-filter">
          <div>
            {[
              ['all', 'All'],
              ['resources', 'Resources'],
              ['supplies', 'Supplies'],
              ['tools', 'Tools'],
            ].map(([id, label]) => (
              <button className={filter === id ? 'active' : ''} key={id} onClick={() => setFilter(id)}>
                {label}
              </button>
            ))}
          </div>
          <span>
            {total} / {Object.keys(ITEMS).length} TYPES
          </span>
        </div>
        <div className="inventory-grid">
          {items.map((id) => (
            <button
              className={`inventory-slot ${selected === id ? 'selected' : ''} ${!view.inventory[id] ? 'empty' : ''}`}
              key={id}
              onClick={() => {
                setSelected(id);
                setFeedback('');
              }}
              title={ITEMS[id].name}
              aria-label={`${ITEMS[id].name}, ${view.inventory[id]} in backpack`}
              aria-pressed={selected === id}
            >
              {view.equipped === id && <em className="inventory-held">IN HAND</em>}
              <ItemIcon item={id} size={38} />
              <span>{ITEMS[id].name}</span>
              <b>{view.inventory[id] || '–'}</b>
            </button>
          ))}
        </div>
        <div className="item-detail">
          <div className="item-detail-title">
            <ItemIcon item={selected} size={44} />
            <div>
              <span className="eyebrow">{ITEMS[selected].category}</span>
              <h3>{ITEMS[selected].name}</h3>
            </div>
            <span className="detail-count">×{view.inventory[selected]}</span>
          </div>
          <p>{ITEMS[selected].description}</p>
          <div className="inventory-item-actions">
            <button
              className="button button-primary full-width"
              disabled={!sim.available(selected)}
              onClick={() => {
                if (sim.equip(selected)) {
                  onRefresh();
                  onClose();
                }
              }}
            >
              <Icon name="pack" size={15} />
              <span>Hold {ITEMS[selected].name.toLowerCase()}</span>
            </button>
            {ITEMS[selected].category === 'TOOL' ? (
              <p className="tool-use-hint">
                <Key>E</Key> gather <span>·</span> <Key>LEFT CLICK</Key> swing <span>·</span> <Key>SPACE</Key>{' '}
                defend
              </p>
            ) : ITEMS[selected].action ? (
              <button
                className="button button-secondary full-width"
                disabled={!sim.available(selected) || !!view.action}
                onClick={use}
              >
                {ITEMS[selected].action}
                <Icon name="arrow" size={14} />
              </button>
            ) : (
              <button className="button button-secondary full-width" onClick={() => onTab('craft')}>
                <Icon name="hammer" size={15} />
                Use in crafting
              </button>
            )}
          </div>
          <div className="slot-assignment">
            <span>PIN TO YOUR POCKETS</span>
            <div>
              {view.hotbar.map((item, index) => (
                <button
                  key={index}
                  className={item === selected ? 'assigned' : ''}
                  aria-label={`Pin ${ITEMS[selected].name} to slot ${index + 1}`}
                  aria-pressed={item === selected}
                  title={`Slot ${index + 1}: ${item ? ITEMS[item].name : 'Empty'}`}
                  onClick={() => {
                    sim.assignSlot(index, selected);
                    onRefresh();
                    setFeedback(`${ITEMS[selected].name} pinned to pocket ${index + 1}.`);
                  }}
                >
                  {index + 1}
                </button>
              ))}
            </div>
          </div>
        </div>
      </>
      {feedback && (
        <div className="inventory-feedback" role="status">
          <Icon name="check" size={13} />
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
export function MapDialog({
  sim,
  ground,
  onClose,
}: {
  sim: Simulation;
  ground?: HTMLCanvasElement;
  onClose: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) drawMap(ref.current, sim.state, ground, true);
  }, [sim, ground]);
  return (
    <Modal
      title="A familiar patch of wilderness."
      eyebrow="YOUR MAP · THE FOREST"
      onClose={onClose}
      wide
      className="map-dialog"
    >
      <div className="map-heading">
        <span>
          <Icon name="compass" size={15} />
          TEMPERATE WOODLAND
        </span>
        <span>
          {Math.round(sim.state.player.x)} E · {Math.round(sim.state.player.y)} N
        </span>
      </div>
      <div className="expanded-map">
        <canvas
          ref={ref}
          width={600}
          height={420}
          aria-label="Map of the forest showing your position, campfires, crafting table, and the spring"
        />
        <span className="map-north">
          N<Icon name="arrow" size={14} />
        </span>
        <span className="map-corner-label">
          WILDPINE FIELD SURVEY
          <br />
          1800 × 1400
        </span>
      </div>
      <div className="map-legend">
        <span>
          <i className="legend-you" />
          You are here
        </span>
        <span>
          <i className="legend-camp" />
          Campfire
        </span>
        <span>
          <i className="legend-workbench" />
          Crafting table
        </span>
        <span>
          <i className="legend-water" />
          Fresh water
        </span>
        <span>
          <i className="legend-shelter" />
          Shelter
        </span>
      </div>
      <div className="guide-tip">
        <Icon name="leaf" size={17} />
        <p>
          The crafting table is just east of your first campfire. Fresh spring water waits northeast of camp.
          The rest is yours to discover.
        </p>
      </div>
    </Modal>
  );
}
export function JournalDialog({ view, onClose }: { view: GameView; onClose: () => void }) {
  return (
    <Modal
      title="Notes from a life outside."
      eyebrow={`${view.name.toUpperCase()}’S FIELD JOURNAL`}
      onClose={onClose}
      className="journal-dialog"
    >
      <div className="journal-summary">
        <Icon name="journal" size={25} />
        <p>
          A record of little discoveries,
          <br />
          <strong>and the things that kept you going.</strong>
        </p>
        <span>DAY {String(view.day).padStart(2, '0')}</span>
      </div>
      <div className="journal-entries">
        {view.journal.map((entry, index) => (
          <article className={`journal-entry ${entry.kind}`} key={`${entry.time}-${index}`}>
            <div className="journal-timeline-icon">
              <Icon
                name={
                  entry.kind === 'danger'
                    ? 'moon'
                    : entry.kind === 'craft'
                      ? 'hammer'
                      : entry.kind === 'milestone'
                        ? 'sun'
                        : 'leaf'
                }
                size={16}
              />
            </div>
            <div>
              <span className="eyebrow">
                DAY {Math.floor(entry.time / 180) + 1} · {clock(entry.time)}
                <i>{entry.kind}</i>
              </span>
              <p>{entry.text}</p>
            </div>
          </article>
        ))}
      </div>
      <div className="journal-signoff">
        Keep going. There’s more to this story.<span>— the wild</span>
      </div>
    </Modal>
  );
}
export function PauseDialog({
  view,
  onClose,
  onSettings,
  onGuide,
  onCondition,
  onFieldcraft,
  onQuit,
}: {
  view: GameView;
  onClose: () => void;
  onSettings: () => void;
  onGuide: () => void;
  onCondition: () => void;
  onFieldcraft: () => void;
  onQuit: () => void;
}) {
  return (
    <Modal title="The forest can wait." eyebrow="TAKE A BREATHER" onClose={onClose} className="pause-dialog">
      <div className="pause-art">
        <PixelPreview clip="fire-burn" label="An animated pixel-art campfire" />
        <span>Rest your feet. Your camp is safe.</span>
      </div>
      <div className="pause-status">
        <span>
          <Icon name="sun" size={16} />
          DAY {String(view.day).padStart(2, '0')}
        </span>
        <span>{view.nights} / 3 NIGHTS</span>
        <span>{view.difficulty.toUpperCase()}</span>
      </div>
      <button className="button button-primary full-width" onClick={onClose}>
        <Icon name="play" size={14} />
        Back to the wild
        <Icon name="arrow" size={16} />
      </button>
      <div className="pause-secondary">
        <button className="button button-secondary" onClick={onCondition}>
          <Icon name="heart" size={16} />
          Your condition
        </button>
        <button className="button button-secondary" onClick={onFieldcraft}>
          <Icon name="compass" size={16} />
          Fieldcraft
        </button>
        <button className="button button-secondary" onClick={onGuide}>
          <Icon name="journal" size={15} />
          Survival guide
        </button>
        <button className="button button-secondary" onClick={onSettings}>
          <Icon name="settings" size={15} />
          Settings
        </button>
      </div>
      <button className="save-exit" onClick={onQuit}>
        <Icon name="save" size={16} />
        Save & return to main menu
        <Icon name="arrow" size={13} />
      </button>
      <p className="autosave-note">Your next sunrise will be right where you left it.</p>
    </Modal>
  );
}
export function EndDialog({
  view,
  onContinue,
  onRestart,
  onQuit,
}: {
  view: GameView;
  onContinue: () => void;
  onRestart: () => void;
  onQuit: () => void;
}) {
  const won = view.status === 'won';
  return (
    <Modal
      title={won ? 'And then, there was morning.' : 'The wild remembers you.'}
      eyebrow={won ? 'THREE NIGHTS. ONE LITTLE SURVIVOR.' : 'THE END OF THIS CHAPTER'}
      onClose={onQuit}
      dismissible={false}
      className="end-dialog"
    >
      <div className="end-symbol">
        <Icon name={won ? 'sun' : 'leaf'} size={48} />
      </div>
      <p className="end-description">
        {won
          ? `You did it, ${view.name}. You found your footing, weathered the unexpected, and made a little home in the unknown. This forest is part of your story now.`
          : `Some stories are short, ${view.name}. That doesn’t make them small. Take what you learned, breathe deep, and try a different path.`}
      </p>
      <div className="journey-stats">
        <div>
          <strong>{view.nights}</strong>
          <span>NIGHTS SURVIVED</span>
        </div>
        <div>
          <strong>
            {Math.floor(view.time / 60)}:{String(Math.floor(view.time % 60)).padStart(2, '0')}
          </strong>
          <span>TIME IN THE WILD</span>
        </div>
        <div>
          <strong>{Object.values(view.gathered).reduce((a, b) => a + b, 0)}</strong>
          <span>SUPPLIES FOUND</span>
        </div>
      </div>
      <button className="button button-primary full-width" onClick={won ? onContinue : onRestart}>
        <Icon name={won ? 'compass' : 'spark'} size={17} />
        {won ? 'Keep wandering' : 'Begin again'}
        <Icon name="arrow" size={15} />
      </button>
      <button className="button button-secondary full-width end-home" onClick={onQuit}>
        <Icon name="home" size={16} />
        Back to the main menu
      </button>
      <p className="autosave-note">This story has been added to your journey.</p>
    </Modal>
  );
}
