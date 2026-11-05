import { CampfirePanel } from './CampfirePanel';
import { ConditionDialog, FieldcraftDialog } from './TrailDialogs';
import { GameInput, touchMovementKeys } from '../game/movement';
import { LoadingScreen } from './LoadingScreen';
import { WORLD_ART } from '../game/animation';
import { finishTransition, nextPaint } from '../game/loading';
import type { LoadProgress } from '../game/loading';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon, ItemIcon, Key } from './Icon';
import { SurvivalHud } from './SurvivalHud';
import { BackpackDialog, EndDialog, JournalDialog, MapDialog, PauseDialog } from './GameDialogs';
import { GuideDialog, SettingsDialog } from './MenuDialogs';
import { ITEMS, WEATHER, TORCH_DURATION, clock } from '../game/data';
import { Simulation } from '../game/simulation';
import { Renderer, drawMap, loadArt } from '../game/renderer';
import { clearGame, recordRun, saveGame } from '../game/storage';
import { audio } from '../game/audio';
import type { GameState, GameView, ItemId, Settings } from '../game/types';

type Overlay =
  | 'inventory'
  | 'craft'
  | 'workshop'
  | 'map'
  | 'journal'
  | 'pause'
  | 'settings'
  | 'guide'
  | 'condition'
  | 'fieldcraft'
  | 'end'
  | null;
export function GameShell({
  initial,
  arrival,
  settings,
  onSettings,
  onQuit,
  onRestart,
}: {
  initial: GameState;
  arrival: 'new' | 'resume';
  settings: Settings;
  onSettings: (settings: Settings) => void;
  onQuit: () => void;
  onRestart: () => void;
}) {
  const [sim] = useState(() => new Simulation(initial));
  const [input] = useState(() => new GameInput(sim.keys));
  const workshopRef = useRef<number | undefined>(undefined);
  const trailReturn = useRef<Overlay>(null);
  const [view, setView] = useState<GameView>(() => sim.view());
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [ready, setReady] = useState(false);
  const [artError, setArtError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadPhase, setLoadPhase] = useState('Gathering your supplies…');
  const [loadProgress, setLoadProgress] = useState<LoadProgress>({
    completed: 0,
    total: WORLD_ART.length + 3,
    label: 'Forest artwork',
  });
  const readyRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(null),
    minimapRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const overlayRef = useRef(overlay);
  overlayRef.current = overlay;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const lastRecorded = useRef('playing');
  const [saveIssue, setSaveIssue] = useState(false);
  const refresh = useCallback(() => {
    setView(sim.view());
  }, [sim]);
  const open = useCallback(
    (next: Overlay) => {
      if (!readyRef.current && next !== null) return;
      if (next === 'condition' || next === 'fieldcraft' || next === 'journal')
        trailReturn.current = overlayRef.current === 'pause' ? 'pause' : null;
      if (next !== 'workshop') workshopRef.current = undefined;
      overlayRef.current = next;
      input.clear();
      sim.target = null;
      sim.paused = next !== null;
      setOverlay(next);
    },
    [sim, input],
  );
  const close = useCallback(() => {
    if (sim.state.status === 'playing') open(null);
  }, [open, sim]);
  const quit = () => {
    if (sim.state.status === 'playing') saveGame(sim.state);
    onQuit();
  };
  useEffect(() => {
    if (view.camp) {
      input.clear();
      sim.aim = null;
      // Entering the quiet view can hide a focused touch/HUD button. Keep
      // keyboard movement reachable rather than leaving focus in an inert tree.
      if (document.activeElement instanceof HTMLElement && document.activeElement.closest('.game-hud'))
        canvasRef.current?.focus({ preventScroll: true });
    }
  }, [view.camp?.id, input, sim]);
  useEffect(() => {
    const renderer = rendererRef.current;
    if (renderer) {
      const resized = renderer.settings.pixelScale !== settings.pixelScale;
      renderer.settings = settings;
      if (resized) renderer.resize();
    }
  }, [settings]);
  useEffect(() => {
    sim.paused = !ready || overlay !== null;
    if (overlay) {
      input.clear();
      if (sim.state.status === 'playing') {
        const ok = saveGame(sim.state);
        if (!ok) setSaveIssue(true);
      }
    }
  }, [overlay, ready, sim, input]);
  useEffect(() => {
    if (view.status !== 'playing' && lastRecorded.current !== view.status) {
      recordRun(sim.state);
      clearGame();
      lastRecorded.current = view.status;
      open('end');
    }
  }, [view.status, sim, open]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const controller = new AbortController();
    const started = performance.now();
    readyRef.current = false;
    sim.paused = true;
    input.clear();
    setReady(false);
    setArtError(null);
    setLoadPhase('Gathering your supplies…');
    setLoadProgress({ completed: 0, total: WORLD_ART.length + 3, label: 'Forest artwork' });
    let alive = true,
      frame = 0,
      last = performance.now(),
      lastUi = 0,
      lastSave = performance.now();
    const renderer = new Renderer(canvas, initial.seed, settingsRef.current, initial.forestVersion);
    rendererRef.current = renderer;
    sim.onSound = audio.play;
    sim.onOpenCrafting = (id) => {
      workshopRef.current = id;
      open('workshop');
      refresh();
    };
    const observer = new ResizeObserver(() => renderer.resize());
    observer.observe(canvas);
    const save = () => {
      if (readyRef.current && sim.state.status === 'playing' && !saveGame(sim.state)) setSaveIssue(true);
    };
    const tick = (time: number) => {
      if (!alive) return;
      const dt = Math.min(0.05, Math.max(0, (time - last) / 1000));
      last = time;
      sim.update(dt);
      renderer.draw(sim, time);
      if (time - lastUi > 120) {
        setView(sim.view());
        audio.scene(sim.state.time, sim.weatherMix);
        if (minimapRef.current && !settingsRef.current.compactHud)
          drawMap(minimapRef.current, sim.state, renderer.ground);
        lastUi = time;
      }
      if (time - lastSave > 5000) {
        save();
        lastSave = time;
      }
      frame = requestAnimationFrame(tick);
    };
    void (async () => {
      try {
        await nextPaint();
        if (!alive) return;
        await loadArt((progress) => {
          if (alive) setLoadProgress({ ...progress, total: WORLD_ART.length + 3 });
        }, controller.signal);
        if (!alive) return;
        setLoadPhase('Finding your little clearing…');
        await nextPaint();
        if (!alive) return;
        renderer.buildGround();
        setLoadProgress({
          completed: WORLD_ART.length + 1,
          total: WORLD_ART.length + 3,
          label: 'Terrain and campsite prepared',
        });
        setLoadPhase('Finding your bench. Lighting the path.');
        await nextPaint();
        if (!alive) return;
        renderer.draw(sim, performance.now());
        setLoadProgress({
          completed: WORLD_ART.length + 2,
          total: WORLD_ART.length + 3,
          label: 'Your world is rendered',
        });
        await nextPaint();
        if (!alive) return;
        setLoadProgress({
          completed: WORLD_ART.length + 3,
          total: WORLD_ART.length + 3,
          label: 'Ready for your first footsteps',
        });
        setLoadPhase(arrival === 'resume' ? 'Welcome back to the wild.' : 'Your story starts here.');
        await finishTransition(started, 550);
        if (!alive) return;
        readyRef.current = true;
        setReady(true);
        sim.paused = overlayRef.current !== null || document.hidden;
        if (document.hidden) open('pause');
        else canvas.focus({ preventScroll: true });
        last = performance.now();
        lastSave = last;
        frame = requestAnimationFrame(tick);
      } catch (error) {
        if (alive)
          setArtError(
            error instanceof Error ? error.message : 'A forest asset failed to load. Please try again.',
          );
      }
    })();
    const onKeyDown = (event: KeyboardEvent) => {
      if (!readyRef.current) return;
      if (event.target instanceof HTMLElement && event.target.matches('input, textarea, select')) return;
      const key = event.key.toLowerCase();
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const shortcuts: Record<string, Overlay> = {
        b: 'inventory',
        i: 'inventory',
        c: 'craft',
        m: 'map',
        j: 'journal',
        h: 'condition',
      };
      if (sim.state.status !== 'playing') return;
      if (key === 'escape' && !overlayRef.current) {
        event.preventDefault();
        open('pause');
        return;
      }
      if (shortcuts[key] && !event.repeat) {
        event.preventDefault();
        if (
          !overlayRef.current ||
          ['inventory', 'craft', 'workshop', 'map', 'journal', 'condition', 'fieldcraft'].includes(
            overlayRef.current,
          )
        )
          open(
            overlayRef.current === shortcuts[key]
              ? overlayRef.current === 'condition'
                ? trailReturn.current
                : null
              : shortcuts[key],
          );
        return;
      }
      if (overlayRef.current) return;
      if (
        event.target instanceof HTMLElement &&
        event.target.closest('button') &&
        (key === ' ' || key === 'enter')
      )
        return;
      if (/^[1-6]$/.test(key) && !event.repeat) {
        const index = Number(key) - 1;
        sim.selectSlot(index);
        refresh();
      }
      if (key === 'x' && !event.repeat) {
        event.preventDefault();
        sim.equip(null);
        refresh();
      }
      if (!event.repeat && ['e', ' '].includes(key)) {
        event.preventDefault();
        // A quick tap must work even if keyup arrives before the next animation
        // frame. Holding continues through Simulation.update with the same gates.
        if (key === ' ') sim.attack();
        else if (key === 'e' && !sim.keys.has(' ') && !sim.keys.has('primary')) sim.interact();
        refresh();
        if (overlayRef.current) return;
      }
      if (
        ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'e', ' ', 'shift'].includes(
          key,
        )
      ) {
        event.preventDefault();
        input.key(key, true);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => input.key(event.key.toLowerCase(), false);
    const pause = () => {
      input.clear();
      if (readyRef.current && sim.state.status === 'playing' && !overlayRef.current) open('pause');
      save();
    };
    const visibility = () => {
      if (document.hidden) {
        pause();
        audio.suspend();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', pause);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('beforeunload', save);
    return () => {
      alive = false;
      controller.abort();
      sim.onOpenCrafting = undefined;
      cancelAnimationFrame(frame);
      observer.disconnect();
      input.clear();
      save();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', pause);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('beforeunload', save);
      rendererRef.current = null;
    };
  }, [sim, initial.seed, open, refresh, input, loadAttempt, arrival]);
  const weather = WEATHER[view.weather],
    night = view.hour >= 20 || view.hour < 6;
  const touchKey = (key: string, label: string, icon?: string) => (
    <button
      className={`touch-key touch-${key === ' ' ? 'attack' : key}`}
      aria-label={label}
      onPointerDown={(event) => {
        event.preventDefault();
        if (!readyRef.current || overlayRef.current) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        if (key === 'primary' || key === 'e' || key === ' ') {
          if (key === ' ') sim.attack();
          else if (key === 'e' && !sim.keys.has(' ')) sim.interact();
          else if (key === 'primary' && !sim.keys.has(' ')) {
            sim.aim = null;
            sim.useHeld();
          }
          refresh();
        }
        if (!overlayRef.current) input.press(event.pointerId, [key]);
      }}
      onPointerMove={(event) => {
        if (!input.owns(event.pointerId)) return;
        const pad = event.currentTarget.closest('.touch-dpad');
        if (!pad) return;
        const box = pad.getBoundingClientRect();
        input.press(
          event.pointerId,
          touchMovementKeys(
            (event.clientX - box.left - box.width / 2) / (box.width / 2),
            (event.clientY - box.top - box.height / 2) / (box.height / 2),
          ),
        );
      }}
      onPointerUp={(event) => input.release(event.pointerId)}
      onPointerCancel={(event) => input.release(event.pointerId)}
      onLostPointerCapture={(event) => input.release(event.pointerId)}
    >
      {icon ? <Icon name={icon} size={20} /> : label}
    </button>
  );
  return (
    <div
      className="game-shell"
      data-hud={settings.compactHud ? 'compact' : 'full'}
      data-loading={!ready}
      data-camp={!!view.camp}
    >
      <canvas
        className="game-canvas"
        tabIndex={0}
        ref={canvasRef}
        aria-label="The Forest: WASD or right-click to move, left-click to attack or use, E to interact"
        onContextMenu={(event) => event.preventDefault()}
        onPointerDown={(event) => {
          if (!ready || overlay || !rendererRef.current) return;
          event.preventDefault();
          event.currentTarget.focus({ preventScroll: true });
          const rect = event.currentTarget.getBoundingClientRect();
          const point = rendererRef.current.screenToWorld(
            event.clientX - rect.left,
            event.clientY - rect.top,
          );
          if (event.button === 2) {
            sim.leaveCamp();
            sim.target = point;
          } else if (event.button === 0) {
            sim.aim = point;
            sim.useHeld(point);
            input.press(event.pointerId, ['primary']);
            event.currentTarget.setPointerCapture(event.pointerId);
          }
          refresh();
        }}
        onPointerMove={(event) => {
          if (
            !ready ||
            overlay ||
            !rendererRef.current ||
            (!input.owns(event.pointerId) && sim.state.equipped !== 'workbench')
          )
            return;
          const rect = event.currentTarget.getBoundingClientRect();
          sim.aim = rendererRef.current.screenToWorld(event.clientX - rect.left, event.clientY - rect.top);
        }}
        onPointerUp={(event) => input.release(event.pointerId)}
        onPointerCancel={(event) => input.release(event.pointerId)}
        onLostPointerCapture={(event) => input.release(event.pointerId)}
      />
      {!ready && (
        <LoadingScreen
          kind="world"
          progress={loadProgress}
          phase={loadPhase}
          error={artError}
          onRetry={() => setLoadAttempt((value) => value + 1)}
          onBack={onQuit}
          world={initial}
          returning={arrival === 'resume'}
          reducedMotion={settings.reducedMotion}
        />
      )}
      <div
        className="game-hud"
        inert={!ready || !!view.camp}
        aria-hidden={!ready || !!view.camp || undefined}
      >
        <SurvivalHud view={view} onDetails={() => open('condition')} />
        <div className="time-weather">
          <div className="day-panel hud-panel">
            <Icon name={night ? 'moon' : 'sun'} size={17} />
            <span className="day-number">DAY {view.day}</span>
            <time>{clock(view.time)}</time>
            {view.weather !== 'clear' && (
              <span className="weather-chip" title={weather.description} aria-label={weather.name}>
                <Icon name={weather.icon} size={15} style={{ color: weather.color }} />
                {view.weather === 'wolves'
                  ? 'Howls'
                  : view.weather === 'storm'
                    ? 'Storm'
                    : view.weather === 'cold'
                      ? 'Cold'
                      : 'Rain'}
              </span>
            )}
          </div>
          {view.wolvesNear > 0 ? (
            <div className={`wolf-encounter ${view.wolfWindup ? 'is-warning' : ''}`} role="status">
              <Icon name="wolfMark" size={21} />
              <span>
                {view.wolfWindup
                  ? view.wolfPounce
                    ? 'Heavy pounce incoming.'
                    : 'A wolf is about to lunge.'
                  : `${view.wolvesNear} ${view.wolvesNear === 1 ? 'wolf' : 'wolves'} on your trail.`}
              </span>
            </div>
          ) : null}
        </div>
        <div className="map-tools">
          <div className="game-top-buttons">
            <button
              className="hud-icon map-open"
              title="Map (M)"
              aria-label="Map"
              onClick={() => open('map')}
            >
              <Icon name="map" size={18} />
            </button>
            <button
              className="hud-icon"
              title="Settings"
              aria-label="Settings"
              onClick={() => open('settings')}
            >
              <Icon name="settings" size={18} />
            </button>
            <button
              className="hud-icon"
              title="Pause (Esc)"
              aria-label="Pause game"
              onClick={() => open('pause')}
            >
              <Icon name="pause" size={14} />
            </button>
          </div>
          <button
            className="minimap-panel hud-panel"
            onClick={() => open('map')}
            aria-label="Open forest map"
          >
            <span className="minimap-heading">
              <Icon name="tree" size={11} />
              THE FOREST<span>N ↑</span>
            </span>
            <canvas ref={minimapRef} width={180} height={125} />
            <span className="minimap-footer">
              <Key>M</Key>
              {view.exploredPercent}% CHARTED
              <Icon name="expand" size={11} />
            </span>
          </button>
          {saveIssue && (
            <div className="hud-save save-warning" role="status">
              <Icon name="info" size={10} />
              LOCAL SAVING UNAVAILABLE
            </div>
          )}
        </div>
        <div className="toast-stack" role="status" aria-live="polite">
          {view.toasts.slice(-1).map((toast) => (
            <div className={`game-toast ${toast.type}`} key={toast.id}>
              <Icon
                name={toast.type === 'warning' ? 'info' : toast.type === 'success' ? 'check' : 'leaf'}
                size={14}
              />
              <span>{toast.text}</span>
            </div>
          ))}
        </div>
        {settings.showHints &&
          view.nearest &&
          ['fire', 'workbench', 'water', 'shelter'].includes(view.nearest.kind) && (
            <button
              className="interaction-prompt"
              onClick={() => {
                sim.interact();
                refresh();
              }}
            >
              <Key>E</Key>
              <span>
                <strong>{view.nearest.label}</strong>
                <small>{view.nearest.detail}</small>
              </span>
              <span className="interaction-dot" />
            </button>
          )}
        {view.action?.resourceId !== undefined && (
          <span
            className="sr-only"
            role="progressbar"
            aria-label="Collecting wild berries"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(
              Math.min(100, ((view.time - view.action.startedAt) / view.action.duration) * 100),
            )}
          />
        )}
        <div className="quickbar-wrap">
          <div
            className="held-item-status"
            data-item={view.equipped || 'none'}
            data-action={view.action?.kind || 'idle'}
          >
            {view.equipped && <ItemIcon item={view.equipped} size={17} />}
            <strong>{view.equipped ? ITEMS[view.equipped].name : 'Empty hands'}</strong>
            <button
              className="held-use"
              disabled={!view.equipped || !!view.action}
              onClick={() => {
                sim.useHeld();
                refresh();
              }}
              aria-label="Use held item"
              title="Use held item (left-click)"
            >
              <Icon name="mouse" size={13} />
            </button>
            <button
              className="held-stow"
              disabled={!view.equipped}
              onClick={() => {
                sim.equip(null);
                refresh();
              }}
              aria-label="Stow held item"
              title="Empty hands (X)"
            >
              <Icon name="close" size={10} />
            </button>
          </div>
          <div className="quickbar">
            {view.hotbar.map((item, index) => (
              <button
                className={`quick-slot ${item && view.equipped === item ? 'active' : ''} ${!item || (!view.inventory[item] && !(item === 'torch' && view.torchLit)) ? 'empty' : ''}`}
                onClick={() => {
                  sim.selectSlot(index);
                  refresh();
                }}
                draggable={item !== null}
                onDragStart={(event) => {
                  if (item) event.dataTransfer.setData('text/plain', item);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const value = event.dataTransfer.getData('text/plain');
                  if (Object.hasOwn(ITEMS, value)) {
                    sim.assignSlot(index, value as ItemId);
                    refresh();
                  }
                }}
                key={index}
                aria-pressed={!!item && view.equipped === item}
                aria-label={
                  item
                    ? `${ITEMS[item].name}, shortcut ${index + 1}, ${view.inventory[item]} available`
                    : `Empty shortcut ${index + 1}`
                }
              >
                {item === 'torch' && view.torchLit && (
                  <svg className="torch-timer" viewBox="0 0 44 44" aria-hidden="true">
                    <circle
                      cx="22"
                      cy="22"
                      r="20"
                      pathLength="100"
                      style={{
                        strokeDasharray: `${Math.min(100, (view.torchSeconds / TORCH_DURATION) * 100)} 100`,
                      }}
                    />
                  </svg>
                )}
                <span className="slot-number">{index + 1}</span>
                {item ? <ItemIcon item={item} size={36} /> : <span className="empty-slot-mark">+</span>}
                <span className="slot-count">
                  {item === 'torch' && view.torchLit ? (
                    `${view.torchSeconds}s`
                  ) : item && ITEMS[item].category === 'TOOL' ? (
                    <Icon name="diamond" size={7} />
                  ) : item ? (
                    view.inventory[item] || '–'
                  ) : (
                    ''
                  )}
                </span>
                <span className="slot-tooltip">
                  {item ? ITEMS[item].name : 'Pin an item from your backpack'}
                </span>
              </button>
            ))}
            <span className="quickbar-divider" />
            <button
              className="quick-slot backpack-slot"
              onClick={() => open('inventory')}
              aria-label="Open backpack"
            >
              <span className="slot-number">B</span>
              <Icon name="pack" size={27} />
              <span className="slot-tooltip">Your backpack</span>
            </button>
            <button className="quick-slot craft-slot" onClick={() => open('craft')} aria-label="Handcraft">
              <span className="slot-number">C</span>
              <Icon name="hammer" size={26} />
              <span className="slot-tooltip">Handcraft</span>
            </button>
          </div>
        </div>
        <div className="touch-controls">
          <div className="touch-dpad" role="group" aria-label="Four-direction movement">
            <span className="touch-center" aria-hidden="true">
              <Icon name="compass" size={20} />
            </span>
            {touchKey('w', 'Move up', 'arrow')}
            {touchKey('a', 'Move left', 'arrow')}
            {touchKey('s', 'Move down', 'arrow')}
            {touchKey('d', 'Move right', 'arrow')}
          </div>
          <div className="touch-actions">
            {touchKey('primary', 'Use held item', 'mouse')}
            {touchKey(' ', 'Defend', 'hammer')}
            {touchKey('e', 'E')}
          </div>
        </div>
      </div>
      {ready && view.camp && (
        <CampfirePanel
          camp={view.camp}
          wood={view.inventory.wood}
          saveIssue={saveIssue}
          onFeed={() => {
            sim.feedFire(view.camp!.id);
            refresh();
          }}
          onLeave={() => {
            sim.leaveCamp();
            input.clear();
            refresh();
            canvasRef.current?.focus();
          }}
        />
      )}
      {(overlay === 'inventory' || overlay === 'craft' || overlay === 'workshop') && (
        <BackpackDialog
          tab={overlay}
          workbenchId={workshopRef.current}
          view={view}
          sim={sim}
          onTab={open}
          onClose={close}
          onRefresh={refresh}
          onMap={() => open('map')}
        />
      )}
      {overlay === 'map' && <MapDialog sim={sim} ground={rendererRef.current?.ground} onClose={close} />}
      {overlay === 'journal' && <JournalDialog view={view} onClose={() => open(trailReturn.current)} />}
      {overlay === 'pause' && (
        <PauseDialog
          view={view}
          onClose={close}
          onSettings={() => open('settings')}
          onGuide={() => open('guide')}
          onCondition={() => open('condition')}
          onFieldcraft={() => open('fieldcraft')}
          onJournal={() => open('journal')}
          onQuit={quit}
        />
      )}
      {overlay === 'settings' && (
        <SettingsDialog settings={settings} onChange={onSettings} onClose={() => open('pause')} />
      )}
      {overlay === 'guide' && <GuideDialog onClose={() => open('pause')} />}
      {overlay === 'condition' && <ConditionDialog view={view} onClose={() => open(trailReturn.current)} />}
      {overlay === 'fieldcraft' && <FieldcraftDialog onClose={() => open(trailReturn.current)} />}
      {overlay === 'end' && (
        <EndDialog
          view={view}
          onContinue={() => {
            sim.state.status = 'playing';
            sim.state.victoryAcknowledged = true;
            lastRecorded.current = 'playing';
            saveGame(sim.state);
            refresh();
            open(null);
          }}
          onRestart={onRestart}
          onQuit={quit}
        />
      )}
    </div>
  );
}
