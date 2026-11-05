import { discoveredLandmarks, mapViewport } from '../game/cartography';
import type { MapViewport } from '../game/cartography';
import { cellAt, exploredPercent } from '../game/exploration';
import { CraftingDialog } from './CraftingDialog';
import { SatchelDialog } from './SatchelDialog';
import { PixelPreview } from './PixelPreview';
import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { Modal } from './Modal';
import { clock, WORLD } from '../game/data';
import { drawMap } from '../game/renderer';
import type { Simulation } from '../game/simulation';
import type { GameView } from '../game/types';

export function BackpackDialog({
  tab,
  view,
  sim,
  onTab,
  onClose,
  onRefresh,
  onMap,
  workbenchId,
}: {
  tab: 'inventory' | 'craft' | 'workshop';
  view: GameView;
  sim: Simulation;
  onTab: (tab: 'inventory' | 'craft' | 'workshop') => void;
  onClose: () => void;
  onRefresh: () => void;
  onMap: () => void;
  workbenchId?: number;
}) {
  return tab === 'inventory' ? (
    <SatchelDialog
      view={view}
      sim={sim}
      onCraft={() => onTab('craft')}
      onClose={onClose}
      onRefresh={onRefresh}
    />
  ) : (
    <CraftingDialog
      key={tab}
      view={view}
      sim={sim}
      workbenchId={tab === 'workshop' ? workbenchId : undefined}
      onBackpack={() => onTab('inventory')}
      onHandcraft={() => onTab('craft')}
      onClose={onClose}
      onRefresh={onRefresh}
      onMap={onMap}
    />
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
  const [viewport, setViewport] = useState(() =>
    mapViewport(window.innerWidth < 620 ? 2.4 : 1.6, sim.state.player),
  );
  const drag = useRef<{ id: number; x: number; y: number; viewport: MapViewport } | null>(null);
  const discoveries = discoveredLandmarks(sim.state);
  const zoom = (change: number) =>
    setViewport((current) => mapViewport(current.zoom + change, current.center));
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const paint = () => {
      canvas.width = Math.max(120, Math.round(canvas.clientWidth));
      canvas.height = Math.round((canvas.width * WORLD.height) / WORLD.width);
      drawMap(canvas, sim.state, ground, true, viewport);
    };
    const observer = new ResizeObserver(paint);
    observer.observe(canvas);
    paint();
    return () => observer.disconnect();
  }, [sim, ground, viewport]);
  return (
    <Modal title="The Forest" eyebrow="YOUR FIELD MAP" onClose={onClose} wide className="map-dialog">
      <div className="map-toolbar">
        <span className="chart-progress">
          <Icon name="compass" size={17} />
          <b>{exploredPercent(sim.state.explored)}%</b> charted
        </span>
        <div className="map-navigation" role="group" aria-label="Map navigation">
          <button onClick={() => zoom(-0.5)} disabled={viewport.zoom <= 1} aria-label="Zoom out">
            −
          </button>
          <output aria-label="Map zoom">{viewport.zoom.toFixed(1)}×</output>
          <button onClick={() => zoom(0.5)} disabled={viewport.zoom >= 4} aria-label="Zoom in">
            +
          </button>
          <button
            onClick={() => setViewport(mapViewport(Math.max(2, viewport.zoom), sim.state.player))}
            aria-label="Center on you"
            title="Center on you"
          >
            <Icon name="compass" size={17} />
          </button>
          <button
            onClick={() => setViewport(mapViewport(1, { x: WORLD.width / 2, y: WORLD.height / 2 }))}
            aria-label="Full map"
            title="Full map"
          >
            <Icon name="expand" size={17} />
          </button>
        </div>
      </div>
      <div className="expanded-map">
        <canvas
          ref={ref}
          width={600}
          height={467}
          tabIndex={0}
          aria-describedby="map-instructions"
          aria-label={`Exploration map: ${exploredPercent(sim.state.explored)} percent charted. ${discoveries.length ? `Discovered: ${discoveries.map((point) => point.name).join(', ')}.` : 'The woodland beyond your camp is uncharted.'}`}
          onPointerDown={(event) => {
            if (drag.current || event.button !== 0) return;
            event.preventDefault();
            event.currentTarget.focus();
            event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, viewport };
          }}
          onPointerMove={(event) => {
            const start = drag.current;
            if (!start || start.id !== event.pointerId) return;
            const box = event.currentTarget.getBoundingClientRect();
            setViewport(
              mapViewport(start.viewport.zoom, {
                x:
                  start.viewport.center.x -
                  (((event.clientX - start.x) / box.width) * WORLD.width) / start.viewport.zoom,
                y:
                  start.viewport.center.y -
                  (((event.clientY - start.y) / box.height) * WORLD.height) / start.viewport.zoom,
              }),
            );
          }}
          onPointerUp={(event) => {
            if (drag.current?.id === event.pointerId) drag.current = null;
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
          onLostPointerCapture={() => {
            drag.current = null;
          }}
          onKeyDown={(event) => {
            const directions: Record<string, [number, number]> = {
              ArrowLeft: [-1, 0],
              ArrowRight: [1, 0],
              ArrowUp: [0, -1],
              ArrowDown: [0, 1],
            };
            const direction = directions[event.key];
            if (direction) {
              event.preventDefault();
              event.stopPropagation();
              setViewport((current) =>
                mapViewport(current.zoom, {
                  x: current.center.x + (direction[0] * 120) / current.zoom,
                  y: current.center.y + (direction[1] * 120) / current.zoom,
                }),
              );
            } else if (event.key === '+' || event.key === '-' || event.key === '=') {
              event.preventDefault();
              zoom(event.key === '-' ? -0.5 : 0.5);
            }
          }}
        />
        <span className="map-north">
          N<Icon name="arrow" size={12} />
        </span>
      </div>
      <div className="map-legend">
        <span>
          <i className="legend-you" />
          You
        </span>
        <span>
          <i className="legend-camp" />
          Camp
        </span>
        {discoveries.some((point) => point.name === 'The Spring') && (
          <span>
            <i className="legend-water" />
            Spring
          </span>
        )}
        {sim.state.workbenches.some((point) => sim.state.explored.includes(cellAt(point))) && (
          <span>
            <i className="legend-workbench" />
            Workbench
          </span>
        )}
        {sim.state.shelters.some((point) => sim.state.explored.includes(cellAt(point))) && (
          <span>
            <i className="legend-shelter" />
            Shelter
          </span>
        )}
        <span className="uncharted-key">
          <i />
          Uncharted
        </span>
      </div>
      <div className="chart-notes">
        <span id="map-instructions">Drag or use arrow keys to browse. Walk to reveal more.</span>
        <span>
          {discoveries.length
            ? `${discoveries.length} ${discoveries.length === 1 ? 'landmark' : 'landmarks'} found`
            : 'Your discoveries are saved.'}
        </span>
      </div>
    </Modal>
  );
}
export function JournalDialog({ view, onClose }: { view: GameView; onClose: () => void }) {
  const objectives = [
    { label: 'Gather 8 pine wood', current: view.gathered.wood || 0, goal: 8 },
    { label: 'Gather 3 wild fiber', current: view.gathered.fiber || 0, goal: 3 },
    { label: 'Craft your workbench', current: Number(view.crafted.includes('workbench')), goal: 1 },
    { label: 'Place your workbench', current: Math.min(1, view.workbenchCount), goal: 1 },
    { label: 'Collect 3 river stone', current: view.gathered.stone || 0, goal: 3 },
    { label: 'Craft a forest shelter', current: Number(view.crafted.includes('shelter')), goal: 1 },
    { label: 'See three sunrises', current: view.nights, goal: 3 },
  ];
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
      <details className="journal-objectives">
        <summary>
          First steps{' '}
          <span>
            {objectives.filter((goal) => goal.current >= goal.goal).length} / {objectives.length}
          </span>
        </summary>
        <ul>
          {objectives.map((goal) => (
            <li key={goal.label} className={goal.current >= goal.goal ? 'complete' : ''}>
              <Icon name={goal.current >= goal.goal ? 'check' : 'diamond'} size={12} />
              <span>{goal.label}</span>
              <b>
                {Math.min(goal.current, goal.goal)}/{goal.goal}
              </b>
            </li>
          ))}
        </ul>
      </details>
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
  onJournal,
  onQuit,
}: {
  view: GameView;
  onClose: () => void;
  onSettings: () => void;
  onGuide: () => void;
  onCondition: () => void;
  onFieldcraft: () => void;
  onJournal: () => void;
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
        <button className="button button-secondary" onClick={onJournal}>
          <Icon name="journal" size={15} />
          Field journal
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
